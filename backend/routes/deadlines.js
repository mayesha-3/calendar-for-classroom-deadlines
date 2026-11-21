import express from 'express'
import Deadline from '../models/Deadline.js'
import User from '../models/User.js'
import ActivityLog from '../models/ActivityLog.js'
import { requireUser } from '../middleware/rbac.js'
import { sendNotificationToUsers } from '../utils/messaging.js'

const router = express.Router()

// GET all deadlines
router.get('/', requireUser, async (req, res) => {
  try {
    const deadlines = await Deadline.find()
      .populate('createdBy', 'name email username')
      .sort({ deadline: 1 })
      .lean()
    res.json(deadlines)
  } catch (error) {
    console.error('Failed to get deadlines:', error)
    res.status(500).json({ error: 'Unable to get deadlines' })
  }
})

// POST create deadline
router.post('/', requireUser, async (req, res) => {
  try {
    const { title, description, type, customType, deadline } = req.body
    const user = await User.findOne({ uid: req.user.uid })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const dl = await Deadline.create({
      title,
      description,
      type,
      customType: type === 'other' ? (customType || '') : '',
      deadline: new Date(deadline),
      createdBy: user._id,
    })

    const allUsers = await User.find().select('_id').lean()
    void sendNotificationToUsers(
      allUsers.map(u => u._id),
      'New Deadline Added',
      `"${title}" was added`,
      { type: 'deadline', itemId: dl._id.toString(), url: '/calendar' }
    )

    res.status(201).json(dl)
  } catch (error) {
    console.error('Deadline creation failed:', error)
    res.status(500).json({ error: error.message || 'Unable to create deadline' })
  }
})

// PATCH update deadline
router.patch('/:id', requireUser, async (req, res) => {
  try {
    const { title, description, type, customType, deadline } = req.body
    const user = await User.findOne({ uid: req.user.uid })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const dl = await Deadline.findById(req.params.id)
    if (!dl) return res.status(404).json({ error: 'Deadline not found' })

    if (title !== undefined) dl.title = title
    if (description !== undefined) dl.description = description
    if (type !== undefined) dl.type = type
    if (customType !== undefined) dl.customType = type === 'other' ? customType : ''
    if (deadline !== undefined) dl.deadline = new Date(deadline)

    await dl.save()
    res.json(dl)
  } catch (error) {
    console.error('Deadline update failed:', error)
    res.status(500).json({ error: 'Unable to update deadline' })
  }
})

// DELETE deadline (any authenticated user can delete)
router.delete('/:id', requireUser, async (req, res) => {
  try {
    const dl = await Deadline.findByIdAndDelete(req.params.id)
    if (!dl) return res.status(404).json({ error: 'Deadline not found' })
    // Also delete associated comments
    await ActivityLog.deleteMany({ deadline: dl._id })
    res.json({ message: 'Deadline deleted' })
  } catch (error) {
    console.error('Failed to delete deadline:', error)
    res.status(500).json({ error: 'Unable to delete deadline' })
  }
})

// GET comments for a deadline
router.get('/:id/comments', requireUser, async (req, res) => {
  try {
    const logs = await ActivityLog.find({ deadline: req.params.id })
      .populate('author', 'name email username')
      .sort({ timestamp: 1 })
      .lean()
    res.json(logs)
  } catch (error) {
    res.status(500).json({ error: 'Unable to get comments' })
  }
})

// POST comment on a deadline
router.post('/:id/comments', requireUser, async (req, res) => {
  const { content } = req.body
  if (!content) return res.status(400).json({ error: 'content is required' })

  try {
    const user = await User.findOne({ uid: req.user.uid })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const dl = await Deadline.findById(req.params.id)
    if (!dl) return res.status(404).json({ error: 'Deadline not found' })

    const comment = await ActivityLog.create({
      deadline: dl._id,
      author: user._id,
      type: 'comment',
      content,
    })

    const populated = await ActivityLog.findById(comment._id).populate('author', 'name email username').lean()
    const allUsers = await User.find().select('_id').lean()
    void sendNotificationToUsers(
      allUsers.map(u => u._id),
      'New Deadline Comment',
      `${populated.author?.name || 'Someone'} commented on "${dl.title}"`,
      { type: 'deadline-comment', itemId: dl._id.toString(), url: '/calendar' }
    )
    res.status(201).json(populated)
  } catch (error) {
    res.status(500).json({ error: 'Unable to add comment' })
  }
})

// DELETE a comment (any authenticated user can delete)
router.delete('/:id/comments/:commentId', requireUser, async (req, res) => {
  try {
    const comment = await ActivityLog.findByIdAndDelete(req.params.commentId)
    if (!comment) return res.status(404).json({ error: 'Comment not found' })
    res.json({ message: 'Comment deleted' })
  } catch (error) {
    console.error('Failed to delete comment:', error)
    res.status(500).json({ error: 'Unable to delete comment' })
  }
})

export default router
