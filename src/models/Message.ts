import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  chatRoomId: Schema.Types.ObjectId;
  senderId: Schema.Types.ObjectId;
  senderType: 'user' | 'store' | 'system';
  messageType: 'text' | 'product_suggestion' | 'order_update' | 'prescription_clarification' | 'cart_action' | 'preset_otc';
  content: string;
  metadata?: {
    product?: Schema.Types.ObjectId;
    dosage?: string;
    quantity?: number;
    prescriptionRef?: Schema.Types.ObjectId;
    cartAction?: 'add_to_cart' | 'remove_from_cart';
    priceSnapshot?: number;
  };
  isPreset: boolean;
  read: boolean;
  createdAt: Date;
}

const messageSchema = new Schema({
  chatRoomId: { 
    type: Schema.Types.ObjectId, 
    ref: 'ChatRoom', 
    required: true 
  },
  senderId: { 
    type: Schema.Types.ObjectId, 
    required: true 
  },
  senderType: {
    type: String,
    enum: ['user', 'store', 'system'],
    required: true
  },
  messageType: {
    type: String,
    enum: [
      'text', 
      'product_suggestion',
      'order_update',
      'prescription_clarification',
      'cart_action',
      'preset_otc'
    ],
    default: 'text'
  },
  content: { 
    type: String, 
    required: true 
  },
  metadata: {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product'
    },
    dosage: String,
    quantity: Number,
    prescriptionRef: {
      type: Schema.Types.ObjectId,
      ref: 'Prescription'
    },
    cartAction: {
      type: String,
      enum: ['add_to_cart', 'remove_from_cart']
    },
    priceSnapshot: Number
  },
  isPreset: { 
    type: Boolean, 
    default: false 
  },
  read: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Add indexes for better query performance
messageSchema.index({ chatRoomId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, senderType: 1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);