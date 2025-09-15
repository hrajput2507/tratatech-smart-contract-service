import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import winston from "winston";
import dotenv from "dotenv";

// Import routes
import productPassportRoutes from "./routes/productPassport";
import provenanceRoutes from "./routes/provenance";
import ownershipRoutes from "./routes/ownership";
import businessRoutes from "./routes/business";
import adminRoutes from "./routes/admin";
import authRoutes from "./routes/auth";
import walletRoutes from "./routes/wallet";

// Import middleware
import { errorHandler } from "./middleware/errorHandler";
import { authMiddleware } from "./middleware/auth";

// Import blockchain service
import blockchainService from "./services/blockchainService";

// Import types
import { HealthCheckResponse } from "./types";

dotenv.config();

const app: Application = express();
const PORT: number = parseInt(process.env["PORT"] || "3000", 10);

// Configure logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "tratatech-api" },
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

if (process.env["NODE_ENV"] !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env["ALLOWED_ORIGINS"]?.split(",") || [
      "http://localhost:3000",
    ],
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
app.use(
  morgan("combined", {
    stream: { write: (message: string) => logger.info(message.trim()) },
  })
);

// Swagger configuration
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TrataTech Smart Contract API",
      version: "1.0.0",
      description: "REST API for TrataTech Smart Contract System",
      contact: {
        name: "TrataTech Support",
        email: "support@tratatech.com",
      },
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Development server",
      },
      {
        url: process.env["PRODUCTION_URL"] || "https://api.tratatech.com",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        apiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "API key for authentication",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Key",
          description:
            "API key in Bearer format (alternative to x-api-key header)",
        },
      },
    },
  },
  apis: ["./src/routes/*.ts", "./src/types/*.ts"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  const healthResponse: HealthCheckResponse = {
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "TrataTech API",
    version: "1.0.0",
    blockchain: {
      network: process.env["NETWORK"] || "polygon-amoy",
      connected: blockchainService.isConnected(),
    },
  };

  res.status(200).json(healthResponse);
});

// API documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/product-passport", authMiddleware, productPassportRoutes);
app.use("/api/v1/provenance", authMiddleware, provenanceRoutes);
app.use("/api/v1/ownership", authMiddleware, ownershipRoutes);
app.use("/api/v1/business", authMiddleware, businessRoutes);
app.use("/api/v1/admin", authMiddleware, adminRoutes);
app.use("/api/v1/wallet", authMiddleware, walletRoutes);

// Root endpoint
app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "TrataTech Smart Contract API",
    version: "1.0.0",
    documentation: "/api-docs",
    health: "/health",
  });
});

// 404 handler
app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    error: "Endpoint not found",
    message: `The requested endpoint ${req.originalUrl} does not exist`,
    availableEndpoints: {
      documentation: "/api-docs",
      health: "/health",
      auth: "/api/auth",
      productPassport: "/api/product-passport",
      provenance: "/api/provenance",
      ownership: "/api/ownership",
      business: "/api/business",
      admin: "/api/admin",
      wallet: "/api/wallet",
    },
  });
});

// Error handling middleware
app.use(errorHandler);

// Initialize blockchain service
async function initializeBlockchain(): Promise<void> {
  try {
    await blockchainService.initialize();
    logger.info("Blockchain service initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize blockchain service:", error);
    process.exit(1);
  }
}

// Start server
async function startServer(): Promise<void> {
  await initializeBlockchain();

  app.listen(PORT, () => {
    logger.info(`🚀 TrataTech API Server running on port ${PORT}`);
    logger.info(
      `📚 API Documentation available at http://localhost:${PORT}/api-docs`
    );
    logger.info(`🏥 Health check available at http://localhost:${PORT}/health`);
  });
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

startServer().catch((error: Error) => {
  logger.error("Failed to start server:", error);
  process.exit(1);
});

export default app;
