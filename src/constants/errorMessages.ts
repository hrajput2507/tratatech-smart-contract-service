import { ERROR_CODES } from "./index.js";

// General Error Messages
export const GENERAL_ERRORS = {
  [ERROR_CODES.VALIDATION_ERROR]: "Request validation failed",
  [ERROR_CODES.AUTHENTICATION_ERROR]: "Authentication required",
  [ERROR_CODES.AUTHORIZATION_ERROR]: "Access denied",
  [ERROR_CODES.NOT_FOUND_ERROR]: "Resource not found",
  [ERROR_CODES.CONFLICT_ERROR]: "Resource already exists",
  [ERROR_CODES.RATE_LIMIT_ERROR]: "Too many requests",
  [ERROR_CODES.INTERNAL_ERROR]: "Internal server error",
  [ERROR_CODES.BLOCKCHAIN_ERROR]: "Blockchain operation failed",
  [ERROR_CODES.IPFS_ERROR]: "IPFS operation failed",
  [ERROR_CODES.DATABASE_ERROR]: "Database operation failed",
} as const;

// API Key Error Messages
export const API_KEY_ERRORS = {
  MISSING_API_KEY: "API key is required",
  INVALID_API_KEY: "Invalid or inactive API key",
  EXPIRED_API_KEY: "API key has expired",
  INSUFFICIENT_PERMISSIONS: "Insufficient permissions for this operation",
  API_KEY_NOT_FOUND: "API key not found",
  API_KEY_ALREADY_EXISTS: "API key with this name already exists",
  INVALID_PERMISSIONS: "Invalid permissions specified",
} as const;

// Validation Error Messages
export const VALIDATION_ERRORS = {
  REQUIRED_FIELD: "This field is required",
  INVALID_EMAIL: "Invalid email format",
  INVALID_ADDRESS: "Invalid Ethereum address",
  INVALID_HASH: "Invalid hash format",
  INVALID_URL: "Invalid URL format",
  INVALID_DATE: "Invalid date format",
  INVALID_NUMBER: "Invalid number format",
  STRING_TOO_SHORT: "String is too short",
  STRING_TOO_LONG: "String is too long",
  NUMBER_TOO_SMALL: "Number is too small",
  NUMBER_TOO_LARGE: "Number is too large",
  INVALID_ARRAY: "Invalid array format",
  ARRAY_TOO_SHORT: "Array is too short",
  ARRAY_TOO_LONG: "Array is too long",
  INVALID_OBJECT: "Invalid object format",
  INVALID_ENUM: "Invalid enum value",
} as const;

// Blockchain Error Messages
export const BLOCKCHAIN_ERRORS = {
  WALLET_NOT_INITIALIZED: "Blockchain wallet not initialized",
  INSUFFICIENT_BALANCE: "Insufficient wallet balance",
  TRANSACTION_FAILED: "Transaction failed",
  TRANSACTION_TIMEOUT: "Transaction timeout",
  INVALID_CONTRACT_ADDRESS: "Invalid contract address",
  CONTRACT_NOT_DEPLOYED: "Contract not deployed",
  INVALID_FUNCTION_CALL: "Invalid function call",
  GAS_ESTIMATION_FAILED: "Gas estimation failed",
  NETWORK_ERROR: "Blockchain network error",
} as const;

// IPFS Error Messages
export const IPFS_ERRORS = {
  UPLOAD_FAILED: "IPFS upload failed",
  DOWNLOAD_FAILED: "IPFS download failed",
  INVALID_CID: "Invalid IPFS CID",
  PIN_FAILED: "IPFS pin operation failed",
  UNPIN_FAILED: "IPFS unpin operation failed",
  CONNECTION_FAILED: "IPFS connection failed",
  TIMEOUT: "IPFS operation timeout",
} as const;

// Database Error Messages
export const DATABASE_ERRORS = {
  CONNECTION_FAILED: "Database connection failed",
  QUERY_FAILED: "Database query failed",
  DUPLICATE_KEY: "Duplicate key error",
  CONSTRAINT_VIOLATION: "Database constraint violation",
  TRANSACTION_FAILED: "Database transaction failed",
  RECORD_NOT_FOUND: "Record not found",
  RECORD_ALREADY_EXISTS: "Record already exists",
} as const;

// Main Contract Error Messages
export const MAIN_CONTRACT_ERRORS = {
  EVENT_NOT_FOUND: "Event not found",
  EVENT_ALREADY_EXISTS: "Event already exists",
  EVENT_EXPIRED: "Event has expired",
  MAX_ATTENDEES_REACHED: "Maximum attendees reached",
  RSVP_ALREADY_SUBMITTED: "RSVP already submitted",
  PRODUCT_NOT_FOUND: "Product not found",
  PRODUCT_ALREADY_EXISTS: "Product already exists",
  INSUFFICIENT_SUPPLY: "Insufficient product supply",
  OFFER_NOT_FOUND: "Offer not found",
  OFFER_EXPIRED: "Offer has expired",
  OFFER_ALREADY_REDEEMED: "Offer already redeemed",
} as const;

// Passport Contract Error Messages
export const PASSPORT_CONTRACT_ERRORS = {
  BRAND_NOT_FOUND: "Brand not found",
  BRAND_ALREADY_EXISTS: "Brand already exists",
  BRAND_NOT_APPROVED: "Brand not approved",
  PASSPORT_NOT_FOUND: "Passport not found",
  PASSPORT_ALREADY_EXISTS: "Passport already exists",
  INVALID_SERIAL_NUMBER: "Invalid serial number",
  CERTIFICATE_NOT_FOUND: "Certificate not found",
  CERTIFICATE_ALREADY_EXISTS: "Certificate already exists",
} as const;

// Ownership Contract Error Messages
export const OWNERSHIP_CONTRACT_ERRORS = {
  DEED_NOT_FOUND: "Ownership deed not found",
  DEED_ALREADY_EXISTS: "Ownership deed already exists",
  DEED_LOCKED: "Ownership deed is locked",
  DEED_NOT_LOCKED: "Ownership deed is not locked",
  TRANSFER_REQUEST_NOT_FOUND: "Transfer request not found",
  TRANSFER_REQUEST_ALREADY_EXISTS: "Transfer request already exists",
  TRANSFER_REQUEST_EXPIRED: "Transfer request has expired",
  INVALID_OWNER: "Invalid owner address",
  INVALID_RECIPIENT: "Invalid recipient address",
  ROYALTY_TOO_HIGH: "Royalty percentage too high",
} as const;

// Provenance Contract Error Messages
export const PROVENANCE_CONTRACT_ERRORS = {
  ENTRY_NOT_FOUND: "Provenance entry not found",
  ENTRY_ALREADY_EXISTS: "Provenance entry already exists",
  INVALID_ENTRY_TYPE: "Invalid provenance entry type",
  INVALID_TIMESTAMP: "Invalid timestamp",
  SERVICE_RECORD_NOT_FOUND: "Service record not found",
  SERVICE_RECORD_ALREADY_EXISTS: "Service record already exists",
  INVALID_SERVICE_TYPE: "Invalid service type",
} as const;

// Forwarder Contract Error Messages
export const FORWARDER_CONTRACT_ERRORS = {
  INVALID_SIGNATURE: "Invalid meta-transaction signature",
  INVALID_NONCE: "Invalid nonce",
  SIGNATURE_EXPIRED: "Signature has expired",
  RELAYER_NOT_AUTHORIZED: "Relayer not authorized",
  INVALID_FORWARDER: "Invalid forwarder address",
  META_TRANSACTION_FAILED: "Meta-transaction failed",
} as const;

// Combined Error Messages
export const ERROR_MESSAGES = {
  ...GENERAL_ERRORS,
  ...API_KEY_ERRORS,
  ...VALIDATION_ERRORS,
  ...BLOCKCHAIN_ERRORS,
  ...IPFS_ERRORS,
  ...DATABASE_ERRORS,
  ...MAIN_CONTRACT_ERRORS,
  ...PASSPORT_CONTRACT_ERRORS,
  ...OWNERSHIP_CONTRACT_ERRORS,
  ...PROVENANCE_CONTRACT_ERRORS,
  ...FORWARDER_CONTRACT_ERRORS,
} as const;

// Helper function to get error message
export const getErrorMessage = (
  errorCode: string,
  customMessage?: string
): string => {
  return (
    customMessage ||
    ERROR_MESSAGES[errorCode as keyof typeof ERROR_MESSAGES] ||
    "Unknown error"
  );
};
