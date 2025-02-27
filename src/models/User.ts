// src/models/User.ts
import { Schema, model, Document, Model } from "mongoose";

// Interface for User Document
interface IAddress {
    street: string;
    city: string;
    state: string;
    pincode: string;
    isDefault: boolean;
}

interface IUser extends Document {
    name?: string;
    userType: string;
    email?: string;
    password?: string;
    phone: string;  // Only phone is required
    storeId?: Schema.Types.ObjectId; 
    address?: IAddress[];
    isPhoneVerified: boolean;
    isStoreVerified?: boolean;  
    location?: {
        type: string;
        coordinates: number[];
    };
    createdAt: Date;
    updatedAt: Date;
}

// Schema Definition
const userSchema = new Schema<IUser>({
    name: { type: String },  
    email: {
        type: String,
    },
    userType: { 
        type: String, 
        enum: ['user', 'admin', 'store'], 
        default: 'user'  // This will now work correctly
    },
    password: { type: String },  // Optional
    phone: { type: String, required: true, unique: true }, 
    isPhoneVerified: { type: Boolean, default: false },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store' },
    address: [{
        street: String,
        city: String,
        state: String,
        pincode: String,
        isDefault: { type: Boolean, default: false }
    }],
    location: {
        type: { type: String, enum: ['Point'] },
        coordinates: {
            type: [Number],
            default: undefined  // Don't set any default coordinates
        }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true  // Automatically manage createdAt and updatedAt
});

// Index for geospatial queries
userSchema.index({ location: '2dsphere' });
// Index for quick lookup by storeId
userSchema.index({ storeId: 1 });

const User: Model<IUser> = model<IUser>('User', userSchema);
export default User;