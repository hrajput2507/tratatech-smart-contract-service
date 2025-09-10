import express, { Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { ethers } from "ethers";
import { blockchainService } from "../services/blockchain.service.js";
import { ipfsService } from "../services/ipfs.service.js";
import { BlockchainActivity } from "../models/BlockchainActivity.model.js";
import { IPFSData } from "../models/IPFSData.model.js";
import { logger } from "../utils/logger.js";
import { TRATATECH_PROVENANCE_ABI } from "../contracts/abis.js";
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
  CreateProvenanceEntryRequest,
  CreateServiceRecordRequest,
  ProvenanceType,
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
 * /api/provenance/entries:
 *   post:
 *     summary: Create a new provenance entry
 *     tags: [TrataTech Provenance - Entries]
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
 *               - entryType
 *               - from
 *               - to
 *               - location
 *               - description
 *               - ipfsData
 *             properties:
 *               passportId:
 *                 type: number
 *               entryType:
 *                 type: number
 *                 enum: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
 *               from:
 *                 type: string
 *               to:
 *                 type: string
 *               location:
 *                 type: string
 *               description:
 *                 type: string
 *               ipfsData:
 *                 type: object
 *               additionalData:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Provenance entry created successfully
 */
router.post(
  "/entries",
  authenticateSimpleApiKey,
  [
    body("passportId").isNumeric(),
    body("entryType").isInt({ min: 0, max: 9 }),
    body("from").isEthereumAddress(),
    body("to").isEthereumAddress(),
    body("location").notEmpty().isString().isLength({ min: 1, max: 256 }),
    body("description").notEmpty().isString().isLength({ min: 1, max: 1000 }),
    body("ipfsData").isObject(),
    body("additionalData").optional().isArray({ max: 10 }),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        passportId,
        entryType,
        from,
        to,
        location,
        description,
        ipfsData,
        additionalData = [],
      }: CreateProvenanceEntryRequest = req.body;

      // Upload metadata to IPFS
      const ipfsResult = await ipfsService.uploadMetadata(ipfsData);

      // Save IPFS data to database
      const normalizedMetadata = normalizeIPFSMetadata(
        ipfsData,
        ipfsData.name || "Provenance Entry",
        ipfsData.description || "Provenance Description"
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
        entryType,
        from,
        to,
        location,
        description,
        ipfsCID: ipfsResult.hash,
        metadataHash,
        additionalData,
      };

      try {
        const receipt = await blockchainService.callContractMethod(
          "TrataTechProvenance",
          TRATATECH_PROVENANCE_ABI,
          "createProvenanceEntry",
          [
            passportId,
            entryType,
            from,
            to,
            location,
            description,
            ipfsResult.hash,
            metadataHash,
            additionalData,
          ],
          ethers.parseEther("0.001").toString() // Provenance entry fee: 0.001 ETH
        );

        // Log successful transaction
        await logSuccessfulTransaction(
          receipt,
          blockchainService.getWallet().address,
          contractAddresses.TrataTechProvenance,
          "createProvenanceEntry",
          functionArgs
        );

        res.json({
          success: true,
          data: {
            entryId: null, // TODO: Parse from contract events
            passportId,
            entryType,
            from,
            to,
            location,
            description,
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            ipfsHash: ipfsResult.hash,
            ipfsURL: ipfsService.getGatewayURL(ipfsResult.hash),
            metadataHash,
          },
          message: "Provenance entry created successfully",
          transactionHash: receipt.transactionHash,
          timestamp: new Date().toISOString(),
        });
      } catch (blockchainError) {
        // Log failed transaction
        await logFailedTransaction(
          blockchainError,
          blockchainService.getWallet().address,
          contractAddresses.TrataTechProvenance,
          "createProvenanceEntry",
          functionArgs
        );

        logger.error("Failed to create provenance entry:", blockchainError);
        res.status(500).json({
          success: false,
          message: "Failed to create provenance entry",
          error:
            blockchainError instanceof Error
              ? blockchainError.message
              : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("Failed to create provenance entry:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create provenance entry",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/provenance/entries/batch:
 *   post:
 *     summary: Create multiple provenance entries in batch
 *     tags: [TrataTech Provenance - Entries]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - passportIds
 *               - entryTypes
 *               - froms
 *               - tos
 *               - locations
 *               - descriptions
 *               - ipfsCIDs
 *               - metadataHashes
 *             properties:
 *               passportIds:
 *                 type: array
 *                 items:
 *                   type: number
 *               entryTypes:
 *                 type: array
 *                 items:
 *                   type: number
 *               froms:
 *                 type: array
 *                 items:
 *                   type: string
 *               tos:
 *                 type: array
 *                 items:
 *                   type: string
 *               locations:
 *                 type: array
 *                 items:
 *                   type: string
 *               descriptions:
 *                 type: array
 *                 items:
 *                   type: string
 *               ipfsCIDs:
 *                 type: array
 *                 items:
 *                   type: string
 *               metadataHashes:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Batch provenance entries created successfully
 */
router.post(
  "/entries/batch",
  authenticateSimpleApiKey,
  [
    body("passportIds").isArray({ min: 1, max: 5 }),
    body("entryTypes").isArray({ min: 1, max: 5 }),
    body("froms").isArray({ min: 1, max: 5 }),
    body("tos").isArray({ min: 1, max: 5 }),
    body("locations").isArray({ min: 1, max: 5 }),
    body("descriptions").isArray({ min: 1, max: 5 }),
    body("ipfsCIDs").isArray({ min: 1, max: 5 }),
    body("metadataHashes").isArray({ min: 1, max: 5 }),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        passportIds,
        entryTypes,
        froms,
        tos,
        locations,
        descriptions,
        ipfsCIDs,
        metadataHashes,
      } = req.body;

      // Validate array lengths match
      const batchSize = passportIds.length;
      if (
        batchSize !== entryTypes.length ||
        batchSize !== froms.length ||
        batchSize !== tos.length ||
        batchSize !== locations.length ||
        batchSize !== descriptions.length ||
        batchSize !== ipfsCIDs.length ||
        batchSize !== metadataHashes.length
      ) {
        res.status(400).json({
          success: false,
          message: "All arrays must have the same length",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Call smart contract
      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechProvenance",
        TRATATECH_PROVENANCE_ABI,
        "createBatchProvenanceEntries",
        [
          passportIds,
          entryTypes,
          froms,
          tos,
          locations,
          descriptions,
          ipfsCIDs,
          metadataHashes,
        ]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechProvenance,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechProvenance,
        "createBatchProvenanceEntries",
        {
          passportIds,
          entryTypes,
          froms,
          tos,
          locations,
          descriptions,
          ipfsCIDs,
          metadataHashes,
        }
      );

      res.json({
        success: true,
        data: {
          batchSize,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
        },
        message: "Batch provenance entries created successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to create batch provenance entries:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create batch provenance entries",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/provenance/service-records:
 *   post:
 *     summary: Create a service record
 *     tags: [TrataTech Provenance - Service Records]
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
 *               - serviceType
 *               - serviceProvider
 *               - serviceDescription
 *               - serviceDate
 *               - nextServiceDate
 *               - ipfsData
 *               - certificateNumber
 *             properties:
 *               passportId:
 *                 type: number
 *               serviceType:
 *                 type: string
 *               serviceProvider:
 *                 type: string
 *               serviceDescription:
 *                 type: string
 *               serviceDate:
 *                 type: number
 *               nextServiceDate:
 *                 type: number
 *               ipfsData:
 *                 type: object
 *               certificateNumber:
 *                 type: string
 *               serviceDetails:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Service record created successfully
 */
router.post(
  "/service-records",
  authenticateSimpleApiKey,
  [
    body("passportId").isNumeric(),
    body("serviceType").notEmpty().isString().isLength({ min: 1, max: 256 }),
    body("serviceProvider")
      .notEmpty()
      .isString()
      .isLength({ min: 1, max: 256 }),
    body("serviceDescription")
      .notEmpty()
      .isString()
      .isLength({ min: 1, max: 1000 }),
    body("serviceDate").isNumeric(),
    body("nextServiceDate")
      .isNumeric()
      .custom((value, { req }) => {
        if (value <= req.body.serviceDate) {
          throw new Error("Next service date must be after service date");
        }
        return true;
      }),
    body("ipfsData").isObject(),
    body("certificateNumber")
      .notEmpty()
      .isString()
      .isLength({ min: 1, max: 256 }),
    body("serviceDetails").optional().isArray({ max: 10 }),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        passportId,
        serviceType,
        serviceProvider,
        serviceDescription,
        serviceDate,
        nextServiceDate,
        ipfsData,
        certificateNumber,
        serviceDetails = [],
      }: CreateServiceRecordRequest = req.body;

      // Upload metadata to IPFS
      const ipfsResult = await ipfsService.uploadMetadata(ipfsData);

      // Save IPFS data to database
      const normalizedMetadata = normalizeIPFSMetadata(
        ipfsData,
        ipfsData.name || "Provenance Entry",
        ipfsData.description || "Provenance Description"
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
        "TrataTechProvenance",
        TRATATECH_PROVENANCE_ABI,
        "createServiceRecord",
        [
          passportId,
          serviceType,
          serviceProvider,
          serviceDescription,
          serviceDate,
          nextServiceDate,
          ipfsResult.hash,
          certificateNumber,
          serviceDetails,
        ]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechProvenance,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechProvenance,
        "createServiceRecord",
        {
          passportId,
          serviceType,
          serviceProvider,
          serviceDescription,
          serviceDate,
          nextServiceDate,
          ipfsCID: ipfsResult.hash,
          certificateNumber,
          serviceDetails,
        }
      );

      res.json({
        success: true,
        data: {
          serviceId: null, // TODO: Parse from contract events
          passportId,
          serviceType,
          serviceProvider,
          serviceDescription,
          serviceDate,
          nextServiceDate,
          certificateNumber,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          ipfsHash: ipfsResult.hash,
          ipfsURL: ipfsService.getGatewayURL(ipfsResult.hash),
        },
        message: "Service record created successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to create service record:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create service record",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/provenance/passports/{passportId}/entries:
 *   get:
 *     summary: Get provenance entries for a passport
 *     tags: [TrataTech Provenance - Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: passportId
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
 *         description: Provenance entries retrieved
 */
router.get(
  "/passports/:passportId/entries",
  authenticateSimpleApiKey,
  [
    param("passportId").isNumeric(),
    query("offset").optional().isInt({ min: 0 }),
    query("limit").optional().isInt({ min: 1, max: 50 }),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const passportId = parseInt(req.params.passportId);
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || 20;

      const contractAddresses = blockchainService.getContractAddresses();
      const entryIds = await blockchainService.readContractMethod(
        "TrataTechProvenance",
        TRATATECH_PROVENANCE_ABI,
        "getPassportEntriesPaginated",
        [passportId, offset, limit]
      );

      res.json({
        success: true,
        data: {
          passportId,
          entryIds: entryIds.map((id: any) => id.toString()),
          offset,
          limit,
        },
        message: "Provenance entries retrieved",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to get provenance entries:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get provenance entries",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/provenance/security-metrics:
 *   get:
 *     summary: Get security metrics
 *     tags: [TrataTech Provenance - Analytics]
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
        "TrataTechProvenance",
        TRATATECH_PROVENANCE_ABI,
        "getSecurityMetrics"
      );

      res.json({
        success: true,
        data: {
          totalEntries: metrics[0].toString(),
          totalServices: metrics[1].toString(),
          totalFees: metrics[2].toString(),
          transfersActive: metrics[3],
          servicesActive: metrics[4],
          batchActive: metrics[5],
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

/**
 * @swagger
 * /api/provenance/fees:
 *   put:
 *     summary: Update fees (Admin only)
 *     tags: [TrataTech Provenance - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newProvenanceFee
 *               - newServiceFee
 *             properties:
 *               newProvenanceFee:
 *                 type: string
 *               newServiceFee:
 *                 type: string
 *     responses:
 *       200:
 *         description: Fees updated successfully
 */
router.put(
  "/fees",
  authenticateSimpleApiKey,
  [
    body("newProvenanceFee").notEmpty().isString(),
    body("newServiceFee").notEmpty().isString(),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { newProvenanceFee, newServiceFee } = req.body;

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechProvenance",
        TRATATECH_PROVENANCE_ABI,
        "setFees",
        [newProvenanceFee, newServiceFee]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechProvenance,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechProvenance,
        "setFees",
        { newProvenanceFee, newServiceFee }
      );

      res.json({
        success: true,
        data: {
          newProvenanceFee,
          newServiceFee,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
        },
        message: "Fees updated successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to update fees:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update fees",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/provenance/withdraw-fees:
 *   post:
 *     summary: Withdraw collected fees (Admin only)
 *     tags: [TrataTech Provenance - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipient
 *             properties:
 *               recipient:
 *                 type: string
 *     responses:
 *       200:
 *         description: Fees withdrawn successfully
 */
router.post(
  "/withdraw-fees",
  authenticateSimpleApiKey,
  [body("recipient").isEthereumAddress()],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { recipient } = req.body;

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechProvenance",
        TRATATECH_PROVENANCE_ABI,
        "withdrawFees",
        [recipient]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechProvenance,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechProvenance,
        "withdrawFees",
        { recipient }
      );

      res.json({
        success: true,
        data: {
          recipient,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
        },
        message: "Fees withdrawn successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to withdraw fees:", error);
      res.status(500).json({
        success: false,
        message: "Failed to withdraw fees",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
