import mongoose from 'mongoose'
import { DEADLINE_TYPES } from '../../shared/constants.js'

const deadlineSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: DEADLINE_TYPES, required: true },
    customType: { type: String, default: '' },
    deadline: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastReminderSentAt: { type: Date, default: null },
  },
  { timestamps: true },
)

deadlineSchema.index({ deadline: 1 })
deadlineSchema.index({ createdBy: 1 })

const Deadline = mongoose.models?.Deadline || mongoose.model('Deadline', deadlineSchema)
export default Deadline
