import { Schema, model } from 'mongoose';
import { IMedicine, MedicineTag } from '../types/product';

const medicineSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  stores: [{ type: Schema.Types.ObjectId, ref: 'Store' }],
  requiresPrescription: { type: Boolean, default: false },
  images: [String],
  isAvailable: { type: Boolean, default: true },
  tags: [{
    type: String,
    enum: Object.values(MedicineTag),
    required: true
  }],
  manufacturer: String,
  expiryDate: Date,
  stock: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Medicine = model<IMedicine>('Medicine', medicineSchema);