import { Schema, model } from 'mongoose';
import { ICart } from '../types/cart';

const cartSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
        storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true }
    }],
    totalAmount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Middleware to update totalAmount before saving
cartSchema.pre('save', function(next) {
    this.totalAmount = this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    this.updatedAt = new Date();
    next();
});

export const Cart = model<ICart>('Cart', cartSchema);