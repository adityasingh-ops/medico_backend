import { Schema } from "mongoose";

const messageSchema = new Schema({
    chatRoomId: { type: Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    senderType: {
      type: String,
      enum: ['user', 'store'],
      required: true
    },
    content: { type: String, required: true },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  });