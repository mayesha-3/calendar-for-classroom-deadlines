import express from 'express'
import mongoose from 'mongoose'
import { Readable } from 'node:stream'
import Resource from '../models/Resource.js'
import User from '../models/User.js'
import { requireUser } from '../middleware/rbac.js'
import { sendNotificationToUsers } from '../utils/messaging.js'

const router = express.Router()
const MAX_PDF_BYTES = 25 * 1024 * 1024
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'resourceFiles' })

const getParentId = (value) => {
  if (!value || value === 'root') return null
  if (!mongoose.isValidObjectId(value)) return undefined
  return value
}

router.get('/', requireUser, async (req, res) => {
  const parentId = getParentId(req.query.parentId)
  if (parentId === undefined) return res.status(400).json({ error: 'Invalid folder.' })
  try {
    if (parentId && !(await Resource.exists({ _id: parentId, kind: 'folder' }))) return res.status(404).json({ error: 'Folder not found.' })
    const resources = await Resource.find({ parentId }).sort({ kind: 1, name: 1 }).select('name kind parentId ownerId size createdAt').populate('ownerId', 'uid name email').lean()
    res.json(resources)
  } catch (error) {
    console.error('Failed to list resources:', error)
    res.status(500).json({ error: 'Unable to load resources.' })
  }
})

router.post('/folders', requireUser, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  const parentId = getParentId(req.body?.parentId)
  if (!name || name.length > 180) return res.status(400).json({ error: 'Folder names must be 1–180 characters.' })
  if (parentId === undefined) return res.status(400).json({ error: 'Invalid parent folder.' })
  try {
    const owner = await User.findOne({ uid: req.user.uid }).select('_id').lean()
    if (!owner) return res.status(404).json({ error: 'User profile not found.' })
    if (parentId && !(await Resource.exists({ _id: parentId, kind: 'folder' }))) return res.status(404).json({ error: 'Parent folder not found.' })
    const folder = await Resource.create({ name, kind: 'folder', parentId, ownerId: owner._id })
    const allUsers = await User.find().select('_id').lean()
    void sendNotificationToUsers(
      allUsers.map(u => u._id),
      'New Resource Folder Added',
      `Folder "${name}" was added`,
      { type: 'resource', itemId: folder._id.toString(), url: '/resources' }
    )
    res.status(201).json(folder)
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'A folder with that name already exists here.' })
    console.error('Failed to create folder:', error)
    res.status(500).json({ error: 'Unable to create folder.' })
  }
})

router.post('/upload', requireUser, express.raw({ type: 'application/pdf', limit: MAX_PDF_BYTES }), async (req, res) => {
  let name = ''
  try { name = decodeURIComponent(req.get('x-file-name') || '').trim() } catch { /* Invalid encoded filename */ }
  const parentId = getParentId(req.query.parentId)
  if (!name || name.length > 180 || /[\\/\u0000-\u001f]/.test(name) || !name.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ error: 'Choose a PDF with a valid filename.' })
  }
  if (parentId === undefined) return res.status(400).json({ error: 'Invalid destination folder.' })
  if (!Buffer.isBuffer(req.body) || req.body.length < 5 || req.body.length > MAX_PDF_BYTES || req.body.subarray(0, 5).toString() !== '%PDF-') {
    return res.status(400).json({ error: 'The uploaded file is not a valid PDF or exceeds the 25 MB limit.' })
  }

  let upload
  try {
    const owner = await User.findOne({ uid: req.user.uid }).select('_id').lean()
    if (!owner) return res.status(404).json({ error: 'User profile not found.' })
    if (parentId && !(await Resource.exists({ _id: parentId, kind: 'folder' }))) return res.status(404).json({ error: 'Destination folder not found.' })

    upload = bucket().openUploadStream(name, { contentType: 'application/pdf', metadata: { ownerId: owner._id.toString() } })
    await new Promise((resolve, reject) => {
      upload.once('finish', resolve)
      upload.once('error', reject)
      Readable.from([req.body]).pipe(upload)
    })
    const resource = await Resource.create({ name, kind: 'pdf', parentId, ownerId: owner._id, size: req.body.length, fileId: upload.id })
    const allUsers = await User.find().select('_id').lean()
    void sendNotificationToUsers(
      allUsers.map(u => u._id),
      'New PDF Added',
      `"${name}" was uploaded`,
      { type: 'resource', itemId: resource._id.toString(), url: '/resources' }
    )
    res.status(201).json(resource)
  } catch (error) {
    if (upload?.id) bucket().delete(upload.id).catch(() => {})
    if (error?.code === 11000) return res.status(409).json({ error: 'A PDF with that name already exists here.' })
    console.error('Failed to upload resource:', error)
    res.status(500).json({ error: 'Unable to upload PDF.' })
  }
})

router.get('/:id/file', requireUser, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid resource.' })
  try {
    const resource = await Resource.findOne({ _id: req.params.id, kind: 'pdf' }).lean()
    if (!resource) return res.status(404).json({ error: 'PDF not found.' })
    const file = await mongoose.connection.db.collection('resourceFiles.files').findOne({ _id: resource.fileId })
    if (!file) return res.status(404).json({ error: 'PDF content not found.' })
    res.set({ 'Content-Type': 'application/pdf', 'Content-Length': String(file.length), 'Content-Disposition': `attachment; filename="${resource.name.replace(/["\\]/g, '_')}"`, 'X-Content-Type-Options': 'nosniff' })
    const download = bucket().openDownloadStream(resource.fileId)
    download.on('error', (error) => { console.error('Failed to download resource:', error); if (!res.headersSent) res.status(500).json({ error: 'Unable to download PDF.' }); else res.destroy(error) })
    download.pipe(res)
  } catch (error) {
    console.error('Failed to download resource:', error)
    res.status(500).json({ error: 'Unable to download PDF.' })
  }
})

router.delete('/:id', requireUser, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid resource.' })
  try {
    const resource = await Resource.findById(req.params.id)
    if (!resource) return res.status(404).json({ error: 'Resource not found.' })
    if (resource.kind === 'folder' && await Resource.exists({ parentId: resource._id })) return res.status(409).json({ error: 'Move or delete this folder\'s contents first.' })
    if (resource.fileId) await bucket().delete(resource.fileId)
    await resource.deleteOne()
    res.json({ message: 'Resource deleted.' })
  } catch (error) {
    console.error('Failed to delete resource:', error)
    res.status(500).json({ error: 'Unable to delete resource.' })
  }
})

export default router
