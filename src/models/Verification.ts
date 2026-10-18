import { Schema, model } from 'mongoose';

/**
 * A prescription/Rx verification request. When a customer's order needs a
 * prescription (an Rx-required medicine, or an uploaded prescription), a doctor
 * is asked to verify via a call. On approval a signed e-prescription is issued
 * and linked here, and the order is allowed to proceed.
 */
const verificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  phone: { type: String },
  type: { type: String, enum: ['rx_upload', 'rx_medicine'], default: 'rx_medicine' },
  items: [
    {
      medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine' },
      name: String,
    },
  ],
  prescriptionId: { type: Schema.Types.ObjectId, ref: 'Prescription' },
  status: {
    type: String,
    enum: ['pending_call', 'approved', 'rejected'],
    default: 'pending_call',
  },
  doctorName: { type: String },
  signedPrescriptionId: { type: Schema.Types.ObjectId, ref: 'Prescription' },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  decidedAt: { type: Date },
});

export const Verification = model('Verification', verificationSchema);
export default Verification;
