import { Schema } from "mongoose";

const chatRoomSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    isActive: { type: Boolean, default: true },
    lastMessage: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });