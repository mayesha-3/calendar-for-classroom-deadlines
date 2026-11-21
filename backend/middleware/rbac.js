export const roles = {
  ADMIN: 'admin',
  USER: 'user',
}

export const PERMANENT_ADMIN_EMAILS = [
  'mayeshaafrooz@gmail.com',
  'c241488@ugrad.iiuc.ac.bd',
]

export const isPermanentAdmin = (email) => {
  if (!email || typeof email !== 'string') return false
  const clean = email.trim().toLowerCase()
  return PERMANENT_ADMIN_EMAILS.some(e => e.toLowerCase() === clean)
}

export const ensureRole = (...allowedRoles) => (req, res, next) => {
  const role = req.user?.role
  if (!role) {
    return res.status(403).json({ error: 'Role claim missing from token' })
  }
  const normalizedRole = role.toLowerCase()
  const normalizedAllowed = allowedRoles.map(r => r.toLowerCase())
  if (!normalizedAllowed.includes(normalizedRole)) {
    return res.status(403).json({ error: 'Insufficient privileges' })
  }
  next()
}

export const requireAdmin = ensureRole(roles.ADMIN)
export const requireUser = ensureRole(roles.ADMIN, roles.USER)
