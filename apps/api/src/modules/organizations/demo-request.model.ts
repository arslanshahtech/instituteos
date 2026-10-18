import mongoose, { Schema } from 'mongoose';

const demoRequestSchema = new Schema(
  {
    organizationName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    contactName: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    phone: { type: String, trim: true, maxlength: 40 },
    plan: {
      type: String,
      enum: ['Starter', 'Growth', 'Enterprise'],
      required: true,
    },
    studentCountEstimate: {
      type: Number,
      required: true,
      min: 1,
      max: 100000,
    },
    message: { type: String, trim: true, maxlength: 1200 },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'converted', 'closed'],
      default: 'new',
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);

demoRequestSchema.index({ status: 1, createdAt: -1 });
demoRequestSchema.index({ email: 1, createdAt: -1 });

export const DemoRequestModel =
  mongoose.models.DemoRequest ??
  mongoose.model('DemoRequest', demoRequestSchema);
