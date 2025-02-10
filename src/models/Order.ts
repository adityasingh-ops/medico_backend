import { Schema } from "mongoose";

const orderSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    items: [{
      productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true }
    }],
    prescriptionId: { type: Schema.Types.ObjectId, ref: 'Prescription' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'pending'
    },
    totalAmount: { type: Number, required: true },
    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      pincode: String
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    paymentMethod: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });