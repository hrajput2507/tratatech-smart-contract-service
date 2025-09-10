import { Response } from "express";
import { HTTP_STATUS, API_MESSAGES } from "../constants/index.js";
import { getErrorMessage } from "../constants/errorMessages.js";
import { logger } from "./logger.js";

// Standard response interface
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
  };
  timestamp: string;
  path?: string;
  method?: string;
}

// Success response handler
export class ResponseHandler {
  // Generic success response
  static success<T>(
    res: Response,
    data?: T,
    message: string = API_MESSAGES.SUCCESS,
    statusCode: number = HTTP_STATUS.OK,
    meta?: any
  ): void {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
      meta,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(response);
  }

  // Created response
  static created<T>(
    res: Response,
    data?: T,
    message: string = API_MESSAGES.CREATED
  ): void {
    this.success(res, data, message, HTTP_STATUS.CREATED);
  }

  // Updated response
  static updated<T>(
    res: Response,
    data?: T,
    message: string = API_MESSAGES.UPDATED
  ): void {
    this.success(res, data, message, HTTP_STATUS.OK);
  }

  // Deleted response
  static deleted(res: Response, message: string = API_MESSAGES.DELETED): void {
    this.success(res, undefined, message, HTTP_STATUS.OK);
  }

  // Paginated response
  static paginated<T>(
    res: Response,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
    },
    message: string = API_MESSAGES.SUCCESS
  ): void {
    const pages = Math.ceil(pagination.total / pagination.limit);

    this.success(res, data, message, HTTP_STATUS.OK, {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages,
    });
  }

  // Error response handler
  static error(
    res: Response,
    errorCode: string,
    message?: string,
    details?: any,
    statusCode?: number,
    req?: any
  ): void {
    const errorMessage = message || getErrorMessage(errorCode);

    const response: ApiResponse = {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        details,
      },
      timestamp: new Date().toISOString(),
    };

    // Add request info if available
    if (req) {
      response.path = req.path;
      response.method = req.method;
    }

    // Log error
    logger.error(`API Error [${errorCode}]: ${errorMessage}`, {
      errorCode,
      message: errorMessage,
      details,
      path: req?.path,
      method: req?.method,
    });

    res.status(statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }

  // Validation error response
  static validationError(res: Response, details: any, req?: any): void {
    this.error(
      res,
      "VALIDATION_ERROR",
      API_MESSAGES.VALIDATION_ERROR,
      details,
      HTTP_STATUS.BAD_REQUEST,
      req
    );
  }

  // Authentication error response
  static unauthorized(res: Response, message?: string, req?: any): void {
    this.error(
      res,
      "AUTHENTICATION_ERROR",
      message || API_MESSAGES.UNAUTHORIZED,
      undefined,
      HTTP_STATUS.UNAUTHORIZED,
      req
    );
  }

  // Authorization error response
  static forbidden(res: Response, message?: string, req?: any): void {
    this.error(
      res,
      "AUTHORIZATION_ERROR",
      message || API_MESSAGES.FORBIDDEN,
      undefined,
      HTTP_STATUS.FORBIDDEN,
      req
    );
  }

  // Not found error response
  static notFound(res: Response, message?: string, req?: any): void {
    this.error(
      res,
      "NOT_FOUND_ERROR",
      message || API_MESSAGES.NOT_FOUND,
      undefined,
      HTTP_STATUS.NOT_FOUND,
      req
    );
  }

  // Conflict error response
  static conflict(
    res: Response,
    message?: string,
    details?: any,
    req?: any
  ): void {
    this.error(
      res,
      "CONFLICT_ERROR",
      message || API_MESSAGES.CONFLICT_ERROR,
      details,
      HTTP_STATUS.CONFLICT,
      req
    );
  }

  // Rate limit error response
  static rateLimit(res: Response, message?: string, req?: any): void {
    this.error(
      res,
      "RATE_LIMIT_ERROR",
      message || API_MESSAGES.RATE_LIMIT_ERROR,
      undefined,
      HTTP_STATUS.TOO_MANY_REQUESTS,
      req
    );
  }

  // Internal server error response
  static internalError(
    res: Response,
    message?: string,
    details?: any,
    req?: any
  ): void {
    this.error(
      res,
      "INTERNAL_ERROR",
      message || API_MESSAGES.INTERNAL_ERROR,
      details,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      req
    );
  }

  // Blockchain error response
  static blockchainError(
    res: Response,
    message?: string,
    details?: any,
    req?: any
  ): void {
    this.error(
      res,
      "BLOCKCHAIN_ERROR",
      message || "Blockchain operation failed",
      details,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      req
    );
  }

  // IPFS error response
  static ipfsError(
    res: Response,
    message?: string,
    details?: any,
    req?: any
  ): void {
    this.error(
      res,
      "IPFS_ERROR",
      message || "IPFS operation failed",
      details,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      req
    );
  }

  // Database error response
  static databaseError(
    res: Response,
    message?: string,
    details?: any,
    req?: any
  ): void {
    this.error(
      res,
      "DATABASE_ERROR",
      message || "Database operation failed",
      details,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      req
    );
  }
}

// Convenience functions for common responses
export const sendSuccess = ResponseHandler.success;
export const sendCreated = ResponseHandler.created;
export const sendUpdated = ResponseHandler.updated;
export const sendDeleted = ResponseHandler.deleted;
export const sendPaginated = ResponseHandler.paginated;
export const sendError = ResponseHandler.error;
export const sendValidationError = ResponseHandler.validationError;
export const sendUnauthorized = ResponseHandler.unauthorized;
export const sendForbidden = ResponseHandler.forbidden;
export const sendNotFound = ResponseHandler.notFound;
export const sendConflict = ResponseHandler.conflict;
export const sendRateLimit = ResponseHandler.rateLimit;
export const sendInternalError = ResponseHandler.internalError;
export const sendBlockchainError = ResponseHandler.blockchainError;
export const sendIPFSError = ResponseHandler.ipfsError;
export const sendDatabaseError = ResponseHandler.databaseError;
