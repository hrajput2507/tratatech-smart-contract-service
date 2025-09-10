// ============ CORE TYPES ============

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
  transactionHash?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============ BLOCKCHAIN TYPES ============

export interface ContractAddresses {
  TrataTechMain: string;
  TrataTechProductPassport: string;
  TrataTechOwnershipRegistry: string;
  TrataTechProvenance: string;
  TrataTechSecurityEnhanced: string;
  ERC2771Forwarder: string;
}

export interface TransactionRequest {
  from: string;
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
}

export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  gasUsed: string;
  status: boolean;
  logs: any[];
}

// ============ IPFS TYPES ============

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
}

// ============ TRATATECH MAIN TYPES ============

export interface EventInvite {
  eventId: number;
  eventName: string;
  eventDescription: string;
  eventDate: number;
  maxAttendees: number;
  currentAttendees: number;
  ipfsCID: string;
  isActive: boolean;
  isCancelled: boolean;
  attendees: string[];
  attendeeTokens: { [key: string]: number };
}

export interface ProductLaunch {
  launchId: number;
  productName: string;
  productDescription: string;
  launchDate: number;
  earlyAccessEndDate: number;
  ipfsCID: string;
  isActive: boolean;
  isLaunched: boolean;
  maxEarlyAccess: number;
  currentEarlyAccess: number;
  earlyAccessUsers: string[];
  preOrders: { [key: string]: number };
  totalPreOrderAmount: number;
}

export interface DigitalProductPassport {
  dppId: number;
  productIdHash: string;
  brandIdHash: string;
  ipfsCID: string;
  timestamp: number;
  isValid: boolean;
  creator: string;
  metadataHash: string;
}

export interface DigitalArtDrop {
  dropId: number;
  artistNameHash: string;
  artworkTitle: string;
  currentEdition: number;
  maxEditions: number;
  ipfsCID: string;
  isActive: boolean;
  isLimited: boolean;
  airdroppedTo: string[];
}

export interface Offer {
  offerId: number;
  titleHash: string;
  discountPercentage: number;
  validFrom: number;
  validUntil: number;
  productScope: string;
  conditions: string;
  ipfsCID: string;
  isActive: boolean;
  isMerkleBased: boolean;
  merkleRoot: string;
  maxRedemptions: number;
  currentRedemptions: number;
  redeemedBy: string[];
  userRedemptions: { [key: string]: number };
}

export enum TokenType {
  EVENT_INVITE = 0,
  PRODUCT_LAUNCH = 1,
  DIGITAL_ART = 2,
  OFFER_COUPON = 3,
  DPP_PASSPORT = 4,
}

// ============ PRODUCT PASSPORT TYPES ============

export interface ProductPassport {
  passportId: number;
  serialNumber: string;
  brandId: string;
  productName: string;
  productDescription: string;
  materials: string;
  manufacturingLocation: string;
  manufacturingDate: number;
  creationTimestamp: number;
  ipfsCID: string;
  metadataHash: string;
  isValid: boolean;
  isRecalled: boolean;
  creator: string;
  brandAddress: string;
  additionalAttributes: { [key: string]: string };
  attributeKeys: string[];
  updateCount: number;
  isLocked: boolean;
}

export interface Brand {
  brandId: string;
  brandName: string;
  brandDescription: string;
  ipfsCID: string;
  isActive: boolean;
  isVerified: boolean;
  isPending: boolean;
  brandAddress: string;
  registrationDate: number;
  authorizedCountries: string[];
  countryAuthorizations: { [key: string]: boolean };
  passportCount: number;
  registrationFee: number;
  approver: string;
  approvalDate: number;
}

export interface ManufacturingCertificate {
  certificateId: number;
  passportId: number;
  certificateType: string;
  certificateNumber: string;
  issuingAuthority: string;
  issueDate: number;
  expiryDate: number;
  ipfsCID: string;
  isValid: boolean;
  issuer: string;
  isExpired: boolean;
  validationCount: number;
}

// ============ OWNERSHIP REGISTRY TYPES ============

export interface OwnershipDeed {
  deedId: number;
  passportId: number;
  owner: string;
  acquisitionDate: number;
  acquisitionPrice: number;
  acquisitionMethod: string;
  ipfsCID: string;
  metadataHash: string;
  isValid: boolean;
  isLocked: boolean;
  lockExpiry: number;
  previousOwner: string;
  additionalData: { [key: string]: string };
  dataKeys: string[];
  transferCount: number;
}

export interface TransferRequest {
  requestId: number;
  deedId: number;
  from: string;
  to: string;
  requestDate: number;
  proposedPrice: number;
  transferReason: string;
  status: TransferStatus;
  requester: string;
  expiryDate: number;
  isApproved: boolean;
  approver: string;
  isExecuted: boolean;
}

export interface RoyaltyInfo {
  recipient: string;
  percentage: number;
  isActive: boolean;
  maxAmount: number;
  totalCollected: number;
}

export enum TransferStatus {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2,
  EXPIRED = 3,
  CANCELLED = 4,
  EXECUTED = 5,
}

export enum TransferType {
  PRIMARY_SALE = 0,
  SECONDARY_SALE = 1,
  GIFT = 2,
  INHERITANCE = 3,
  LOAN = 4,
  CONSIGNMENT = 5,
  AUCTION = 6,
  CUSTOM = 7,
}

// ============ PROVENANCE TYPES ============

export interface ProvenanceEntry {
  entryId: number;
  passportId: number;
  entryType: ProvenanceType;
  from: string;
  to: string;
  timestamp: number;
  location: string;
  description: string;
  ipfsCID: string;
  metadataHash: string;
  isValid: boolean;
  recorder: string;
  additionalData: { [key: string]: string };
  dataKeys: string[];
}

export interface ServiceRecord {
  serviceId: number;
  passportId: number;
  serviceType: string;
  serviceProvider: string;
  serviceDescription: string;
  serviceDate: number;
  nextServiceDate: number;
  ipfsCID: string;
  certificateNumber: string;
  isValid: boolean;
  serviceProviderAddress: string;
  serviceDetails: { [key: string]: string };
  detailKeys: string[];
}

export interface TransferHistory {
  passportId: number;
  transferEntryIds: number[];
  serviceEntryIds: number[];
  totalTransfers: number;
  totalServices: number;
  currentOwner: string;
  lastTransferDate: number;
}

export enum ProvenanceType {
  MANUFACTURING = 0,
  TRANSFER = 1,
  SERVICE = 2,
  REPAIR = 3,
  MAINTENANCE = 4,
  INSPECTION = 5,
  CERTIFICATION = 6,
  RECALL = 7,
  DISPOSAL = 8,
  CUSTOM = 9,
}

// ============ DATABASE TYPES ============

export interface BlockchainActivity {
  _id?: string;
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  status: boolean;
  contractAddress: string;
  functionName: string;
  functionArgs: any;
  timestamp: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPFSData {
  _id?: string;
  hash: string;
  size: number;
  path: string;
  metadata: IPFSMetadata;
  uploadedBy: string;
  uploadedAt: Date;
  isPinned: boolean;
  accessCount: number;
}

// ============ REQUEST/RESPONSE TYPES ============

export interface CreateEventInviteRequest {
  eventName: string;
  eventDescription: string;
  eventDate: number;
  maxAttendees: number;
  ipfsData: IPFSMetadata;
}

export interface CreateProductLaunchRequest {
  productName: string;
  productDescription: string;
  launchDate: number;
  earlyAccessEndDate: number;
  maxEarlyAccess: number;
  ipfsData: IPFSMetadata;
}

export interface CreateProductPassportRequest {
  serialNumber: string;
  brandId: string;
  productName: string;
  productDescription: string;
  materials: string;
  manufacturingLocation: string;
  manufacturingDate: number;
  ipfsData: IPFSMetadata;
  additionalData?: string[];
}

export interface CreateOwnershipDeedRequest {
  passportId: number;
  owner: string;
  acquisitionPrice: number;
  acquisitionMethod: string;
  ipfsData: IPFSMetadata;
  additionalData?: string[];
}

export interface CreateProvenanceEntryRequest {
  passportId: number;
  entryType: ProvenanceType;
  from: string;
  to: string;
  location: string;
  description: string;
  ipfsData: IPFSMetadata;
  additionalData?: string[];
}

export interface CreateServiceRecordRequest {
  passportId: number;
  serviceType: string;
  serviceProvider: string;
  serviceDescription: string;
  serviceDate: number;
  nextServiceDate: number;
  ipfsData: IPFSMetadata;
  certificateNumber: string;
  serviceDetails?: string[];
}

// ============ AUTHENTICATION TYPES ============

export interface User {
  _id?: string;
  address: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = "admin",
  BRAND = "brand",
  MANUFACTURER = "manufacturer",
  CERTIFIER = "certifier",
  OPERATOR = "operator",
  USER = "user",
}

export interface AuthRequest {
  address: string;
  signature: string;
  message: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  expiresIn: number;
}
