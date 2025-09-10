import express, { Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { blockchainService } from "../services/blockchain.service.js";
import { BlockchainActivity } from "../models/BlockchainActivity.model.js";
import { logger } from "../utils/logger.js";
import { ERC2771_FORWARDER_ABI } from "../contracts/abis.js";
import {
  logSuccessfulTransaction,
  logFailedTransaction,
} from "../utils/transaction-logger.js";

import {
  authenticateSimpleApiKey,
  SimpleAuthenticatedRequest,
} from "../middleware/simple-apikey.middleware.js";
const router = express.Router();

// Middleware to validate request
const validateRequest = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
      timestamp: new Date().toISOString(),
    });
    return;
  }
  next();
};

// Helper function to log blockchain activity
const logBlockchainActivity = async (
  transactionHash: string,
  blockNumber: number,
  blockHash: string,
  from: string,
  to: string,
  value: string,
  gasUsed: string,
  gasPrice: string,
  status: boolean,
  contractAddress: string,
  functionName: string,
  functionArgs: any
) => {
  try {
    const activity = new BlockchainActivity({
      transactionHash,
      blockNumber,
      blockHash,
      from,
      to,
      value,
      gasUsed,
      gasPrice,
      status,
      contractAddress,
      functionName,
      functionArgs,
      timestamp: Date.now(),
    });
    await activity.save();
    logger.info(
      `Blockchain activity logged: ${functionName} - ${transactionHash}`
    );
  } catch (error) {
    logger.error("Failed to log blockchain activity:", error);
  }
};

router.post(
  "/execute",
  authenticateSimpleApiKey,
  [
    body("userAddress").isEthereumAddress(),
    body("functionSignature").notEmpty().isString(),
    body("sigR").notEmpty().isString(),
    body("sigS").notEmpty().isString(),
    body("sigV").isInt({ min: 0, max: 255 }),
    body("value").optional().isString(),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        userAddress,
        functionSignature,
        sigR,
        sigS,
        sigV,
        value = "0",
      } = req.body;

      const contractAddresses = blockchainService.getContractAddresses();
      const functionArgs = {
        userAddress,
        functionSignature,
        sigR,
        sigS,
        sigV,
        value,
      };

      try {
        const receipt = await blockchainService.callContractMethod(
          "ERC2771Forwarder",
          ERC2771_FORWARDER_ABI,
          "execute",
          [userAddress, functionSignature, sigR, sigS, sigV],
          value
        );

        // Log successful transaction
        await logSuccessfulTransaction(
          receipt,
          blockchainService.getWallet().address,
          contractAddresses.ERC2771Forwarder,
          "execute",
          functionArgs
        );

        res.json({
          success: true,
          data: {
            userAddress,
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            value,
          },
          message: "Meta-transaction executed successfully",
          transactionHash: receipt.transactionHash,
          timestamp: new Date().toISOString(),
        });
      } catch (blockchainError) {
        // Log failed transaction
        await logFailedTransaction(
          blockchainError,
          blockchainService.getWallet().address,
          contractAddresses.ERC2771Forwarder,
          "execute",
          functionArgs
        );

        logger.error("Failed to execute meta-transaction:", blockchainError);
        res.status(500).json({
          success: false,
          message: "Failed to execute meta-transaction",
          error:
            blockchainError instanceof Error
              ? blockchainError.message
              : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("Failed to execute meta-transaction:", error);
      res.status(500).json({
        success: false,
        message: "Failed to execute meta-transaction",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

router.get(
  "/nonce/:userAddress",
  authenticateSimpleApiKey,
  [param("userAddress").isEthereumAddress()],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userAddress = req.params.userAddress;

      const contractAddresses = blockchainService.getContractAddresses();
      const nonce = await blockchainService.readContractMethod(
        "ERC2771Forwarder",
        ERC2771_FORWARDER_ABI,
        "getNonce",
        [userAddress]
      );

      res.json({
        success: true,
        data: {
          userAddress,
          nonce: nonce.toString(),
        },
        message: "User nonce retrieved",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to get user nonce:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get user nonce",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

router.get(
  "/relayers/:relayerAddress",
  authenticateSimpleApiKey,
  [param("relayerAddress").isEthereumAddress()],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const relayerAddress = req.params.relayerAddress;

      const contractAddresses = blockchainService.getContractAddresses();
      const isRelayer = await blockchainService.readContractMethod(
        "ERC2771Forwarder",
        ERC2771_FORWARDER_ABI,
        "isRelayer",
        [relayerAddress]
      );

      res.json({
        success: true,
        data: {
          relayerAddress,
          isRelayer,
        },
        message: "Relayer status retrieved",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to check relayer status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check relayer status",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

router.post(
  "/relayers",
  authenticateSimpleApiKey,
  [body("relayerAddress").isEthereumAddress()],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { relayerAddress } = req.body;

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "ERC2771Forwarder",
        ERC2771_FORWARDER_ABI,
        "addRelayer",
        [relayerAddress]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.ERC2771Forwarder,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.ERC2771Forwarder,
        "addRelayer",
        { relayerAddress }
      );

      res.json({
        success: true,
        data: {
          relayerAddress,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
        },
        message: "Relayer added successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to add relayer:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add relayer",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

router.delete(
  "/relayers/:relayerAddress",
  authenticateSimpleApiKey,
  [param("relayerAddress").isEthereumAddress()],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const relayerAddress = req.params.relayerAddress;

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "ERC2771Forwarder",
        ERC2771_FORWARDER_ABI,
        "removeRelayer",
        [relayerAddress]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.ERC2771Forwarder,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.ERC2771Forwarder,
        "removeRelayer",
        { relayerAddress }
      );

      res.json({
        success: true,
        data: {
          relayerAddress,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
        },
        message: "Relayer removed successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to remove relayer:", error);
      res.status(500).json({
        success: false,
        message: "Failed to remove relayer",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

router.post(
  "/verify-signature",
  authenticateSimpleApiKey,
  [
    body("userAddress").isEthereumAddress(),
    body("functionSignature").notEmpty().isString(),
    body("sigR").notEmpty().isString(),
    body("sigS").notEmpty().isString(),
    body("sigV").isInt({ min: 0, max: 255 }),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userAddress, functionSignature, sigR, sigS, sigV } = req.body;

      // This is a client-side verification - we can't call the contract directly
      // but we can provide the data for client-side verification
      const verificationData = {
        userAddress,
        functionSignature,
        signature: {
          r: sigR,
          s: sigS,
          v: sigV,
        },
        forwarderAddress:
          blockchainService.getContractAddresses().ERC2771Forwarder,
      };

      res.json({
        success: true,
        data: {
          verificationData,
          message: "Use this data for client-side signature verification",
        },
        message: "Signature verification data provided",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to provide signature verification data:", error);
      res.status(500).json({
        success: false,
        message: "Failed to provide signature verification data",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/forwarder/relayer-service:
 *   post:
 *     summary: Start relayer service for gasless transactions
 *     tags: [ERC2771 Forwarder - Relayer Service]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userAddress
 *               - functionSignature
 *               - sigR
 *               - sigS
 *               - sigV
 *             properties:
 *               userAddress:
 *                 type: string
 *               functionSignature:
 *                 type: string
 *               sigR:
 *                 type: string
 *               sigS:
 *                 type: string
 *               sigV:
 *                 type: number
 *               value:
 *                 type: string
 *               gasLimit:
 *                 type: string
 *     responses:
 *       200:
 *         description: Relayer service transaction submitted
 */
router.post(
  "/relayer-service",
  authenticateSimpleApiKey,
  [
    body("userAddress").isEthereumAddress(),
    body("functionSignature").notEmpty().isString(),
    body("sigR").notEmpty().isString(),
    body("sigS").notEmpty().isString(),
    body("sigV").isInt({ min: 0, max: 255 }),
    body("value").optional().isString(),
    body("gasLimit").optional().isString(),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        userAddress,
        functionSignature,
        sigR,
        sigS,
        sigV,
        value = "0",
        gasLimit,
      } = req.body;

      // This endpoint simulates a relayer service that would:
      // 1. Verify the signature
      // 2. Execute the meta-transaction
      // 3. Pay for gas on behalf of the user

      const contractAddresses = blockchainService.getContractAddresses();

      // Execute the meta-transaction
      const receipt = await blockchainService.callContractMethod(
        "ERC2771Forwarder",
        ERC2771_FORWARDER_ABI,
        "execute",
        [userAddress, functionSignature, sigR, sigS, sigV],
        value
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.ERC2771Forwarder,
        value,
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.ERC2771Forwarder,
        "execute",
        { userAddress, functionSignature, sigR, sigS, sigV, value, gasLimit }
      );

      res.json({
        success: true,
        data: {
          userAddress,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          gasPaidByRelayer: true,
          value,
        },
        message: "Relayer service transaction executed successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to execute relayer service transaction:", error);
      res.status(500).json({
        success: false,
        message: "Failed to execute relayer service transaction",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
