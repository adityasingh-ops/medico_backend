import mongoose, { Document, Schema } from 'mongoose';

// Define the order item schema
export interface OrderItem {
  medicineId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  price: number;
}

// Define the delivery status tracking
export interface DeliveryStatus {
  status: 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  timestamp: Date;
  notes?: string;
  updatedBy?: mongoose.Types.ObjectId; // Store or admin who updated the status
}

// Define the main order schema
export interface IOrder extends Document {
  userId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  items: OrderItem[];
  totalAmount: number;
  deliveryFee: number;
  tax: number;
  finalAmount: number;
  paymentMethod: 'COD' | 'ONLINE' | 'WALLET';
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  transactionId?: string;
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
  };
  currentStatus: 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  statusHistory: DeliveryStatus[];
  estimatedDeliveryTime?: Date;
  actualDeliveryTime?: Date;
  prescriptionRequired: boolean;
  prescriptionImage?: string;
  isPrescriptionVerified: boolean;
  rating?: number;
  review?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema: Schema = new Schema(
  {
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
    items: [
      {
        medicineId: {
          type: Schema.Types.ObjectId,
          ref: 'Medicine',
          required: true
        },
        name: {
          type: String,
          required: true
        },
        quantity: {
          type: Number,
          required: true,
          min: 1
        },
        price: {
          type: Number,
          required: true,
          min: 0
        }
      }
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    deliveryFee: {
      type: Number,
      required: true,
      min: 0
    },
    tax: {
      type: Number,
      required: true,
      min: 0
    },
    finalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentMethod: {
      type: String,
      enum: ['COD', 'ONLINE', 'WALLET'],
      default: 'COD'
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'],
      default: 'PENDING'
    },
    transactionId: {
      type: String
    },
    deliveryAddress: {
      street: {
        type: String,
        required: true
      },
      city: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      pincode: {
        type: String,
        required: true
      },
      landmark: String,
      latitude: Number,
      longitude: Number
    },
    currentStatus: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
      default: 'PENDING'
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: ['PENDING', 'ACCEPTED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
          required: true
        },
        timestamp: {
          type: Date,
          default: Date.now
        },
        notes: String,
        updatedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User'
        }
      }
    ],
    estimatedDeliveryTime: {
      type: Date
    },
    actualDeliveryTime: {
      type: Date
    },
    prescriptionRequired: {
      type: Boolean,
      default: false
    },
    prescriptionImage: {
      type: String
    },
    isPrescriptionVerified: {
      type: Boolean,
      default: false
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    review: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// Add index for querying orders by userId
OrderSchema.index({ userId: 1, createdAt: -1 });
// Add index for querying orders by storeId
OrderSchema.index({ storeId: 1, currentStatus: 1, createdAt: -1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);