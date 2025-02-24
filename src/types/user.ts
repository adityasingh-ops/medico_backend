// src/types/user.ts
export interface SendOTPRequest {
    phone: string;
  }
  
  export interface VerifyOTPRequest {
    phone: string;
    otp: string;
    session_id: string;
  }
  
  export interface GoogleAuthRequest {
    token: string;
  }
  
  export interface UpdateProfileRequest {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
  }
  
  export interface Address {
    street: string;
    city: string;
    state: string;
    pincode: string;
    isDefault: boolean;
  }
  
  export interface UserResponse {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
    storeId?: string; 
    profilePicture?: string;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    authType: 'phone' | 'google' | 'email';
    addresses: Address[];
    token: string;
  }