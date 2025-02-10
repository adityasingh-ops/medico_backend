import { Schema } from "mongoose";

const storeSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String
    },
    location: {
      type: { type: String, default: 'Point' },
      coordinates: [Number] // [longitude, latitude]
    },
    isActive: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    operatingHours: {
      open: String,
      close: String
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });
  