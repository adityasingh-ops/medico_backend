import { Document } from 'mongoose';

export enum MedicineTag {
  PRESCRIPTION = 'PRESCRIPTION',
  OVER_THE_COUNTER = 'OTC',
  ANTIBIOTIC = 'ANTIBIOTIC',
  PAINKILLER = 'PAINKILLER',
  VITAMIN = 'VITAMIN',
  SUPPLEMENT = 'SUPPLEMENT',
  CHRONIC = 'CHRONIC',
  ACUTE = 'ACUTE'
}

export interface IMedicine extends Document {
  name: string;
  description: string;
  price: number;
  categoryId: string;
  stores: string[];
  requiresPrescription: boolean;
  images: string[];
  isAvailable: boolean;
  tags: MedicineTag[];
  manufacturer: string;
  expiryDate: Date;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}
