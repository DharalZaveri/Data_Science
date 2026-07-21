export type GarmentType = 'shirt' | 'tshirt' | 'dress' | 'pants' | 'jacket' | 'skirt' | 'hoodie';

export interface Garment {
  id: string;
  name: string;
  type: GarmentType;
  color: string;
  pattern: string;
  fabric: string;
  description: string;
  createdAt: number;
}

export interface Model {
  id: string;
  name: string;
  thumbnailUrl: string;
  basePrompt: string;
  gender: 'male' | 'female' | 'unisex';
}

export interface PoseImage {
  id: string;
  url: string;
  poseType: string; // e.g. "front", "side", "back", "sitting", "walking"
  swatchUrl?: string; // Original fabric swatch for split view
  aspectRatio?: string; // e.g. "3:4"
}

export interface Catalog {
  id: string;
  garmentId: string;
  modelId: string;
  poseImages: PoseImage[];
  createdAt: number;
  status: 'generating' | 'completed' | 'failed';
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'manufacturer';
  companyName?: string;
  isPro?: boolean;
  credits: number;
  displayName?: string;
  phoneNumber?: string;
  address?: string;
  businessCategory?: string;
}

export interface Promotion {
  id: string;
  userId: string;
  assetType: string;
  brandName: string;
  tagline: string;
  creativeDirections: string;
  styleDescription: string;
  colorPalette: string;
  aspectRatio: string;
  extraDetails?: string;
  badgeText?: string;
  ctaText?: string;
  overlayLayout?: string;
  productImage?: string;
  imageUrl?: string;
  createdAt: number;
  status: 'generating' | 'completed' | 'failed';
}

