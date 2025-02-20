import { Document, Types } from 'mongoose';

interface CartItem {
    medicineId: Types.ObjectId;
    storeId: Types.ObjectId;
    quantity: number;
    price: number;
}

export interface ICart extends Document {
    userId: Types.ObjectId;
    items: CartItem[];
    totalAmount: number;
    createdAt: Date;
    updatedAt: Date;
}