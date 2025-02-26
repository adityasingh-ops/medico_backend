import mongoose, { Schema, Document } from 'mongoose';

export interface IPresetMessage extends Document {
    storeId: Schema.Types.ObjectId;
    category: 'greeting' | 'symptom' | 'product' | 'followup';
    triggerKeywords: string[];
    message: string;
    products: Schema.Types.ObjectId[];
    isActive: boolean;
  }
  
  const presetMessageSchema = new Schema({
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true
    },
    category: {
      type: String,
      enum: ['greeting', 'symptom', 'product', 'followup'],
      required: true
    },
    triggerKeywords: [String],
    message: {
      type: String,
      required: true
    },
    products: [{
      type: Schema.Types.ObjectId,
      ref: 'Product'
    }],
    isActive: {
      type: Boolean,
      default: true
    }
  });
  
  presetMessageSchema.index({ storeId: 1, category: 1 });
  presetMessageSchema.index({ triggerKeywords: 1 });
  
  export const PresetMessage = mongoose.model<IPresetMessage>('PresetMessage', presetMessageSchema);
  
  