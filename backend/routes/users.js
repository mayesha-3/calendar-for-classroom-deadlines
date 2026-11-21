import express from 'express'
import { getAuth } from 'firebase-admin/auth'
import User from '../models/User.js'
import { roles, requireAdmin, requireUser, isPermanentAdmin } from '../middleware/rbac.js'
import { clearUserCache } from '../middleware/auth.js'
import { sendNotificationToUsers } from '../utils/messaging.js'
import { purgeUserCompletely } from '../utils/userUtils.js'

const router = express.Router()

router.get('/', requireUser, async (req, res) => {
  try {
    let users = await User.find({})
      .select('email contactEmail name role username isWarned uid')
      .lean()

    // Keep the admin list in sync with the email stored in Firebase Auth.
    const healingPromises = users.map(async (u) => {
      if (u.uid) {
        try {
          const fbUser = await getAuth().getUser(u.uid)
          const cleanEmail = fbUser.email?.trim().toLowerCase()
          if (cleanEmail && cleanEmail !== u.email) {
            const existingWithEmail = await User.findOne({
              email: cleanEmail,
              _id: { $ne: u._id },
            })
            if (existingWithEmail) {
              console.error(
                `Firebase email sync conflict for user ${u.uid}: the email is already assigned to another user`,
              )
            } else {
              await User.updateOne({ _id: u._id }, { email: cleanEmail })
              clearUserCache(u.uid)
            }
            u.email = cleanEmail
          }
        } catch (fbErr) {
          console.warn(`Could not sync Firebase email for user ${u.uid}:`, fbErr.message)
        }
      }
      return u
    })

    users = await Promise.all(healingPromises)
    users = users.map((u) => {
      if (isPermanentAdmin(u.email) && u.role !== 'admin') {
        u.role = 'admin'
        User.updateOne({ _id: u._id }, { role: 'admin' }).catch(() => {})
      }
      return u
    })
    res.json(users)
  } catch (error) {
    console.error('List users failed:', error)
    res.status(500).json({ error: 'Unable to list users' })
  }
})

router.post('/', requireAdmin, async (req, res) => {
  const { email, password, name, role = roles.USER } = req.body
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, and name are required' })
  }
  if (!Object.values(roles).includes(role)) {
    return res.status(400).json({ error: 'Role must be user or admin' })
  }

  try {
    const firebaseUser = await getAuth().createUser({
      email,
      password,
      displayName: name,
    })

    await getAuth().setCustomUserClaims(firebaseUser.uid, { role })

    const userRecord = await User.create({
      uid: firebaseUser.uid,
      email,
      name,
      role,
    })

    res.status(201).json({
      uid: userRecord.uid,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role,
    })
  } catch (error) {
    console.error('Provision user failed:', error)
    res.status(500).json({ error: 'Unable to provision user' })
  }
})

// GET recent activity (past 3 days) - admin only
router.get('/activity/recent', requireAdmin, async (req, res) => {
  try {
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    
    // Import Deadline and Event dynamically to avoid circular deps
    const [Deadline, Event, ActivityLog] = await Promise.all([
      import('../models/Deadline.js').then(m => m.default),
      import('../models/Event.js').then(m => m.default),
      import('../models/ActivityLog.js').then(m => m.default),
    ])
    
    const [recentDeadlines, recentEvents, recentComments] = await Promise.all([
      Deadline.find({ createdAt: { $gte: threeDaysAgo } })
        .populate('createdBy', 'name email username')
        .sort({ createdAt: -1 })
        .lean(),
      Event.find({ createdAt: { $gte: threeDaysAgo } })
        .populate('createdBy', 'name email username')
        .sort({ createdAt: -1 })
        .lean(),
      ActivityLog.find({ createdAt: { $gte: threeDaysAgo } })
        .populate('author', 'name email username')
        .sort({ createdAt: -1 })
        .lean(),
    ])
    
    const activity = [
      ...recentDeadlines.map(d => ({
        type: 'deadline_created',
        title: d.title,
        user: d.createdBy,
        date: d.createdAt,
      })),
      ...recentEvents.map(e => ({
        type: 'event_created',
        title: e.title,
        user: e.createdBy,
        date: e.createdAt,
      })),
      ...recentComments.map(c => ({
        type: 'comment_added',
        title: c.content?.substring(0, 50),
        user: c.author,
        date: c.createdAt,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    res.json(activity)
  } catch (error) {
    console.error('Failed to get activity:', error)
    res.status(500).json({ error: 'Unable to get activity' })
  }
})

router.patch('/:id/role', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { role } = req.body
  if (!Object.values(roles).includes(role)) {
    return res.status(400).json({ error: 'Invalid role' })
  }

  try {
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (isPermanentAdmin(user.email)) {
      return res.status(400).json({ error: 'Cannot change the role of the permanent admin' })
    }

    await getAuth().setCustomUserClaims(user.uid, { role })
    user.role = role
    await user.save()
    clearUserCache(user.uid)

    res.json({
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
    })
  } catch (error) {
    console.error('Change role failed:', error)
    res.status(500).json({ error: 'Unable to change role' })
  }
})

router.patch('/:id/warn', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { isWarned } = req.body

  try {
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (isPermanentAdmin(user.email)) {
      return res.status(400).json({ error: 'Cannot warn the permanent admin' })
    }

    user.isWarned = typeof isWarned === 'boolean' ? isWarned : !user.isWarned
    await user.save()
    clearUserCache(user.uid)

    if (user.isWarned) {
      sendNotificationToUsers(
        [user._id],
        'Warning Issued',
        "Warning: You're Under Watch",
        { type: 'warning' }
      )
    }

    res.json({
      _id: user._id,
      email: user.email,
      name: user.name,
      isWarned: user.isWarned,
    })
  } catch (error) {
    console.error('Warn user failed:', error)
    res.status(500).json({ error: 'Unable to update warning status' })
  }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params

  try {
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (isPermanentAdmin(user.email)) {
      return res.status(400).json({ error: 'Cannot delete the permanent admin account' })
    }

    await purgeUserCompletely(user)

    res.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Delete user failed:', error)
    res.status(500).json({ error: 'Unable to delete user' })
  }
})

router.patch('/:id/email', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { email } = req.body

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required' })
  }

  const cleanEmail = email.trim().toLowerCase()

  try {
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (isPermanentAdmin(user.email)) {
      return res.status(400).json({ error: 'Cannot change the email of the permanent admin' })
    }

    const existing = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } })
    if (existing) {
      return res.status(400).json({ error: 'Email address is already in use by another user' })
    }

    if (user.uid) {
      try {
        await getAuth().updateUser(user.uid, { email: cleanEmail })
      } catch (fbErr) {
        console.warn('Could not update email in Firebase Auth:', fbErr.message)
      }
    }

    user.email = cleanEmail
    await user.save()
    clearUserCache(user.uid)

    res.json({
      _id: user._id,
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
    })
  } catch (error) {
    console.error('Update email failed:', error)
    res.status(500).json({ error: 'Unable to update user email' })
  }
})

router.patch('/:id/username', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { username } = req.body

  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: 'A valid username is required' })
  }

  try {
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const cleanUsername = username.trim()
    const existing = await User.findOne({ username: cleanUsername, _id: { $ne: user._id } })
    if (existing) {
      return res.status(400).json({ error: 'Username already taken' })
    }

    user.username = cleanUsername
    await user.save()
    clearUserCache(user.uid)

    res.json({
      _id: user._id,
      uid: user.uid,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
    })
  } catch (error) {
    console.error('Update username failed:', error)
    res.status(500).json({ error: 'Unable to update username' })
  }
})

export default router

