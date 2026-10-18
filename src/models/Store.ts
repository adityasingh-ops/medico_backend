import { Schema, model } from 'mongoose';
import { IStore, StoreType } from '../types/store';

const storeSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  // select:false → password never ships in query results or through populate().
  // Login paths must opt in explicitly with .select('+password').
  password: { type: String, required: true, select: false },
  phone: { type: String, required: true },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    landmark: String
  },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number]
  },
  isActive: { type: Boolean, default: true },
  rating: { type: Number, default: 0 },
  operatingHours: {
    open: String,
    close: String,
    is24x7: { type: Boolean, default: false }
  },
  deliveryZone: {
    radius: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    minOrderValue: { type: Number, required: true },
    maxDeliveryTime: { type: Number, required: true }
  },
  storeType: [{
    type: String,
    enum: Object.values(StoreType),
    required: true
  }],
  gstNumber: { type: String, required: true },
  licenseNumber: { type: String, required: true },
  hasRefrigeration: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  acceptsInsurance: { type: Boolean, default: false },
  emergencyServices: { type: Boolean, default: false },
  pharmacistName: { type: String, required: true },
  pharmacistLicense: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create geospatial index for location-based queries
storeSchema.index({ location: '2dsphere' });

export const Store = model<IStore>('Store', storeSchema);