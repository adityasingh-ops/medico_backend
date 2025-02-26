import mongoose, { Schema, Document } from 'mongoose';

  export interface IChatRoom extends Document {
    userId: Schema.Types.ObjectId;
    storeId: Schema.Types.ObjectId;
    orderId?: Schema.Types.ObjectId;
    context: 'prescription' | 'general' | 'otc_recommendation';
    prescriptionRef?: Schema.Types.ObjectId;
    allowedMessageTypes: {
      store: string[];
      user: string[];
    };
    isActive: boolean;
    lastMessage: Date;
    createdAt: Date;
    updatedAt: Date;
  }
  
  const chatRoomSchema = new Schema({
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    storeId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Store', 
      required: true 
    },
    orderId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Order'
    },
    context: {
      type: String,
      enum: ['prescription', 'general', 'otc_recommendation'],
      default: 'general'
    },
    prescriptionRef: {
      type: Schema.Types.ObjectId,
      ref: 'Prescription'
    },
    allowedMessageTypes: {
      store: [String],
      user: [String]
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    lastMessage: { 
      type: Date, 
      default: Date.now 
    },
    createdAt: { 
      type: Date, 
      default: Date.now 
    },
    updatedAt: { 
      type: Date, 
      default: Date.now 
    }
  });
  
  chatRoomSchema.index({ userId: 1, storeId: 1 });
  chatRoomSchema.index({ isActive: 1 });
  
  export const ChatRoom = mongoose.model<IChatRoom>('ChatRoom', chatRoomSchema);
  