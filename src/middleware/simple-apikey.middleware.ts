import { Request, Response, NextFunction } from "express";
import { ResponseHandler } from "../utils/responseHandler.js";

// Simple hardcoded API key for single client
const CLIENT_API_KEY = "tratatech_client_2024_secure_key_12345";

export interface SimpleAuthenticatedRequest extends Request {
  apiKey?: string;
}

/**
 * Simple API key authentication middleware
 * For single client use - validates against hardcoded key
 */
export const authenticateSimpleApiKey = (
  req: SimpleAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
      ResponseHandler.unauthorized(res, "API key is required");
      return;
    }

    if (apiKey !== CLIENT_API_KEY) {
      ResponseHandler.unauthorized(res, "Invalid API key");
      return;
    }

    // Add API key to request object
    req.apiKey = apiKey;
    next();
  } catch (error) {
    ResponseHandler.unauthorized(res, "API key validation failed");
  }
};

/**
 * Optional API key authentication - allows requests without API key
 */
export const optionalApiKeyAuth = (
  req: SimpleAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const apiKey = req.headers["x-api-key"] as string;

    if (apiKey && apiKey === CLIENT_API_KEY) {
      req.apiKey = apiKey;
    }

    next();
  } catch (error) {
    next();
  }
};
