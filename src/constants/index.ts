// API Response Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// API Response Messages
export const API_MESSAGES = {
  SUCCESS: "Operation completed successfully",
  CREATED: "Resource created successfully",
  UPDATED: "Resource updated successfully",
  DELETED: "Resource deleted successfully",
  NOT_FOUND: "Resource not found",
  UNAUTHORIZED: "Authentication required",
  FORBIDDEN: "Access denied",
  VALIDATION_ERROR: "Validation failed",
  CONFLICT_ERROR: "Resource already exists",
  RATE_LIMIT_ERROR: "Too many requests",
  INTERNAL_ERROR: "Internal server error",
  SERVICE_UNAVAILABLE: "Service temporarily unavailable",
} as const;

// API Key Permissions
export const API_PERMISSIONS = {
  MAIN_READ: "main:read",
  MAIN_WRITE: "main:write",
  PASSPORT_READ: "passport:read",
  PASSPORT_WRITE: "passport:write",
  OWNERSHIP_READ: "ownership:read",
  OWNERSHIP_WRITE: "ownership:write",
  PROVENANCE_READ: "provenance:read",
  PROVENANCE_WRITE: "provenance:write",
  FORWARDER_READ: "forwarder:read",
  FORWARDER_WRITE: "forwarder:write",
  ADMIN_ALL: "admin:all",
} as const;

// Contract Names
export const CONTRACT_NAMES = {
  TRATATECH_MAIN: "TrataTechMain",
  TRATATECH_PASSPORT: "TrataTechProductPassport",
  TRATATECH_OWNERSHIP: "TrataTechOwnershipRegistry",
  TRATATECH_PROVENANCE: "TrataTechProvenance",
  TRATATECH_FORWARDER: "ERC2771Forwarder",
} as const;

// Token Types
export const TOKEN_TYPES = {
  PRODUCT: 1,
  ART: 2,
  CERTIFICATE: 3,
  DEED: 4,
} as const;

// Transfer Types
export const TRANSFER_TYPES = {
  SALE: 1,
  GIFT: 2,
  INHERITANCE: 3,
  AUCTION: 4,
} as const;

// Transfer Status
export const TRANSFER_STATUS = {
  PENDING: 1,
  APPROVED: 2,
  REJECTED: 3,
  COMPLETED: 4,
} as const;

// Provenance Types
export const PROVENANCE_TYPES = {
  MANUFACTURING: 1,
  QUALITY_CHECK: 2,
  PACKAGING: 3,
  SHIPPING: 4,
  DELIVERY: 5,
  SERVICE: 6,
} as const;

// User Roles
export const USER_ROLES = {
  USER: "user",
  ADMIN: "admin",
  MODERATOR: "moderator",
} as const;

// Rate Limiting
export const RATE_LIMITS = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,
  AUTH_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  AUTH_MAX_REQUESTS: 5,
} as const;

// File Upload Limits
export const FILE_LIMITS = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ["image/jpeg", "image/png", "image/gif", "application/pdf"],
} as const;

// Validation Limits
export const VALIDATION_LIMITS = {
  MIN_STRING_LENGTH: 1,
  MAX_STRING_LENGTH: 1000,
  MAX_TITLE_LENGTH: 256,
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_NAME_LENGTH: 100,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 10000,
  MIN_PRICE: 0,
  MAX_PRICE: "1000000000000000000000000", // 1M ETH in wei
} as const;

// IPFS Configuration
export const IPFS_CONFIG = {
  GATEWAY_URL: "https://ipfs.io/ipfs/",
  TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
} as const;

// Blockchain Configuration
export const BLOCKCHAIN_CONFIG = {
  GAS_LIMIT: 500000,
  GAS_PRICE_GWEI: 20,
  TIMEOUT: 60000, // 60 seconds
  MAX_RETRIES: 3,
} as const;

// Database Configuration
export const DATABASE_CONFIG = {
  MAX_POOL_SIZE: 10,
  SERVER_SELECTION_TIMEOUT: 5000,
  SOCKET_TIMEOUT: 45000,
  CONNECT_TIMEOUT: 10000,
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

// Environment
export const ENVIRONMENT = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  TEST: "test",
} as const;

// Log Levels
export const LOG_LEVELS = {
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  DEBUG: "debug",
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  HEALTH: "/health",
  API_TEST: "/api/test",
  CONTRACTS: "/api/contracts",
  API_KEY: "/api/apikey",
  MAIN: "/api/main",
  PASSPORT: "/api/passport",
  OWNERSHIP: "/api/ownership",
  PROVENANCE: "/api/provenance",
  FORWARDER: "/api/forwarder",
} as const;

// Error Codes
export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR",
  NOT_FOUND_ERROR: "NOT_FOUND_ERROR",
  CONFLICT_ERROR: "CONFLICT_ERROR",
  RATE_LIMIT_ERROR: "RATE_LIMIT_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  BLOCKCHAIN_ERROR: "BLOCKCHAIN_ERROR",
  IPFS_ERROR: "IPFS_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
} as const;
