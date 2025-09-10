import express from "express";
import { database } from "../config/database.js";
import { ipfsService } from "../services/ipfs.service.js";
import { blockchainService } from "../services/blockchain.service.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     services:
 *                       type: object
 *                       properties:
 *                         database:
 *                           type: boolean
 *                         ipfs:
 *                           type: boolean
 *                         blockchain:
 *                           type: boolean
 *       500:
 *         description: Service is unhealthy
 */
router.get("/", async (req, res) => {
  try {
    const timestamp = new Date().toISOString();

    // Check service health
    const [dbHealth, ipfsHealth, blockchainHealth] = await Promise.allSettled([
      database.healthCheck(),
      ipfsService.healthCheck(),
      blockchainService.healthCheck(),
    ]);

    const services = {
      database: dbHealth.status === "fulfilled" && dbHealth.value,
      ipfs: ipfsHealth.status === "fulfilled" && ipfsHealth.value,
      blockchain:
        blockchainHealth.status === "fulfilled" && blockchainHealth.value,
    };

    const allHealthy = Object.values(services).every(
      (status) => status === true
    );
    const status = allHealthy ? "healthy" : "unhealthy";

    res.status(allHealthy ? 200 : 500).json({
      success: allHealthy,
      data: {
        status,
        timestamp,
        services,
      },
      message: allHealthy
        ? "All services are healthy"
        : "Some services are unhealthy",
    });
  } catch (error) {
    logger.error("Health check failed:", error);
    res.status(500).json({
      success: false,
      message: "Health check failed",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @swagger
 * /api/health/detailed:
 *   get:
 *     summary: Detailed health check with service information
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detailed health information
 */
router.get("/detailed", async (req, res) => {
  try {
    const timestamp = new Date().toISOString();

    // Get detailed service information
    const [dbHealth, ipfsHealth, blockchainHealth] = await Promise.allSettled([
      database.healthCheck(),
      ipfsService.healthCheck(),
      blockchainService.healthCheck(),
    ]);

    const services = {
      database: {
        healthy: dbHealth.status === "fulfilled" && dbHealth.value,
        connected: database.getConnectionStatus(),
        error: dbHealth.status === "rejected" ? dbHealth.reason?.message : null,
      },
      ipfs: {
        healthy: ipfsHealth.status === "fulfilled" && ipfsHealth.value,
        connected: ipfsService.getConnectionStatus(),
        error:
          ipfsHealth.status === "rejected" ? ipfsHealth.reason?.message : null,
      },
      blockchain: {
        healthy:
          blockchainHealth.status === "fulfilled" && blockchainHealth.value,
        error:
          blockchainHealth.status === "rejected"
            ? blockchainHealth.reason?.message
            : null,
      },
    };

    // Get additional blockchain info if healthy
    let blockchainInfo = {};
    if (services.blockchain.healthy) {
      try {
        const [blockNumber, balance] = await Promise.all([
          blockchainService.getBlockNumber(),
          blockchainService.getBalance(blockchainService.getWallet().address),
        ]);

        blockchainInfo = {
          blockNumber,
          walletBalance: balance,
          network: "ethereum",
        };
      } catch (error) {
        logger.warn("Failed to get blockchain info:", error);
      }
    }

    const allHealthy = Object.values(services).every(
      (service) => service.healthy === true
    );

    res.status(allHealthy ? 200 : 500).json({
      success: allHealthy,
      data: {
        status: allHealthy ? "healthy" : "unhealthy",
        timestamp,
        services,
        blockchainInfo,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || "1.0.0",
      },
      message: allHealthy
        ? "All services are healthy"
        : "Some services are unhealthy",
    });
  } catch (error) {
    logger.error("Detailed health check failed:", error);
    res.status(500).json({
      success: false,
      message: "Detailed health check failed",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
