import { Request, Response, NextFunction } from "express";
import { ApiKey } from "../models/ApiKey.model.js";
import { logger } from "../utils/logger.js";

export interface AuthenticatedRequest extends Request {
  apiKey?: {
    key: string;
    name: string;
    permissions: string[];
  };
}

export const authenticateApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: "API key is required",
        message: "Please provide an API key in the x-api-key header",
      });
      return;
    }

    // Find the API key in the database
    const keyDoc = await ApiKey.findOne({
      key: apiKey,
      isActive: true,
    });

    if (!keyDoc) {
      logger.warn(`Invalid API key attempt: ${apiKey.substring(0, 8)}...`);
      res.status(401).json({
        success: false,
        error: "Invalid API key",
        message: "The provided API key is invalid or inactive",
      });
      return;
    }

    // Check if the key has expired
    if (keyDoc.expiresAt && keyDoc.expiresAt < new Date()) {
      logger.warn(`Expired API key attempt: ${apiKey.substring(0, 8)}...`);
      res.status(401).json({
        success: false,
        error: "API key expired",
        message: "The provided API key has expired",
      });
      return;
    }

    // Update last used timestamp
    keyDoc.lastUsed = new Date();
    await keyDoc.save();

    // Attach API key info to request
    req.apiKey = {
      key: keyDoc.key,
      name: keyDoc.name,
      permissions: keyDoc.permissions,
    };

    next();
  } catch (error) {
    logger.error("API key authentication error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication error",
      message: "An error occurred during authentication",
    });
  }
};

export const requirePermission = (permission: string) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.apiKey) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
        message: "API key authentication is required",
      });
      return;
    }

    const hasPermission =
      req.apiKey.permissions.includes(permission) ||
      req.apiKey.permissions.includes("admin:all");

    if (!hasPermission) {
      logger.warn(
        `Permission denied for API key ${req.apiKey.name}: ${permission}`
      );
      res.status(403).json({
        success: false,
        error: "Permission denied",
        message: `This API key does not have permission to perform: ${permission}`,
      });
      return;
    }

    next();
  };
};

export const requireAnyPermission = (permissions: string[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.apiKey) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
        message: "API key authentication is required",
      });
      return;
    }

    const hasPermission = permissions.some(
      (permission) =>
        req.apiKey!.permissions.includes(permission) ||
        req.apiKey!.permissions.includes("admin:all")
    );

    if (!hasPermission) {
      logger.warn(
        `Permission denied for API key ${req.apiKey.name}: ${permissions.join(
          " or "
        )}`
      );
      res.status(403).json({
        success: false,
        error: "Permission denied",
        message: `This API key does not have any of the required permissions: ${permissions.join(
          ", "
        )}`,
      });
      return;
    }

    next();
  };
};
