import mongoose from 'mongoose'

const resourceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 180 },
  kind: { type: String, enum: ['folder', 'pdf'], required: true, index: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', default: null, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fileId: { type: mongoose.Schema.Types.ObjectId },
  size: { type: Number, default: 0 },
}, { timestamps: true })

resourceSchema.index({ parentId: 1, name: 1, kind: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } })

export default mongoose.models?.Resource || mongoose.model('Resource', resourceSchema)
