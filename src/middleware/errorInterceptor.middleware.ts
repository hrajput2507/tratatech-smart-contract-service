import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { MongoError } from "mongodb";
import { ResponseHandler } from "../utils/responseHandler.js";
import { HTTP_STATUS, ERROR_CODES } from "../constants/index.js";
import { getErrorMessage } from "../constants/errorMessages.js";
import { logger } from "../utils/logger.js";

// Custom error class
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode: string = ERROR_CODES.INTERNAL_ERROR,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error interceptor middleware
export const errorInterceptor = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  logger.error("Error intercepted:", {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // Handle different types of errors
  if (error instanceof AppError) {
    // Custom application error
    ResponseHandler.error(
      res,
      error.errorCode,
      error.message,
      error.details,
      error.statusCode,
      req
    );
    return;
  }

  if (error instanceof ZodError) {
    // Zod validation error
    const validationErrors = error.issues.map((err: any) => ({
      field: err.path.join("."),
      message: err.message,
      code: err.code,
    }));

    ResponseHandler.validationError(res, validationErrors, req);
    return;
  }

  if (error instanceof MongoError) {
    // MongoDB error
    handleMongoError(error, req, res);
    return;
  }

  if (error.name === "ValidationError") {
    // Mongoose validation error
    const validationErrors = Object.values((error as any).errors).map(
      (err: any) => ({
        field: err.path,
        message: err.message,
        code: "VALIDATION_ERROR",
      })
    );

    ResponseHandler.validationError(res, validationErrors, req);
    return;
  }

  if (error.name === "CastError") {
    // Mongoose cast error
    const castError = error as any;
    ResponseHandler.error(
      res,
      ERROR_CODES.VALIDATION_ERROR,
      `Invalid ${castError.path}: ${castError.value}`,
      { field: castError.path, value: castError.value },
      HTTP_STATUS.BAD_REQUEST,
      req
    );
    return;
  }

  if (error.name === "MongoServerError") {
    // MongoDB server error
    handleMongoServerError(error as any, req, res);
    return;
  }

  if (error.name === "JsonWebTokenError") {
    // JWT error (if still using JWT somewhere)
    ResponseHandler.unauthorized(res, "Invalid token", req);
    return;
  }

  if (error.name === "TokenExpiredError") {
    // JWT expired error
    ResponseHandler.unauthorized(res, "Token expired", req);
    return;
  }

  if (error.name === "MulterError") {
    // File upload error
    handleMulterError(error as any, req, res);
    return;
  }

  // Default to internal server error
  ResponseHandler.internalError(
    res,
    process.env.NODE_ENV === "production"
      ? getErrorMessage(ERROR_CODES.INTERNAL_ERROR)
      : error.message,
    process.env.NODE_ENV === "development" ? error.stack : undefined,
    req
  );
};

// Handle MongoDB errors
const handleMongoError = (
  error: MongoError,
  req: Request,
  res: Response
): void => {
  switch (error.code) {
    case 11000:
      // Duplicate key error
      const field = Object.keys((error as any).keyPattern)[0];
      ResponseHandler.conflict(
        res,
        `${field} already exists`,
        { field, value: (error as any).keyValue[field] },
        req
      );
      break;
    case 11001:
      // Duplicate key error (alternative)
      ResponseHandler.conflict(res, "Duplicate key error", undefined, req);
      break;
    default:
      ResponseHandler.databaseError(
        res,
        "Database operation failed",
        undefined,
        req
      );
  }
};

// Handle MongoDB server errors
const handleMongoServerError = (
  error: any,
  req: Request,
  res: Response
): void => {
  switch (error.code) {
    case 11000:
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      ResponseHandler.conflict(
        res,
        `${field} already exists`,
        { field, value: error.keyValue[field] },
        req
      );
      break;
    default:
      ResponseHandler.databaseError(
        res,
        "Database server error",
        undefined,
        req
      );
  }
};

// Handle Multer errors
const handleMulterError = (error: any, req: Request, res: Response): void => {
  switch (error.code) {
    case "LIMIT_FILE_SIZE":
      ResponseHandler.error(
        res,
        ERROR_CODES.VALIDATION_ERROR,
        "File too large",
        { maxSize: "10MB" },
        HTTP_STATUS.BAD_REQUEST,
        req
      );
      break;
    case "LIMIT_FILE_COUNT":
      ResponseHandler.error(
        res,
        ERROR_CODES.VALIDATION_ERROR,
        "Too many files",
        { maxCount: 1 },
        HTTP_STATUS.BAD_REQUEST,
        req
      );
      break;
    case "LIMIT_UNEXPECTED_FILE":
      ResponseHandler.error(
        res,
        ERROR_CODES.VALIDATION_ERROR,
        "Unexpected file field",
        undefined,
        HTTP_STATUS.BAD_REQUEST,
        req
      );
      break;
    default:
      ResponseHandler.error(
        res,
        ERROR_CODES.VALIDATION_ERROR,
        "File upload error",
        undefined,
        HTTP_STATUS.BAD_REQUEST,
        req
      );
  }
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response): void => {
  ResponseHandler.notFound(res, `Route ${req.originalUrl} not found`, req);
};

// Health check error handler
export const healthCheckError = (service: string, error: Error): any => {
  return {
    service,
    status: "error",
    message: error.message,
    timestamp: new Date().toISOString(),
  };
};
