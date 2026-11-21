import { getAuth } from 'firebase-admin/auth'
import User from '../models/User.js'
import SystemConfig from '../models/SystemConfig.js'
import Deadline from '../models/Deadline.js'
import { clearUserCache } from '../middleware/auth.js'
import { isPermanentAdmin, PERMANENT_ADMIN_EMAILS } from '../middleware/rbac.js'

export const migrateUserProfiles = async () => {
  await User.collection.updateMany({}, {
    $unset: { department: '', superior: '', position: '' },
  })
  await SystemConfig.deleteOne({ key: 'positionOptions' })
  await User.updateMany(
    { role: { $ne: 'admin' } },
    { $set: { role: 'user' } },
  )
  const previousAdmin = await User.findOne({ email: 'coo.kishorcoder@gmail.com' }).select('uid').lean()
  if (previousAdmin) {
    await User.updateOne({ _id: previousAdmin._id }, { $set: { role: 'user' } })
    if (previousAdmin.uid) {
      try {
        await getAuth().setCustomUserClaims(previousAdmin.uid, { role: 'user' })
      } catch (error) {
        console.warn('Could not remove legacy admin claim:', error.message)
      }
      clearUserCache(previousAdmin.uid)
    }
  }
}

/**
 * Robustly find, bind, or create a MongoDB user record from a Firebase auth token payload.
 */
export const findOrCreateOrBindUser = async (firebaseUser) => {
  if (!firebaseUser || !firebaseUser.uid) {
    throw new Error('Firebase user payload with UID is required')
  }

  let rawEmail = firebaseUser.email || ''

  if (!rawEmail) {
    try {
      const fbUser = await getAuth().getUser(firebaseUser.uid)
      if (fbUser && fbUser.email) {
        rawEmail = fbUser.email
      }
    } catch (fbErr) {
      console.warn('Could not fetch Firebase Auth user details:', fbErr.message)
    }
  }

  const cleanEmail = rawEmail.trim().toLowerCase()
  const defaultEmail = cleanEmail || `${firebaseUser.uid}@kanbankc.internal`

  let user = await User.findOne({ uid: firebaseUser.uid })

  if (user) {
    let modified = false
    if (cleanEmail && (user.email.endsWith('@kanbankc.internal') || user.email !== cleanEmail)) {
      const existingWithEmail = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } })
      if (!existingWithEmail) {
        user.email = cleanEmail
        modified = true
      }
    }
    if (isPermanentAdmin(cleanEmail) || isPermanentAdmin(user.email)) {
      if (user.role !== 'admin') {
        user.role = 'admin'
        modified = true
      }
    } else if (user.role !== 'admin' && user.role !== 'user') {
      user.role = 'user'
      modified = true
    }
    if (modified) {
      await user.save()
    }
  }

  if (!user && cleanEmail) {
    user = await User.findOne({ email: cleanEmail })
    if (user) {
      user.uid = firebaseUser.uid
      if (firebaseUser.name && !user.name) {
        user.name = firebaseUser.name
      }
      if (isPermanentAdmin(cleanEmail)) {
        user.role = 'admin'
      } else if (user.role !== 'admin') {
        user.role = 'user'
      }
      await user.save()
    }
  }

  if (!user) {
    user = await User.create({
      uid: firebaseUser.uid,
      email: defaultEmail,
      name: firebaseUser.name || (isPermanentAdmin(cleanEmail) ? 'Admin' : ''),
      role: isPermanentAdmin(cleanEmail) ? 'admin' : 'user',
    })
  }

  if (isPermanentAdmin(cleanEmail) || isPermanentAdmin(user.email)) {
    try {
      await getAuth().setCustomUserClaims(firebaseUser.uid, { role: 'admin' })
    } catch (claimErr) {
      console.warn('Could not set custom claims for permanent admin:', claimErr.message)
    }
  }

  clearUserCache(user.uid)
  return user
}

/**
 * Permanently purge a user.
 */
export const purgeUserCompletely = async (user) => {
  if (!user) return
  if (isPermanentAdmin(user.email)) {
    throw new Error('Cannot purge the permanent admin account')
  }

  if (user.uid) {
    try {
      await getAuth().deleteUser(user.uid)
    } catch (fbErr) {
      console.warn('Firebase user deletion warning (may already be deleted):', fbErr.message)
    }
  }

  const cleanEmail = (user.email || '').trim().toLowerCase()
  const deleteConditions = []
  if (user._id) deleteConditions.push({ _id: user._id })
  if (user.uid) deleteConditions.push({ uid: user.uid })
  if (cleanEmail) deleteConditions.push({ email: cleanEmail })

  if (deleteConditions.length > 0) {
    await User.deleteMany({ $or: deleteConditions })
  }

  if (user.uid) {
    clearUserCache(user.uid)
  }
}

/**
 * Startup hook to ensure all permanent admins exist and have admin claims.
 */
export const ensurePermanentAdmin = async () => {
  for (const adminEmail of PERMANENT_ADMIN_EMAILS) {
    try {
      const cleanEmail = adminEmail.toLowerCase()
      let dbUser = await User.findOne({ email: cleanEmail })

      let fbUser = null
      try {
        fbUser = await getAuth().getUserByEmail(cleanEmail)
      } catch (fbErr) {
        // Admin may not have registered in Firebase yet
      }

      if (fbUser) {
        try {
          await getAuth().setCustomUserClaims(fbUser.uid, { role: 'admin' })
        } catch (claimErr) {
          console.warn('Failed to set claims for permanent admin on startup:', claimErr.message)
        }

        if (!dbUser) {
          dbUser = await User.create({
            uid: fbUser.uid,
            email: cleanEmail,
            name: fbUser.displayName || 'Admin',
            role: 'admin',
          })
          console.log(`[Permanent Admin] Created MongoDB record for ${cleanEmail}`)
        } else {
          let modified = false
          if (dbUser.uid !== fbUser.uid) {
            dbUser.uid = fbUser.uid
            modified = true
          }
          if (dbUser.role !== 'admin') {
            dbUser.role = 'admin'
            modified = true
          }
          if (modified) {
            await dbUser.save()
            console.log(`[Permanent Admin] Synced MongoDB record for ${cleanEmail}`)
          }
        }
      } else if (dbUser && dbUser.role !== 'admin') {
        dbUser.role = 'admin'
        await dbUser.save()
        console.log(`[Permanent Admin] Updated role to admin for ${cleanEmail}`)
      }
    } catch (err) {
      console.warn(`[Permanent Admin] Initialization check error for ${adminEmail}:`, err.message)
    }
  }
}
