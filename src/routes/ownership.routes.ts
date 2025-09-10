import express, { Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { blockchainService } from "../services/blockchain.service.js";
import { ipfsService } from "../services/ipfs.service.js";
import { BlockchainActivity } from "../models/BlockchainActivity.model.js";
import { IPFSData } from "../models/IPFSData.model.js";
import { logger } from "../utils/logger.js";
import { TRATATECH_OWNERSHIP_REGISTRY_ABI } from "../contracts/abis.js";
import { normalizeIPFSMetadata } from "../utils/ipfs-helper.js";
import {
  logSuccessfulTransaction,
  logFailedTransaction,
} from "../utils/transaction-logger.js";

import {
  authenticateSimpleApiKey,
  SimpleAuthenticatedRequest,
} from "../middleware/simple-apikey.middleware.js";
import {
  CreateOwnershipDeedRequest,
  TransferType,
  TransferStatus,
} from "../types/index.js";

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

/**
 * @swagger
 * /api/ownership/deeds:
 *   post:
 *     summary: Create a new ownership deed
 *     tags: [TrataTech Ownership Registry - Deeds]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - passportId
 *               - owner
 *               - acquisitionPrice
 *               - acquisitionMethod
 *               - ipfsData
 *             properties:
 *               passportId:
 *                 type: number
 *               owner:
 *                 type: string
 *               acquisitionPrice:
 *                 type: number
 *               acquisitionMethod:
 *                 type: string
 *               ipfsData:
 *                 type: object
 *               additionalData:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Ownership deed created successfully
 */
router.post(
  "/deeds",
  authenticateSimpleApiKey,
  [
    body("passportId").isNumeric(),
    body("owner").isEthereumAddress(),
    body("acquisitionPrice").isNumeric().isFloat({ min: 0 }),
    body("acquisitionMethod")
      .notEmpty()
      .isString()
      .isLength({ min: 1, max: 256 }),
    body("ipfsData").isObject(),
    body("additionalData").optional().isArray({ max: 10 }),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        passportId,
        owner,
        acquisitionPrice,
        acquisitionMethod,
        ipfsData,
        additionalData = [],
      }: CreateOwnershipDeedRequest = req.body;

      // Upload metadata to IPFS
      const ipfsResult = await ipfsService.uploadMetadata(ipfsData);

      // Save IPFS data to database
      const normalizedMetadata = normalizeIPFSMetadata(
        ipfsData,
        ipfsData.name || "Ownership Deed",
        ipfsData.description || "Ownership Transfer"
      );
      const ipfsRecord = new IPFSData({
        hash: ipfsResult.hash,
        size: ipfsResult.size,
        path: ipfsResult.path,
        metadata: normalizedMetadata,
        uploadedBy: "system", // TODO: Get from auth
        isPinned: true,
      });
      await ipfsRecord.save();

      // Generate metadata hash
      const crypto = await import("crypto");
      const metadataHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(ipfsData))
        .digest("hex");

      // Call smart contract
      const contractAddresses = blockchainService.getContractAddresses();
      const functionArgs = {
        passportId,
        owner,
        acquisitionPrice,
        acquisitionMethod,
        ipfsCID: ipfsResult.hash,
        metadataHash,
        additionalData,
      };

      try {
        const receipt = await blockchainService.callContractMethod(
          "TrataTechOwnershipRegistry",
          TRATATECH_OWNERSHIP_REGISTRY_ABI,
          "createOwnershipDeed",
          [
            passportId,
            owner,
            acquisitionPrice,
            acquisitionMethod,
            ipfsResult.hash,
            metadataHash,
            additionalData,
          ]
        );

        // Log successful transaction
        await logSuccessfulTransaction(
          receipt,
          blockchainService.getWallet().address,
          contractAddresses.TrataTechOwnershipRegistry,
          "createOwnershipDeed",
          functionArgs
        );

        res.json({
          success: true,
          data: {
            deedId: null, // TODO: Parse from contract events
            passportId,
            owner,
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            ipfsHash: ipfsResult.hash,
            ipfsURL: ipfsService.getGatewayURL(ipfsResult.hash),
            metadataHash,
          },
          message: "Ownership deed created successfully",
          transactionHash: receipt.transactionHash,
          timestamp: new Date().toISOString(),
        });
      } catch (blockchainError) {
        // Log failed transaction
        await logFailedTransaction(
          blockchainError,
          blockchainService.getWallet().address,
          contractAddresses.TrataTechOwnershipRegistry,
          "createOwnershipDeed",
          functionArgs
        );

        logger.error("Failed to create ownership deed:", blockchainError);
        res.status(500).json({
          success: false,
          message: "Failed to create ownership deed",
          error:
            blockchainError instanceof Error
              ? blockchainError.message
              : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("Failed to create ownership deed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create ownership deed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/ownership/deeds/{deedId}/transfer:
 *   post:
 *     summary: Transfer ownership deed
 *     tags: [TrataTech Ownership Registry - Deeds]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deedId
 *         required: true
 *         schema:
 *           type: number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - transferPrice
 *               - transferType
 *               - ipfsData
 *             properties:
 *               to:
 *                 type: string
 *               transferPrice:
 *                 type: number
 *               transferType:
 *                 type: number
 *                 enum: [0, 1, 2, 3, 4, 5, 6, 7]
 *               ipfsData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Ownership deed transferred successfully
 */
router.post(
  "/deeds/:deedId/transfer",
  authenticateSimpleApiKey,
  [
    param("deedId").isNumeric(),
    body("to").isEthereumAddress(),
    body("transferPrice").isNumeric().isFloat({ min: 0 }),
    body("transferType").isInt({ min: 0, max: 7 }),
    body("ipfsData").isObject(),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const deedId = parseInt(req.params.deedId);
      const { to, transferPrice, transferType, ipfsData } = req.body;

      // Upload metadata to IPFS
      const ipfsResult = await ipfsService.uploadMetadata(ipfsData);

      // Save IPFS data to database
      const normalizedMetadata = normalizeIPFSMetadata(
        ipfsData,
        ipfsData.name || "Ownership Deed",
        ipfsData.description || "Ownership Transfer"
      );
      const ipfsRecord = new IPFSData({
        hash: ipfsResult.hash,
        size: ipfsResult.size,
        path: ipfsResult.path,
        metadata: normalizedMetadata,
        uploadedBy: "system", // TODO: Get from auth
        isPinned: true,
      });
      await ipfsRecord.save();

      // Call smart contract
      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechOwnershipRegistry",
        TRATATECH_OWNERSHIP_REGISTRY_ABI,
        "transferOwnershipDeed",
        [deedId, to, transferPrice, transferType, ipfsResult.hash],
        transferPrice.toString()
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechOwnershipRegistry,
        transferPrice.toString(),
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechOwnershipRegistry,
        "transferOwnershipDeed",
        { deedId, to, transferPrice, transferType, ipfsCID: ipfsResult.hash }
      );

      res.json({
        success: true,
        data: {
          deedId,
          to,
          transferPrice,
          transferType,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          ipfsHash: ipfsResult.hash,
          ipfsURL: ipfsService.getGatewayURL(ipfsResult.hash),
        },
        message: "Ownership deed transferred successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to transfer ownership deed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to transfer ownership deed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/ownership/deeds/{deedId}/lock:
 *   post:
 *     summary: Lock ownership deed
 *     tags: [TrataTech Ownership Registry - Deeds]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deedId
 *         required: true
 *         schema:
 *           type: number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lockDuration
 *             properties:
 *               lockDuration:
 *                 type: number
 *                 description: Lock duration in seconds
 *     responses:
 *       200:
 *         description: Ownership deed locked successfully
 */
router.post(
  "/deeds/:deedId/lock",
  authenticateSimpleApiKey,
  [
    param("deedId").isNumeric(),
    body("lockDuration").isNumeric().isInt({ min: 1, max: 31536000 }), // Max 1 year
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const deedId = parseInt(req.params.deedId);
      const { lockDuration } = req.body;

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechOwnershipRegistry",
        TRATATECH_OWNERSHIP_REGISTRY_ABI,
        "lockDeed",
        [deedId, lockDuration]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechOwnershipRegistry,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechOwnershipRegistry,
        "lockDeed",
        { deedId, lockDuration }
      );

      res.json({
        success: true,
        data: {
          deedId,
          lockDuration,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
        },
        message: "Ownership deed locked successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to lock ownership deed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to lock ownership deed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/ownership/deeds/{deedId}/unlock:
 *   post:
 *     summary: Unlock ownership deed
 *     tags: [TrataTech Ownership Registry - Deeds]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deedId
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Ownership deed unlocked successfully
 */
router.post(
  "/deeds/:deedId/unlock",
  authenticateSimpleApiKey,
  [param("deedId").isNumeric()],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const deedId = parseInt(req.params.deedId);

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechOwnershipRegistry",
        TRATATECH_OWNERSHIP_REGISTRY_ABI,
        "unlockDeed",
        [deedId]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechOwnershipRegistry,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechOwnershipRegistry,
        "unlockDeed",
        { deedId }
      );

      res.json({
        success: true,
        data: {
          deedId,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
        },
        message: "Ownership deed unlocked successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to unlock ownership deed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to unlock ownership deed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/ownership/transfer-requests:
 *   post:
 *     summary: Create a transfer request
 *     tags: [TrataTech Ownership Registry - Transfer Requests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deedId
 *               - to
 *               - proposedPrice
 *               - transferReason
 *             properties:
 *               deedId:
 *                 type: number
 *               to:
 *                 type: string
 *               proposedPrice:
 *                 type: number
 *               transferReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transfer request created successfully
 */
router.post(
  "/transfer-requests",
  authenticateSimpleApiKey,
  [
    body("deedId").isNumeric(),
    body("to").isEthereumAddress(),
    body("proposedPrice").isNumeric().isFloat({ min: 0 }),
    body("transferReason").notEmpty().isString().isLength({ min: 1, max: 500 }),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { deedId, to, proposedPrice, transferReason } = req.body;

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechOwnershipRegistry",
        TRATATECH_OWNERSHIP_REGISTRY_ABI,
        "createTransferRequest",
        [deedId, to, proposedPrice, transferReason]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechOwnershipRegistry,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechOwnershipRegistry,
        "createTransferRequest",
        { deedId, to, proposedPrice, transferReason }
      );

      res.json({
        success: true,
        data: {
          requestId: null, // TODO: Parse from contract events
          deedId,
          to,
          proposedPrice,
          transferReason,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
        },
        message: "Transfer request created successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to create transfer request:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create transfer request",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/ownership/transfer-requests/{requestId}/execute:
 *   post:
 *     summary: Execute an approved transfer request
 *     tags: [TrataTech Ownership Registry - Transfer Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ipfsData
 *             properties:
 *               ipfsData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Transfer request executed successfully
 */
router.post(
  "/transfer-requests/:requestId/execute",
  authenticateSimpleApiKey,
  [param("requestId").isNumeric(), body("ipfsData").isObject()],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const requestId = parseInt(req.params.requestId);
      const { ipfsData } = req.body;

      // Upload metadata to IPFS
      const ipfsResult = await ipfsService.uploadMetadata(ipfsData);

      // Save IPFS data to database
      const normalizedMetadata = normalizeIPFSMetadata(
        ipfsData,
        ipfsData.name || "Ownership Deed",
        ipfsData.description || "Ownership Transfer"
      );
      const ipfsRecord = new IPFSData({
        hash: ipfsResult.hash,
        size: ipfsResult.size,
        path: ipfsResult.path,
        metadata: normalizedMetadata,
        uploadedBy: "system", // TODO: Get from auth
        isPinned: true,
      });
      await ipfsRecord.save();

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechOwnershipRegistry",
        TRATATECH_OWNERSHIP_REGISTRY_ABI,
        "executeTransferRequest",
        [requestId, ipfsResult.hash]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechOwnershipRegistry,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechOwnershipRegistry,
        "executeTransferRequest",
        { requestId, ipfsCID: ipfsResult.hash }
      );

      res.json({
        success: true,
        data: {
          requestId,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          ipfsHash: ipfsResult.hash,
          ipfsURL: ipfsService.getGatewayURL(ipfsResult.hash),
        },
        message: "Transfer request executed successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to execute transfer request:", error);
      res.status(500).json({
        success: false,
        message: "Failed to execute transfer request",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/ownership/deeds/{deedId}/royalty:
 *   post:
 *     summary: Set royalty for ownership deed
 *     tags: [TrataTech Ownership Registry - Royalties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deedId
 *         required: true
 *         schema:
 *           type: number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipient
 *               - percentage
 *               - maxAmount
 *             properties:
 *               recipient:
 *                 type: string
 *               percentage:
 *                 type: number
 *               maxAmount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Royalty set successfully
 */
router.post(
  "/deeds/:deedId/royalty",
  authenticateSimpleApiKey,
  [
    param("deedId").isNumeric(),
    body("recipient").isEthereumAddress(),
    body("percentage").isNumeric().isInt({ min: 0, max: 1000 }), // Max 10%
    body("maxAmount").isNumeric().isFloat({ min: 0 }),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const deedId = parseInt(req.params.deedId);
      const { recipient, percentage, maxAmount } = req.body;

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechOwnershipRegistry",
        TRATATECH_OWNERSHIP_REGISTRY_ABI,
        "setRoyalty",
        [deedId, recipient, percentage, maxAmount]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechOwnershipRegistry,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechOwnershipRegistry,
        "setRoyalty",
        { deedId, recipient, percentage, maxAmount }
      );

      res.json({
        success: true,
        data: {
          deedId,
          recipient,
          percentage,
          maxAmount,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
        },
        message: "Royalty set successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to set royalty:", error);
      res.status(500).json({
        success: false,
        message: "Failed to set royalty",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/ownership/transfer-requests/{deedId}/pending:
 *   get:
 *     summary: Get pending transfer requests for a deed
 *     tags: [TrataTech Ownership Registry - Transfer Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deedId
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *           default: 0
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *     responses:
 *       200:
 *         description: Pending transfer requests retrieved
 */
router.get(
  "/transfer-requests/:deedId/pending",
  authenticateSimpleApiKey,
  [
    param("deedId").isNumeric(),
    query("offset").optional().isInt({ min: 0 }),
    query("limit").optional().isInt({ min: 1, max: 20 }),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const deedId = parseInt(req.params.deedId);
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || 20;

      const contractAddresses = blockchainService.getContractAddresses();
      const requestIds = await blockchainService.readContractMethod(
        "TrataTechOwnershipRegistry",
        TRATATECH_OWNERSHIP_REGISTRY_ABI,
        "getPendingTransferRequestsPaginated",
        [deedId, offset, limit]
      );

      res.json({
        success: true,
        data: {
          deedId,
          requestIds: requestIds.map((id: any) => id.toString()),
          offset,
          limit,
        },
        message: "Pending transfer requests retrieved",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to get pending transfer requests:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get pending transfer requests",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/ownership/security-metrics:
 *   get:
 *     summary: Get security metrics
 *     tags: [TrataTech Ownership Registry - Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Security metrics retrieved
 */
router.get(
  "/security-metrics",
  authenticateSimpleApiKey,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const contractAddresses = blockchainService.getContractAddresses();
      const metrics = await blockchainService.readContractMethod(
        "TrataTechOwnershipRegistry",
        TRATATECH_OWNERSHIP_REGISTRY_ABI,
        "getSecurityMetrics"
      );

      res.json({
        success: true,
        data: {
          totalDeeds: metrics[0].toString(),
          totalTransfers: metrics[1].toString(),
          totalRoyalties: metrics[2].toString(),
          totalFees: metrics[3].toString(),
          transfersActive: metrics[4],
          royaltiesActive: metrics[5],
          requestsActive: metrics[6],
        },
        message: "Security metrics retrieved",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to get security metrics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get security metrics",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
