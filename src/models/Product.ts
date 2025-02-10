import { Schema } from "mongoose";

const productSchema = new Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    requiresPrescription: { type: Boolean, default: false },
    images: [String],
    isAvailable: { type: Boolean, default: true },
    tags: [String],
    manufacturer: String,
    expiryDate: Date,
    stock: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });