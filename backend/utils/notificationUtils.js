import { getMessaging } from 'firebase-admin/messaging'
import User from '../models/User.js'

export const collectUserTokens = (users = []) => {
  const seen = new Set()

  for (const user of users) {
    const rawTokens = Array.isArray(user?.fcmTokens) ? user.fcmTokens : []
    for (const token of rawTokens) {
      if (typeof token !== 'string') continue
      const cleanToken = token.trim()
      if (!cleanToken || seen.has(cleanToken)) continue
      seen.add(cleanToken)
    }
  }

  return [...seen]
}

export const getChangedAssigneeIds = (previousIds = [], nextIds = []) => {
  const previous = new Set(previousIds.map(String))
  return [...new Set(nextIds.map(String))].filter(id => !previous.has(id))
}

export const getDueSoonTaskIds = (tasks = [], now = new Date()) => {
  const start = now.getTime()
  const end = start + 24 * 60 * 60 * 1000
  return tasks
    .filter(task => task?.dueDate && new Date(task.dueDate).getTime() >= start && new Date(task.dueDate).getTime() <= end)
    .map(task => String(task._id))
}

export const sendMulticastNotification = async ({ userIds = [], title, body, data = {} }) => {
  if (!title || !body) {
    throw new Error('Notification title and body are required')
  }

  const users = await User.find({ _id: { $in: userIds } }).select('fcmTokens').lean()
  const tokens = collectUserTokens(users)

  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, tokens: [] }
  }

  const payload = {
    tokens,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, String(value)]),
    ),
  }

  const response = await getMessaging().sendEachForMulticast(payload)
  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    tokens,
  }
}
