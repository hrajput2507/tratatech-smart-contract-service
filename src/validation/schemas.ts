import { z } from "zod";
import {
  VALIDATION_LIMITS,
  TOKEN_TYPES,
  TRANSFER_TYPES,
  PROVENANCE_TYPES,
} from "../constants/index.js";

// Base validation schemas
export const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");
export const ipfsHashSchema = z
  .string()
  .regex(/^Qm[a-zA-Z0-9]{44}$/, "Invalid IPFS hash");
export const positiveNumberSchema = z
  .number()
  .positive("Must be a positive number");
export const nonNegativeNumberSchema = z
  .number()
  .min(0, "Must be non-negative");
export const timestampSchema = z
  .number()
  .int()
  .positive("Must be a valid timestamp");

// String validation schemas
export const shortStringSchema = z
  .string()
  .min(VALIDATION_LIMITS.MIN_STRING_LENGTH, "String too short")
  .max(VALIDATION_LIMITS.MAX_NAME_LENGTH, "String too long");

export const mediumStringSchema = z
  .string()
  .min(VALIDATION_LIMITS.MIN_STRING_LENGTH, "String too short")
  .max(VALIDATION_LIMITS.MAX_STRING_LENGTH, "String too long");

export const longStringSchema = z
  .string()
  .min(VALIDATION_LIMITS.MIN_STRING_LENGTH, "String too short")
  .max(VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH, "String too long");

export const titleSchema = z
  .string()
  .min(VALIDATION_LIMITS.MIN_STRING_LENGTH, "Title too short")
  .max(VALIDATION_LIMITS.MAX_TITLE_LENGTH, "Title too long");

// IPFS metadata schema
export const ipfsMetadataSchema = z.object({
  name: shortStringSchema,
  description: mediumStringSchema,
  image: z.string().url("Invalid image URL").optional(),
  attributes: z
    .array(
      z.object({
        trait_type: z.string(),
        value: z.union([z.string(), z.number()]),
      })
    )
    .optional(),
});

// API Key schemas
export const createApiKeySchema = z.object({
  name: shortStringSchema,
  description: mediumStringSchema.optional(),
  permissions: z
    .array(
      z.enum([
        "main:read",
        "main:write",
        "passport:read",
        "passport:write",
        "ownership:read",
        "ownership:write",
        "provenance:read",
        "provenance:write",
        "forwarder:read",
        "forwarder:write",
        "admin:all",
      ])
    )
    .min(1, "At least one permission required"),
  expiresAt: z.string().datetime().optional(),
});

export const updateApiKeySchema = z.object({
  name: shortStringSchema.optional(),
  description: mediumStringSchema.optional(),
  permissions: z
    .array(
      z.enum([
        "main:read",
        "main:write",
        "passport:read",
        "passport:write",
        "ownership:read",
        "ownership:write",
        "provenance:read",
        "provenance:write",
        "forwarder:read",
        "forwarder:write",
        "admin:all",
      ])
    )
    .optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
});

// Main Contract schemas
export const createEventInviteSchema = z.object({
  eventName: titleSchema,
  eventDescription: longStringSchema,
  eventDate: timestampSchema,
  maxAttendees: z
    .number()
    .int()
    .min(VALIDATION_LIMITS.MIN_QUANTITY)
    .max(VALIDATION_LIMITS.MAX_QUANTITY),
  ipfsData: ipfsMetadataSchema,
});

export const submitRSVPSchema = z.object({
  eventId: shortStringSchema,
});

export const createProductLaunchSchema = z.object({
  productId: shortStringSchema,
  name: titleSchema,
  description: longStringSchema,
  price: z.string().regex(/^\d+$/, "Price must be a valid number string"),
  maxSupply: z
    .number()
    .int()
    .min(VALIDATION_LIMITS.MIN_QUANTITY)
    .max(VALIDATION_LIMITS.MAX_QUANTITY),
  launchTime: timestampSchema,
  ipfsData: ipfsMetadataSchema,
});

export const placePreOrderSchema = z.object({
  productId: shortStringSchema,
  quantity: z
    .number()
    .int()
    .min(VALIDATION_LIMITS.MIN_QUANTITY)
    .max(VALIDATION_LIMITS.MAX_QUANTITY),
  value: z.string().regex(/^\d+$/, "Value must be a valid number string"),
});

export const createDigitalArtDropSchema = z.object({
  dropId: shortStringSchema,
  name: titleSchema,
  description: longStringSchema,
  maxSupply: z
    .number()
    .int()
    .min(VALIDATION_LIMITS.MIN_QUANTITY)
    .max(VALIDATION_LIMITS.MAX_QUANTITY),
  price: z.string().regex(/^\d+$/, "Price must be a valid number string"),
  startTime: timestampSchema,
  ipfsData: ipfsMetadataSchema,
});

export const createOfferSchema = z.object({
  offerId: shortStringSchema,
  title: titleSchema,
  description: longStringSchema,
  discountPercent: z.number().min(0).max(100),
  validUntil: timestampSchema,
  ipfsData: ipfsMetadataSchema,
});

export const redeemOfferSchema = z.object({
  offerId: shortStringSchema,
});

// Passport Contract schemas
export const registerBrandSchema = z.object({
  brandId: shortStringSchema,
  name: titleSchema,
  description: longStringSchema,
  website: z.string().url("Invalid website URL").optional(),
  ipfsData: ipfsMetadataSchema,
});

export const approveBrandSchema = z.object({
  brandId: shortStringSchema,
});

export const createProductPassportSchema = z.object({
  passportId: shortStringSchema,
  brandId: shortStringSchema,
  serialNumber: shortStringSchema,
  manufacturingDate: timestampSchema,
  countryOfOrigin: z.string().length(2, "Country code must be 2 characters"),
  ipfsData: ipfsMetadataSchema,
});

export const createManufacturingCertificateSchema = z.object({
  certificateId: shortStringSchema,
  passportId: shortStringSchema,
  certificateNumber: shortStringSchema,
  issuedBy: titleSchema,
  issuedDate: timestampSchema,
  ipfsData: ipfsMetadataSchema,
});

// Ownership Contract schemas
export const createOwnershipDeedSchema = z.object({
  deedId: shortStringSchema,
  tokenId: shortStringSchema,
  tokenType: z.nativeEnum(TOKEN_TYPES),
  owner: ethereumAddressSchema,
  ipfsData: ipfsMetadataSchema,
});

export const createTransferRequestSchema = z.object({
  requestId: shortStringSchema,
  deedId: shortStringSchema,
  to: ethereumAddressSchema,
  transferType: z.nativeEnum(TRANSFER_TYPES),
});

export const executeTransferRequestSchema = z.object({
  requestId: shortStringSchema,
});

export const setRoyaltySchema = z.object({
  deedId: shortStringSchema,
  royaltyPercent: z.number().min(0).max(10000), // 0-100% in basis points
});

// Provenance Contract schemas
export const createProvenanceEntrySchema = z.object({
  passportId: shortStringSchema,
  entryType: z.nativeEnum(PROVENANCE_TYPES),
  description: longStringSchema,
  timestamp: timestampSchema,
  ipfsData: ipfsMetadataSchema,
});

export const createBatchProvenanceEntriesSchema = z.object({
  passportId: shortStringSchema,
  entries: z
    .array(
      z.object({
        entryType: z.nativeEnum(PROVENANCE_TYPES),
        description: longStringSchema,
        timestamp: timestampSchema,
      })
    )
    .min(1, "At least one entry required"),
  ipfsData: ipfsMetadataSchema,
});

export const createServiceRecordSchema = z.object({
  recordId: shortStringSchema,
  passportId: shortStringSchema,
  serviceType: shortStringSchema,
  description: longStringSchema,
  serviceDate: timestampSchema,
  ipfsData: ipfsMetadataSchema,
});

// Forwarder Contract schemas
export const executeMetaTransactionSchema = z.object({
  from: ethereumAddressSchema,
  to: ethereumAddressSchema,
  value: z.string().regex(/^\d+$/, "Value must be a valid number string"),
  gas: z.string().regex(/^\d+$/, "Gas must be a valid number string"),
  nonce: z.string().regex(/^\d+$/, "Nonce must be a valid number string"),
  data: z.string().regex(/^0x[a-fA-F0-9]*$/, "Data must be valid hex string"),
  signature: z
    .string()
    .regex(/^0x[a-fA-F0-9]{130}$/, "Invalid signature format"),
});

export const verifySignatureSchema = z.object({
  from: ethereumAddressSchema,
  to: ethereumAddressSchema,
  value: z.string().regex(/^\d+$/, "Value must be a valid number string"),
  gas: z.string().regex(/^\d+$/, "Gas must be a valid number string"),
  nonce: z.string().regex(/^\d+$/, "Nonce must be a valid number string"),
  data: z.string().regex(/^0x[a-fA-F0-9]*$/, "Data must be valid hex string"),
  signature: z
    .string()
    .regex(/^0x[a-fA-F0-9]{130}$/, "Invalid signature format"),
});

// Query parameter schemas
export const paginationSchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1))
    .optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional(),
});

export const idParamSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ID format"),
});

// Common schemas
export const addressParamSchema = z.object({
  address: ethereumAddressSchema,
});

export const passportIdParamSchema = z.object({
  passportId: shortStringSchema,
});

export const brandIdParamSchema = z.object({
  brandId: shortStringSchema,
});

export const deedIdParamSchema = z.object({
  deedId: shortStringSchema,
});

// Export all schemas
export const schemas = {
  // Base schemas
  ethereumAddress: ethereumAddressSchema,
  ipfsHash: ipfsHashSchema,
  positiveNumber: positiveNumberSchema,
  nonNegativeNumber: nonNegativeNumberSchema,
  timestamp: timestampSchema,
  shortString: shortStringSchema,
  mediumString: mediumStringSchema,
  longString: longStringSchema,
  title: titleSchema,
  ipfsMetadata: ipfsMetadataSchema,

  // API Key schemas
  createApiKey: createApiKeySchema,
  updateApiKey: updateApiKeySchema,

  // Main Contract schemas
  createEventInvite: createEventInviteSchema,
  submitRSVP: submitRSVPSchema,
  createProductLaunch: createProductLaunchSchema,
  placePreOrder: placePreOrderSchema,
  createDigitalArtDrop: createDigitalArtDropSchema,
  createOffer: createOfferSchema,
  redeemOffer: redeemOfferSchema,

  // Passport Contract schemas
  registerBrand: registerBrandSchema,
  approveBrand: approveBrandSchema,
  createProductPassport: createProductPassportSchema,
  createManufacturingCertificate: createManufacturingCertificateSchema,

  // Ownership Contract schemas
  createOwnershipDeed: createOwnershipDeedSchema,
  createTransferRequest: createTransferRequestSchema,
  executeTransferRequest: executeTransferRequestSchema,
  setRoyalty: setRoyaltySchema,

  // Provenance Contract schemas
  createProvenanceEntry: createProvenanceEntrySchema,
  createBatchProvenanceEntries: createBatchProvenanceEntriesSchema,
  createServiceRecord: createServiceRecordSchema,

  // Forwarder Contract schemas
  executeMetaTransaction: executeMetaTransactionSchema,
  verifySignature: verifySignatureSchema,

  // Query schemas
  pagination: paginationSchema,
  idParam: idParamSchema,
  addressParam: addressParamSchema,
  passportIdParam: passportIdParamSchema,
  brandIdParam: brandIdParamSchema,
  deedIdParam: deedIdParamSchema,
};
