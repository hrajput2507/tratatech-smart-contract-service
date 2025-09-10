import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";

import { database } from "./config/database.js";
import { logger, morganStream } from "./utils/logger.js";
import { ipfsService } from "./services/ipfs.service.js";
import { blockchainService } from "./services/blockchain.service.js";
import { initializeSwagger } from "./config/swagger.js";
import {
  errorInterceptor,
  notFoundHandler,
} from "./middleware/errorInterceptor.middleware.js";
import { sanitizeRequest } from "./middleware/validation.middleware.js";

// Import routes
import mainRoutes from "./routes/main.routes.js";
import passportRoutes from "./routes/passport.routes.js";
import ownershipRoutes from "./routes/ownership.routes.js";
import provenanceRoutes from "./routes/provenance.routes.js";
import forwarderRoutes from "./routes/forwarder.routes.js";
import apiKeyRoutes from "./routes/apikey.routes.js";
import healthRoutes from "./routes/health.routes.js";

// Load environment variables
dotenv.config();

class Server {
  private app: express.Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || "3000", 10);
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    if (process.env.HELMET_ENABLED === "true") {
      this.app.use(helmet());
    }

    // CORS configuration
    this.app.use(
      cors({
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        credentials: true,
      })
    );

    // Compression middleware
    this.app.use(compression());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
      message: {
        success: false,
        message: "Too many requests from this IP, please try again later.",
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use("/api/", limiter);

    // Logging middleware
    this.app.use(morgan("combined", { stream: morganStream }));

    // Body parsing middleware
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Request sanitization
    this.app.use(sanitizeRequest);

    // Static files
    this.app.use(
      "/uploads",
      express.static(path.join(process.cwd(), "uploads"))
    );
  }

  private initializeRoutes(): void {
    // Initialize Swagger documentation
    initializeSwagger(this.app);

    // API routes
    this.app.use("/api/health", healthRoutes);
    this.app.use("/api/apikey", apiKeyRoutes);
    this.app.use("/api/main", mainRoutes);
    this.app.use("/api/passport", passportRoutes);
    this.app.use("/api/ownership", ownershipRoutes);
    this.app.use("/api/provenance", provenanceRoutes);
    this.app.use("/api/forwarder", forwarderRoutes);

    // Root route
    this.app.get("/", (req, res) => {
      res.json({
        success: true,
        message: "TrataTech API Server",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        endpoints: {
          health: "/api/health",
          apikey: "/api/apikey",
          main: "/api/main",
          passport: "/api/passport",
          ownership: "/api/ownership",
          provenance: "/api/provenance",
          forwarder: "/api/forwarder",
          docs: "/api-docs",
        },
        apiKey: "tratatech_client_2024_secure_key_12345",
      });
    });

    // 404 handler
    this.app.use("*", notFoundHandler);
  }

  private initializeErrorHandling(): void {
    // Global error handler
    this.app.use(errorInterceptor);
  }

  public async start(): Promise<void> {
    try {
      // Initialize services
      await database.connect();
      await ipfsService.connect();
      await blockchainService.initialize();

      // Start server
      this.app.listen(this.port, () => {
        logger.info(`🚀 TrataTech API Server running on port ${this.port}`);
        logger.info(
          `📚 API Documentation: http://localhost:${this.port}/api-docs`
        );
        logger.info(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
      });

      // Graceful shutdown
      process.on("SIGTERM", this.gracefulShutdown.bind(this));
      process.on("SIGINT", this.gracefulShutdown.bind(this));
    } catch (error) {
      logger.error("Failed to start server:", error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    try {
      await database.disconnect();
      await ipfsService.disconnect();
      logger.info("Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      logger.error("Error during graceful shutdown:", error);
      process.exit(1);
    }
  }
}

// Start server
const server = new Server();
server.start().catch((error) => {
  logger.error("Failed to start server:", error);
  process.exit(1);
});
