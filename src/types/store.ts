import { Document } from 'mongoose';

export interface IAddress {
    street: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
  }
  
  export interface ILocation {
    type: string;
    coordinates: number[];
  }
  
  export interface IOperatingHours {
    open: string;
    close: string;
    is24x7: boolean;
  }
  
  export interface IDeliveryZone {
    radius: number; // in kilometers
    deliveryFee: number;
    minOrderValue: number;
    maxDeliveryTime: number; // in minutes
  }
  
  export interface IStore extends Document {
    name: string;
    email: string;
    password: string;
    phone: string;
    address: IAddress;
    location: ILocation;
    isActive: boolean;
    rating: number;
    operatingHours: IOperatingHours;
    deliveryZone: IDeliveryZone;
    storeType: StoreType[];
    gstNumber: string;
    licenseNumber: string;
    hasRefrigeration: boolean;
    isVerified: boolean;
    acceptsInsurance: boolean;
    emergencyServices: boolean;
    pharmacistName: string;
    pharmacistLicense: string;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export enum StoreType {
    RETAIL = 'RETAIL',
    WHOLESALE = 'WHOLESALE',
    HOSPITAL = 'HOSPITAL',
    CLINIC = 'CLINIC'
  }
  