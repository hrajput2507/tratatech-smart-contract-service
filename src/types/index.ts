import { Request } from "express";

// User authentication types
export interface User {
  walletAddress: string;
  role: string;
  apiKey: string;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

// API Key types
export interface ApiKeyRequest {
  walletAddress: string;
  apiKey: string;
}

export interface ApiKeyResponse {
  apiKey: string;
  user: {
    walletAddress: string;
    role: string;
  };
}

// Brand types
export interface BrandRegistration {
  name: string;
  description: string;
  website: string;
  authorizedCountries: string[];
  ipfsData: IPFSObject;
}

export interface Brand {
  brandId: string;
  name: string;
  description: string;
  website: string;
  authorizedCountries: string[];
  ipfsCID: string; // Keep this for backward compatibility in responses
  ipfsData?: IPFSObject; // Add new IPFS object structure
  isVerified: boolean;
  isActive: boolean;
  registrationDate: number;
  owner: string;
}

// Product Passport types
export interface ProductPassport {
  brandId: string;
  productName: string;
  productDescription: string;
  serialNumber: string;
  manufacturingDate: number;
  expiryDate: number;
  ipfsData: IPFSObject;
}

export interface ProductPassportData {
  passportId: number;
  brandId: string;
  productName: string;
  productDescription: string;
  serialNumber: string;
  manufacturingDate: number;
  expiryDate: number;
  ipfsCID: string; // Keep for backward compatibility
  ipfsData?: IPFSObject; // Add new IPFS object structure
  isValid: boolean;
  creationDate: number;
  lastUpdated: number;
}

// Certificate types
export interface ManufacturingCertificate {
  passportId: number;
  certificateType: string;
  issueDate: number;
  expiryDate: number;
  ipfsData: IPFSObject;
}

export interface CertificateData {
  certificateId: number;
  passportId: number;
  certificateType: string;
  issueDate: number;
  expiryDate: number;
  ipfsCID: string; // Keep for backward compatibility
  ipfsData?: IPFSObject; // Add new IPFS object structure
  isValid: boolean;
  issuer: string;
}

// Provenance types
export type ProvenanceType =
  | "MANUFACTURING"
  | "TRANSFER"
  | "SERVICE"
  | "REPAIR"
  | "MAINTENANCE"
  | "INSPECTION"
  | "CERTIFICATION"
  | "RECALL"
  | "DISPOSAL"
  | "CUSTOM";

export interface ProvenanceEntry {
  passportId: number;
  entryType: ProvenanceType;
  location: string;
  description: string;
  ipfsData: IPFSObject;
}

export interface ProvenanceEntryData {
  entryId: number;
  passportId: number;
  entryType: ProvenanceType;
  location: string;
  description: string;
  ipfsCID: string; // Keep for backward compatibility
  ipfsData?: IPFSObject; // Add new IPFS object structure
  timestamp: number;
  creator: string;
}

export interface ServiceRecord {
  passportId: number;
  serviceType: string;
  serviceDescription: string;
  serviceDate: number;
  nextServiceDate: number;
  ipfsData: IPFSObject;
}

export interface ServiceRecordData {
  serviceId: number;
  passportId: number;
  serviceType: string;
  serviceDescription: string;
  serviceDate: number;
  nextServiceDate: number;
  ipfsCID: string; // Keep for backward compatibility
  ipfsData?: IPFSObject; // Add new IPFS object structure
  certificateNumber: string;
  serviceProvider: string;
}

// Ownership types
export interface OwnershipDeed {
  passportId: number;
  ownerAddress: string;
  purchaseDate: number;
  purchasePrice: string;
  ipfsData: IPFSObject;
}

export interface OwnershipDeedData {
  deedId: number;
  passportId: number;
  ownerAddress: string;
  purchaseDate: number;
  purchasePrice: string;
  ipfsCID: string; // Keep for backward compatibility
  ipfsData?: IPFSObject; // Add new IPFS object structure
  tokenId: number;
  isLocked: boolean;
  creationDate: number;
}

export interface TransferRequest {
  deedId: number;
  requesterAddress: string;
  proposedPrice: string;
  reason: string;
  expirationDate?: number; // Optional - set by smart contract if not provided
}

export interface TransferRequestData {
  requestId: number;
  deedId: number;
  requesterAddress: string;
  proposedPrice: string;
  reason: string;
  expirationDate: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  creationDate: number;
  approvalDate?: number;
  rejectionDate?: number;
}

export interface RoyaltyInfo {
  receiver: string;
  percentage: number;
}

// Business Operations types
export interface EventInvite {
  eventName: string;
  eventDescription: string;
  eventDate: number;
  maxAttendees: number;
  ipfsData: IPFSObject;
}

export interface EventData {
  eventId: number;
  eventName: string;
  eventDescription: string;
  eventDate: number;
  maxAttendees: number;
  currentAttendees: number;
  ipfsCID: string; // Keep for backward compatibility
  ipfsData?: IPFSObject; // Add new IPFS object structure
  isActive: boolean;
  isCancelled: boolean;
  organizer: string;
  creationDate: number;
}

export interface ProductLaunch {
  productName: string;
  productDescription: string;
  launchDate: number;
  earlyAccessPeriod: number;
  maxEarlyAccessUsers: number;
  ipfsData: IPFSObject;
}

export interface LaunchData {
  launchId: number;
  productName: string;
  productDescription: string;
  launchDate: number;
  earlyAccessPeriod: number;
  maxEarlyAccessUsers: number;
  currentEarlyAccessUsers: number;
  ipfsCID: string; // Keep for backward compatibility
  ipfsData?: IPFSObject; // Add new IPFS object structure
  isActive: boolean;
  creator: string;
  creationDate: number;
}

export interface ArtDrop {
  artistName: string;
  artworkTitle: string;
  artworkDescription: string;
  editionSize: number;
  ipfsData: IPFSObject;
}

export interface ArtDropData {
  artDropId: number;
  artistName: string;
  artworkTitle: string;
  artworkDescription: string;
  editionSize: number;
  currentEditions: number;
  ipfsCID: string; // Keep for backward compatibility
  ipfsData?: IPFSObject; // Add new IPFS object structure
  isActive: boolean;
  creator: string;
  creationDate: number;
}

export interface Offer {
  offerName: string;
  offerDescription: string;
  discountPercentage: number;
  validFrom: number;
  validUntil: number;
  maxRedemptions: number;
  ipfsData: IPFSObject;
}

export interface OfferData {
  offerId: number;
  offerName: string;
  offerDescription: string;
  discountPercentage: number;
  validFrom: number;
  validUntil: number;
  maxRedemptions: number;
  currentRedemptions: number;
  ipfsCID: string; // Keep for backward compatibility
  ipfsData?: IPFSObject; // Add new IPFS object structure
  isActive: boolean;
  creator: string;
  creationDate: number;
}

// Admin types
export interface OperatorAuthorization {
  operatorAddress: string;
}

export interface FeeUpdate {
  feeType:
    | "brandRegistration"
    | "passportCreation"
    | "certificateCreation"
    | "deedCreation"
    | "serviceFee"
    | "transferRequestFee";
  newFee: string;
}

export interface SystemStatus {
  productPassport: {
    paused: boolean;
    emergencyStopped: boolean;
    owner: string;
  };
  provenance: {
    paused: boolean;
    owner: string;
  };
  ownershipRegistry: {
    paused: boolean;
    owner: string;
  };
  main: {
    paused: boolean;
    owner: string;
  };
}

export interface ContractAddresses {
  productPassport: string;
  provenance: string;
  ownershipRegistry: string;
  main: string;
}

// Authentication types - Keeping for backward compatibility but will be removed
export interface LoginRequest {
  walletAddress: string;
  signature: string;
  message: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    walletAddress: string;
    role: string;
  };
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
}

export interface TransactionResponse {
  transactionHash: string;
  [key: string]: any;
}

// Blockchain types
export interface ContractArtifact {
  abi: any[];
  bytecode: string;
}

export interface ContractAddresses {
  productPassport: string;
  provenance: string;
  ownershipRegistry: string;
  main: string;
}

// Error types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiError {
  name: string;
  message: string;
  statusCode: number;
  details?: any;
}

// Request types
export interface CreateBrandRequest {
  name: string;
  description: string;
  website: string;
  authorizedCountries: string[];
  ipfsData: IPFSObject;
}

export interface CreatePassportRequest {
  brandId: string;
  productName: string;
  productDescription: string;
  serialNumber: string;
  manufacturingDate: number;
  expiryDate: number;
  ipfsData: IPFSObject;
}

export interface UpdatePassportRequest {
  ipfsData: IPFSObject;
}

export interface InvalidatePassportRequest {
  reason: string;
}

export interface CreateCertificateRequest {
  passportId: number;
  certificateType: string;
  issueDate: number;
  expiryDate: number;
  ipfsData: IPFSObject;
}

export interface CreateProvenanceEntryRequest {
  passportId: number;
  entryType: ProvenanceType;
  location: string;
  description: string;
  ipfsData: IPFSObject;
}

export interface BatchProvenanceEntriesRequest {
  entries: ProvenanceEntry[];
}

export interface CreateServiceRecordRequest {
  passportId: number;
  serviceType: string;
  serviceDescription: string;
  serviceDate: number;
  nextServiceDate: number;
  ipfsData: IPFSObject;
}

export interface CreateDeedRequest {
  passportId: number;
  ownerAddress: string;
  purchaseDate: number;
  purchasePrice: string;
  ipfsData: IPFSObject;
}

export interface TransferDeedRequest {
  newOwner: string;
}

export interface CreateTransferRequestRequest {
  deedId: number;
  requesterAddress: string;
  proposedPrice: string;
  reason: string;
  expirationDate?: number; // Optional - set by smart contract if not provided
}

export interface SetRoyaltyRequest {
  receiver: string;
  percentage: number;
}

export interface CreateEventRequest {
  eventName: string;
  eventDescription: string;
  eventDate: number;
  maxAttendees: number;
  ipfsData: IPFSObject;
}

export interface CreateLaunchRequest {
  productName: string;
  productDescription: string;
  launchDate: number;
  earlyAccessPeriod: number;
  maxEarlyAccessUsers: number;
  ipfsData: IPFSObject;
}

export interface GrantEarlyAccessRequest {
  userAddress: string;
}

export interface CreateArtDropRequest {
  artistName: string;
  artworkTitle: string;
  artworkDescription: string;
  editionSize: number;
  ipfsData: IPFSObject;
}

export interface AirdropArtworkRequest {
  recipients: string[];
}

export interface CreateOfferRequest {
  offerName: string;
  offerDescription: string;
  discountPercentage: number;
  validFrom: number;
  validUntil: number;
  maxRedemptions: number;
  ipfsData: IPFSObject;
}

export interface EmergencyRecoveryRequest {
  tokenAddress?: string;
  recipient: string;
}

// Statistics types
export interface ProvenanceStatistics {
  totalEntries: string;
  totalServices: string;
  totalTransfers: string;
}

// Fee types
export interface FeeStructure {
  brandRegistration: string;
  passportCreation: string;
  certificateCreation: string;
  platformFeePercentage: string;
}

// Health check types
export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  service: string;
  version: string;
  blockchain: {
    network: string;
    connected: boolean;
  };
}

// IPFS Types
export interface IPFSUploadResult {
  hash: string;
  size: number;
  path: string;
}

export interface IPFSMetadata {
  name: string;
  description: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  external_url?: string;
  animation_url?: string;
  [key: string]: any;
}

// IPFS Data can be either a string CID or an object with metadata
export type IPFSData = string | IPFSMetadata;

// IPFS Object structure for requests
export interface IPFSObject {
  cid?: string; // Optional CID if already uploaded
  metadata: IPFSMetadata; // The metadata object to upload
}
