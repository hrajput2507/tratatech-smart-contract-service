import { Request, Response, NextFunction } from "express";
import { z, ZodSchema, ZodError } from "zod";
import { HTTP_STATUS, ERROR_CODES } from "../constants/index.js";
import { getErrorMessage } from "../constants/errorMessages.js";
import { logger } from "../utils/logger.js";

// Validation middleware factory
export const validateRequest = (schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate request body
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      // Validate query parameters
      if (schema.query) {
        req.query = schema.query.parse(req.query) as any;
      }

      // Validate route parameters
      if (schema.params) {
        req.params = schema.params.parse(req.params) as any;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.issues.map((err: any) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        logger.warn(
          `Validation error for ${req.method} ${req.path}:`,
          validationErrors
        );

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: getErrorMessage(ERROR_CODES.VALIDATION_ERROR),
            details: validationErrors,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
        });
        return;
      }

      logger.error("Unexpected validation error:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: getErrorMessage(ERROR_CODES.INTERNAL_ERROR),
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
};

// Specific validation middlewares
export const validateBody = (schema: ZodSchema) => {
  return validateRequest({ body: schema });
};

export const validateQuery = (schema: ZodSchema) => {
  return validateRequest({ query: schema });
};

export const validateParams = (schema: ZodSchema) => {
  return validateRequest({ params: schema });
};

// Common validation combinations
export const validatePagination = validateQuery(
  z.object({
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
  })
);

export const validateId = validateParams(
  z.object({
    id: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ID format"),
  })
);

export const validateAddress = validateParams(
  z.object({
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  })
);

// Custom validation helpers
export const validateEthereumAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export const validateIPFSHash = (hash: string): boolean => {
  return /^Qm[a-zA-Z0-9]{44}$/.test(hash);
};

export const validateTimestamp = (timestamp: number): boolean => {
  return Number.isInteger(timestamp) && timestamp > 0 && timestamp < 2147483647; // Max 32-bit timestamp
};

export const validateHexString = (hex: string): boolean => {
  return /^0x[a-fA-F0-9]*$/.test(hex);
};

export const validateSignature = (signature: string): boolean => {
  return /^0x[a-fA-F0-9]{130}$/.test(signature);
};

// Sanitization helpers
export const sanitizeString = (str: string): string => {
  return str.trim().replace(/\s+/g, " ");
};

export const sanitizeObject = (obj: any): any => {
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
};

// Request sanitization middleware
export const sanitizeRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Sanitize body
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === "object") {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize route parameters
    if (req.params && typeof req.params === "object") {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    logger.error("Request sanitization error:", error);
    next();
  }
};
