import mongoose from 'mongoose'
import { COMMENT_TYPES } from '../../shared/constants.js'

const activityLogSchema = new mongoose.Schema(
  {
    deadline: { type: mongoose.Schema.Types.ObjectId, ref: 'Deadline', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: COMMENT_TYPES, required: true },
    content: { type: String, default: '' },
    timestamp: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true },
)

activityLogSchema.index({ deadline: 1, timestamp: 1 })

const ActivityLog = mongoose.models?.ActivityLog || mongoose.model('ActivityLog', activityLogSchema)
export default ActivityLog
