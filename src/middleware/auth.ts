import { Response, NextFunction } from "express";

// Import types
import { User, AuthenticatedRequest } from "../types";

// In-memory storage for API keys (in production, use a database)
const apiKeys = new Map<string, User>();

// Initialize with some default API keys for testing
const initializeApiKeys = () => {
  // Admin API key
  apiKeys.set(process.env["DEFAULT_ADMIN_API_KEY"] || "admin-api-key-123", {
    walletAddress: "0x1234567890123456789012345678901234567890",
    role: "admin",
    apiKey: process.env["DEFAULT_ADMIN_API_KEY"] || "admin-api-key-123",
  });

  // User API key
  apiKeys.set(process.env["DEFAULT_USER_API_KEY"] || "user-api-key-456", {
    walletAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    role: "user",
    apiKey: process.env["DEFAULT_USER_API_KEY"] || "user-api-key-456",
  });

  // Operator API key
  apiKeys.set(
    process.env["DEFAULT_OPERATOR_API_KEY"] || "operator-api-key-789",
    {
      walletAddress: "0x9876543210987654321098765432109876543210",
      role: "operator",
      apiKey: process.env["DEFAULT_OPERATOR_API_KEY"] || "operator-api-key-789",
    }
  );

  // Certifier API key
  apiKeys.set(
    process.env["DEFAULT_CERTIFIER_API_KEY"] || "certifier-api-key-123",
    {
      walletAddress: "0x1111111111111111111111111111111111111111",
      role: "certifier",
      apiKey:
        process.env["DEFAULT_CERTIFIER_API_KEY"] || "certifier-api-key-123",
    }
  );
};

// Initialize API keys
initializeApiKeys();

/**
 * Authentication middleware for protecting API endpoints
 * Verifies API keys and adds user information to request object
 */
export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get API key from header
    const apiKey =
      (req.headers["x-api-key"] as string) ||
      (req.headers["authorization"] as string);

    if (!apiKey) {
      res.status(401).json({
        success: false,
        message: "Access denied. No API key provided.",
      });
      return;
    }

    // Remove 'Bearer ' prefix if present
    const cleanApiKey = apiKey.startsWith("Bearer ")
      ? apiKey.substring(7)
      : apiKey;

    if (!cleanApiKey) {
      res.status(401).json({
        success: false,
        message: "Access denied. No API key provided.",
      });
      return;
    }

    // Verify API key
    const user = apiKeys.get(cleanApiKey);

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Access denied. Invalid API key.",
      });
      return;
    }

    // Add user info to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);

    res.status(500).json({
      success: false,
      message: "Authentication error occurred.",
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user information if API key is provided, but doesn't require it
 */
export const optionalAuthMiddleware = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const apiKey =
      (req.headers["x-api-key"] as string) ||
      (req.headers["authorization"] as string);

    if (apiKey) {
      const cleanApiKey = apiKey.startsWith("Bearer ")
        ? apiKey.substring(7)
        : apiKey;
      const user = apiKeys.get(cleanApiKey);

      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    // Continue without authentication if API key is invalid
    next();
  }
};

/**
 * Role-based authorization middleware
 * Checks if user has required role
 */
export const requireRole = (roles: string[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const userRole = req.user.role;

    if (!roles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
      });
      return;
    }

    next();
  };
};

/**
 * Wallet address verification middleware
 * Verifies that the user's wallet address matches the required address
 */
export const requireWalletAddress = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || !req.user.walletAddress) {
    res.status(401).json({
      success: false,
      message: "Wallet address required.",
    });
    return;
  }

  const requiredAddress = req.params["address"] || req.body["address"];

  if (
    requiredAddress &&
    req.user.walletAddress.toLowerCase() !== requiredAddress.toLowerCase()
  ) {
    res.status(403).json({
      success: false,
      message: "Access denied. Wallet address mismatch.",
    });
    return;
  }

  next();
};

/**
 * Rate limiting middleware for specific endpoints
 * Limits requests based on user ID or IP address
 */
export const rateLimitByUser = (
  windowMs: number = 15 * 60 * 1000,
  max: number = 100
) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const identifier = req.user ? req.user.walletAddress : req.ip;
    const now = Date.now();

    // Ensure identifier is a string (not undefined)
    if (!identifier) {
      res.status(400).json({
        success: false,
        message: "Unable to identify user for rate limiting.",
      });
      return;
    }

    if (!requests.has(identifier)) {
      requests.set(identifier, { count: 1, resetTime: now + windowMs });
    } else {
      const userRequests = requests.get(identifier)!;
      if (now > userRequests.resetTime) {
        userRequests.count = 1;
        userRequests.resetTime = now + windowMs;
      } else {
        userRequests.count++;
      }

      if (userRequests.count > max) {
        res.status(429).json({
          success: false,
          message: "Too many requests. Please try again later.",
        });
        return;
      }
    }

    next();
  };
};

/**
 * Generate a new API key for a user
 */
export const generateApiKey = (
  walletAddress: string,
  role: string = "user"
): string => {
  const apiKey = `api-key-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 15)}`;

  const user: User = {
    walletAddress,
    role,
    apiKey,
  };

  apiKeys.set(apiKey, user);
  return apiKey;
};

/**
 * Validate API key
 */
export const validateApiKey = (apiKey: string): User | null => {
  return apiKeys.get(apiKey) || null;
};

/**
 * Revoke API key
 */
export const revokeApiKey = (apiKey: string): boolean => {
  return apiKeys.delete(apiKey);
};
