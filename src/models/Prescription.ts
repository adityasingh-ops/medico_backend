import { Schema, model } from "mongoose";

const prescriptionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    image: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    notes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });

export const Prescription = model('Prescription', prescriptionSchema);
export default Prescription;
