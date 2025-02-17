// src/models/Category.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  id: string;
  name: string;
  color: string;
  backgroundImage?: string;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema({
  
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  color: { 
    type: String, 
    required: true 
  },
  backgroundImage: String,
  image: String,
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

export const Category = mongoose.model<ICategory>('Category', categorySchema);