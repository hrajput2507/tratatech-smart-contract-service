import { Request, Response, NextFunction } from "express";

/**
 * Global error handling middleware
 * Handles all errors thrown in the application
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error("Error occurred:", err);

  // Default error response
  let statusCode: number = 500;
  let message: string = "Internal Server Error";
  let details: any = null;

  // Handle different types of errors
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
    details = (err as any).details || err.message;
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
  } else if ((err as any).code === 11000) {
    statusCode = 409;
    message = "Duplicate entry";
    details = "A record with this information already exists";
  } else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  } else if (err.name === "UnauthorizedError") {
    statusCode = 401;
    message = "Unauthorized";
  } else if (err.name === "ForbiddenError") {
    statusCode = 403;
    message = "Forbidden";
  } else if (err.name === "NotFoundError") {
    statusCode = 404;
    message = "Resource not found";
  } else if (err.name === "ConflictError") {
    statusCode = 409;
    message = "Conflict";
  } else if (err.name === "RateLimitError") {
    statusCode = 429;
    message = "Too many requests";
  } else if (err.name === "BlockchainError") {
    statusCode = 400;
    message = "Blockchain operation failed";
    // Extract the actual blockchain error message from the nested error
    const errorMessage = err.message;
    if (errorMessage.includes("execution reverted:")) {
      // Extract the revert reason from the error message
      const revertMatch = errorMessage.match(/execution reverted: "([^"]+)"/);
      if (revertMatch && revertMatch[1]) {
        message = revertMatch[1];
      }
    }
    details = errorMessage;
  } else if (err.name === "GasEstimationError") {
    statusCode = 400;
    message = "Gas estimation failed";
    details = err.message;
  } else if (err.name === "InsufficientFundsError") {
    statusCode = 400;
    message = "Insufficient funds for transaction";
    details = err.message;
  } else if (err.name === "ContractError") {
    statusCode = 400;
    message = "Smart contract operation failed";
    details = err.message;
  } else if (err.name === "NetworkError") {
    statusCode = 503;
    message = "Blockchain network error";
    details = err.message;
  }

  // Log error details in development
  if (process.env["NODE_ENV"] === "development") {
    // console.error('Error stack:', err.stack);
    details = err.stack;
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(details && { details }),
    // ...(process.env['NODE_ENV'] === 'development' && { stack: err.stack }),
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  });
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Custom error classes
 */
export class ValidationError extends Error {
  public details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

export class NotFoundError extends Error {
  constructor(message: string = "Resource not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends Error {
  constructor(message: string = "Conflict") {
    super(message);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends Error {
  constructor(message: string = "Too many requests") {
    super(message);
    this.name = "RateLimitError";
  }
}

export class BlockchainError extends Error {
  constructor(message: string = "Blockchain operation failed") {
    super(message);
    this.name = "BlockchainError";
  }
}

export class GasEstimationError extends Error {
  constructor(message: string = "Gas estimation failed") {
    super(message);
    this.name = "GasEstimationError";
  }
}

export class InsufficientFundsError extends Error {
  constructor(message: string = "Insufficient funds for transaction") {
    super(message);
    this.name = "InsufficientFundsError";
  }
}

export class ContractError extends Error {
  constructor(message: string = "Smart contract operation failed") {
    super(message);
    this.name = "ContractError";
  }
}

export class NetworkError extends Error {
  constructor(message: string = "Blockchain network error") {
    super(message);
    this.name = "NetworkError";
  }
}

/**
 * Request validation error handler
 * Handles validation errors from express-validator
 */
export const handleValidationErrors = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const errors = (req as any).validationErrors();
  if (errors) {
    const validationError = new ValidationError(
      "Validation failed",
      errors.map((error: any) => ({
        field: error.param,
        message: error.msg,
        value: error.value,
      }))
    );
    next(validationError);
    return;
  }
  next();
};

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};
