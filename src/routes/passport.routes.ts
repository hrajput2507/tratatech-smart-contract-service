import express, { Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { ethers } from "ethers";
import { blockchainService } from "../services/blockchain.service.js";
import { ipfsService } from "../services/ipfs.service.js";
import { BlockchainActivity } from "../models/BlockchainActivity.model.js";
import { IPFSData } from "../models/IPFSData.model.js";
import { logger } from "../utils/logger.js";
import { TRATATECH_PRODUCT_PASSPORT_ABI } from "../contracts/abis.js";
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
  CreateProductPassportRequest,
  CreateServiceRecordRequest,
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
 * /api/passport/brands:
 *   post:
 *     summary: Register a new brand
 *     tags: [TrataTech Product Passport - Brands]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - brandId
 *               - brandName
 *               - brandDescription
 *               - ipfsData
 *               - authorizedCountries
 *             properties:
 *               brandId:
 *                 type: string
 *               brandName:
 *                 type: string
 *               brandDescription:
 *                 type: string
 *               ipfsData:
 *                 type: object
 *               authorizedCountries:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Brand registered successfully
 */
router.post(
  "/brands",
  authenticateSimpleApiKey,
  [
    body("brandId").notEmpty().isString().isLength({ min: 1, max: 256 }),
    body("brandName").notEmpty().isString().isLength({ min: 1, max: 256 }),
    body("brandDescription")
      .notEmpty()
      .isString()
      .isLength({ min: 1, max: 1000 }),
    body("ipfsData").isObject(),
    body("authorizedCountries").isArray({ min: 1, max: 10 }),
    body("authorizedCountries.*").isString().isLength({ min: 1, max: 100 }),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        brandId,
        brandName,
        brandDescription,
        ipfsData,
        authorizedCountries,
      } = req.body;

      // Upload metadata to IPFS
      const ipfsResult = await ipfsService.uploadMetadata(ipfsData);

      // Save IPFS data to database
      const normalizedMetadata = normalizeIPFSMetadata(
        ipfsData,
        ipfsData.name || "Product Passport",
        ipfsData.description || "Product Description"
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
      const functionArgs = {
        brandId,
        brandName,
        brandDescription,
        ipfsCID: ipfsResult.hash,
        authorizedCountries,
      };

      try {
        const receipt = await blockchainService.callContractMethod(
          "TrataTechProductPassport",
          TRATATECH_PRODUCT_PASSPORT_ABI,
          "registerBrand",
          [
            brandId,
            brandName,
            brandDescription,
            ipfsResult.hash,
            authorizedCountries,
          ],
          ethers.parseEther("0.02").toString() // Brand registration fee: 0.02 ETH
        );

        // Log successful transaction
        await logSuccessfulTransaction(
          receipt,
          blockchainService.getWallet().address,
          contractAddresses.TrataTechProductPassport,
          "registerBrand",
          functionArgs
        );

        res.json({
          success: true,
          data: {
            brandId,
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            ipfsHash: ipfsResult.hash,
            ipfsURL: ipfsService.getGatewayURL(ipfsResult.hash),
          },
          message: "Brand registered successfully",
          transactionHash: receipt.transactionHash,
          timestamp: new Date().toISOString(),
        });
      } catch (blockchainError) {
        // Log failed transaction
        await logFailedTransaction(
          blockchainError,
          blockchainService.getWallet().address,
          contractAddresses.TrataTechProductPassport,
          "registerBrand",
          functionArgs
        );

        logger.error("Failed to register brand:", blockchainError);
        res.status(500).json({
          success: false,
          message: "Failed to register brand",
          error:
            blockchainError instanceof Error
              ? blockchainError.message
              : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("Failed to register brand:", error);
      res.status(500).json({
        success: false,
        message: "Failed to register brand",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/passport/brands/{brandId}/approve:
 *   post:
 *     summary: Approve a pending brand
 *     tags: [TrataTech Product Passport - Brands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Brand approved successfully
 */
router.post(
  "/brands/:brandId/approve",
  authenticateSimpleApiKey,
  [param("brandId").notEmpty().isString()],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const brandId = req.params.brandId;

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechProductPassport",
        TRATATECH_PRODUCT_PASSPORT_ABI,
        "approveBrand",
        [brandId]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechProductPassport,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechProductPassport,
        "approveBrand",
        { brandId }
      );

      res.json({
        success: true,
        data: {
          brandId,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
        },
        message: "Brand approved successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to approve brand:", error);
      res.status(500).json({
        success: false,
        message: "Failed to approve brand",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/passport/brands/{brandId}/verify:
 *   post:
 *     summary: Verify a brand
 *     tags: [TrataTech Product Passport - Brands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               verificationFee:
 *                 type: string
 *                 description: Verification fee in wei (optional)
 *     responses:
 *       200:
 *         description: Brand verified successfully
 */
router.post(
  "/brands/:brandId/verify",
  authenticateSimpleApiKey,
  [
    param("brandId").notEmpty().isString(),
    body("verificationFee").optional().isString(),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const brandId = req.params.brandId;
      const { verificationFee = "0" } = req.body;

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechProductPassport",
        TRATATECH_PRODUCT_PASSPORT_ABI,
        "verifyBrand",
        [brandId],
        verificationFee
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechProductPassport,
        verificationFee,
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechProductPassport,
        "verifyBrand",
        { brandId, verificationFee }
      );

      res.json({
        success: true,
        data: {
          brandId,
          verificationFee,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
        },
        message: "Brand verified successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to verify brand:", error);
      res.status(500).json({
        success: false,
        message: "Failed to verify brand",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/passport/brands/{brandId}:
 *   get:
 *     summary: Get brand details
 *     tags: [TrataTech Product Passport - Brands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Brand details retrieved
 */
router.get(
  "/brands/:brandId",
  authenticateSimpleApiKey,
  [param("brandId").notEmpty().isString()],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const brandId = req.params.brandId;

      const contractAddresses = blockchainService.getContractAddresses();
      const brandDetails = await blockchainService.readContractMethod(
        "TrataTechProductPassport",
        TRATATECH_PRODUCT_PASSPORT_ABI,
        "getBrandDetailsWithSecurity",
        [brandId]
      );

      res.json({
        success: true,
        data: {
          brandId,
          name: brandDetails[0],
          isActive: brandDetails[1],
          isVerified: brandDetails[2],
          isPending: brandDetails[3],
          brandAddress: brandDetails[4],
          passportCount: brandDetails[5].toString(),
          registrationDate: brandDetails[6].toString(),
        },
        message: "Brand details retrieved",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to get brand details:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get brand details",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/passport/passports:
 *   post:
 *     summary: Create a new product passport
 *     tags: [TrataTech Product Passport - Passports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serialNumber
 *               - brandId
 *               - productName
 *               - productDescription
 *               - materials
 *               - manufacturingLocation
 *               - manufacturingDate
 *               - ipfsData
 *             properties:
 *               serialNumber:
 *                 type: string
 *               brandId:
 *                 type: string
 *               productName:
 *                 type: string
 *               productDescription:
 *                 type: string
 *               materials:
 *                 type: string
 *               manufacturingLocation:
 *                 type: string
 *               manufacturingDate:
 *                 type: number
 *               ipfsData:
 *                 type: object
 *               additionalData:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Product passport created successfully
 */
router.post(
  "/passports",
  authenticateSimpleApiKey,
  [
    body("serialNumber").notEmpty().isString().isLength({ min: 1, max: 256 }),
    body("brandId").notEmpty().isString().isLength({ min: 1, max: 256 }),
    body("productName").notEmpty().isString().isLength({ min: 1, max: 256 }),
    body("productDescription")
      .notEmpty()
      .isString()
      .isLength({ min: 1, max: 1000 }),
    body("materials").notEmpty().isString().isLength({ min: 1, max: 1000 }),
    body("manufacturingLocation")
      .notEmpty()
      .isString()
      .isLength({ min: 1, max: 256 }),
    body("manufacturingDate").isNumeric(),
    body("ipfsData").isObject(),
    body("additionalData").optional().isArray({ max: 10 }),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        serialNumber,
        brandId,
        productName,
        productDescription,
        materials,
        manufacturingLocation,
        manufacturingDate,
        ipfsData,
        additionalData = [],
      }: CreateProductPassportRequest = req.body;

      // Upload metadata to IPFS
      const ipfsResult = await ipfsService.uploadMetadata(ipfsData);

      // Save IPFS data to database
      const normalizedMetadata = normalizeIPFSMetadata(
        ipfsData,
        ipfsData.name || "Product Passport",
        ipfsData.description || "Product Description"
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
      const receipt = await blockchainService.callContractMethod(
        "TrataTechProductPassport",
        TRATATECH_PRODUCT_PASSPORT_ABI,
        "createProductPassport",
        [
          serialNumber,
          brandId,
          productName,
          productDescription,
          materials,
          manufacturingLocation,
          manufacturingDate,
          ipfsResult.hash,
          metadataHash,
        ]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechProductPassport,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechProductPassport,
        "createProductPassport",
        {
          serialNumber,
          brandId,
          productName,
          productDescription,
          materials,
          manufacturingLocation,
          manufacturingDate,
          ipfsCID: ipfsResult.hash,
          metadataHash,
        }
      );

      res.json({
        success: true,
        data: {
          passportId: null, // TODO: Parse from contract events
          serialNumber,
          brandId,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          ipfsHash: ipfsResult.hash,
          ipfsURL: ipfsService.getGatewayURL(ipfsResult.hash),
          metadataHash,
        },
        message: "Product passport created successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to create product passport:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create product passport",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/passport/passports/{passportId}/update:
 *   put:
 *     summary: Update product passport metadata
 *     tags: [TrataTech Product Passport - Passports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: passportId
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
 *         description: Product passport updated successfully
 */
router.put(
  "/passports/:passportId/update",
  authenticateSimpleApiKey,
  [param("passportId").isNumeric(), body("ipfsData").isObject()],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const passportId = parseInt(req.params.passportId);
      const { ipfsData } = req.body;

      // Upload metadata to IPFS
      const ipfsResult = await ipfsService.uploadMetadata(ipfsData);

      // Save IPFS data to database
      const normalizedMetadata = normalizeIPFSMetadata(
        ipfsData,
        ipfsData.name || "Product Passport",
        ipfsData.description || "Product Description"
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
      const receipt = await blockchainService.callContractMethod(
        "TrataTechProductPassport",
        TRATATECH_PRODUCT_PASSPORT_ABI,
        "updateProductPassport",
        [passportId, ipfsResult.hash, metadataHash]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechProductPassport,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechProductPassport,
        "updateProductPassport",
        { passportId, ipfsCID: ipfsResult.hash, metadataHash }
      );

      res.json({
        success: true,
        data: {
          passportId,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          ipfsHash: ipfsResult.hash,
          ipfsURL: ipfsService.getGatewayURL(ipfsResult.hash),
          metadataHash,
        },
        message: "Product passport updated successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to update product passport:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update product passport",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/passport/certificates:
 *   post:
 *     summary: Create a manufacturing certificate
 *     tags: [TrataTech Product Passport - Certificates]
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
 *               - certificateType
 *               - certificateNumber
 *               - issuingAuthority
 *               - issueDate
 *               - expiryDate
 *               - ipfsData
 *             properties:
 *               passportId:
 *                 type: number
 *               certificateType:
 *                 type: string
 *               certificateNumber:
 *                 type: string
 *               issuingAuthority:
 *                 type: string
 *               issueDate:
 *                 type: number
 *               expiryDate:
 *                 type: number
 *               ipfsData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Manufacturing certificate created successfully
 */
router.post(
  "/certificates",
  authenticateSimpleApiKey,
  [
    body("passportId").isNumeric(),
    body("certificateType")
      .notEmpty()
      .isString()
      .isLength({ min: 1, max: 256 }),
    body("certificateNumber")
      .notEmpty()
      .isString()
      .isLength({ min: 1, max: 256 }),
    body("issuingAuthority")
      .notEmpty()
      .isString()
      .isLength({ min: 1, max: 256 }),
    body("issueDate").isNumeric(),
    body("expiryDate")
      .isNumeric()
      .custom((value, { req }) => {
        if (value <= req.body.issueDate) {
          throw new Error("Expiry date must be after issue date");
        }
        return true;
      }),
    body("ipfsData").isObject(),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        passportId,
        certificateType,
        certificateNumber,
        issuingAuthority,
        issueDate,
        expiryDate,
        ipfsData,
      } = req.body;

      // Upload metadata to IPFS
      const ipfsResult = await ipfsService.uploadMetadata(ipfsData);

      // Save IPFS data to database
      const normalizedMetadata = normalizeIPFSMetadata(
        ipfsData,
        ipfsData.name || "Product Passport",
        ipfsData.description || "Product Description"
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
        "TrataTechProductPassport",
        TRATATECH_PRODUCT_PASSPORT_ABI,
        "createManufacturingCertificate",
        [
          passportId,
          certificateType,
          certificateNumber,
          issuingAuthority,
          issueDate,
          expiryDate,
          ipfsResult.hash,
        ]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechProductPassport,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechProductPassport,
        "createManufacturingCertificate",
        {
          passportId,
          certificateType,
          certificateNumber,
          issuingAuthority,
          issueDate,
          expiryDate,
          ipfsCID: ipfsResult.hash,
        }
      );

      res.json({
        success: true,
        data: {
          certificateId: null, // TODO: Parse from contract events
          passportId,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          ipfsHash: ipfsResult.hash,
          ipfsURL: ipfsService.getGatewayURL(ipfsResult.hash),
        },
        message: "Manufacturing certificate created successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to create manufacturing certificate:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create manufacturing certificate",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/passport/security-metrics:
 *   get:
 *     summary: Get security metrics
 *     tags: [TrataTech Product Passport - Analytics]
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
        "TrataTechProductPassport",
        TRATATECH_PRODUCT_PASSPORT_ABI,
        "getSecurityMetrics"
      );

      res.json({
        success: true,
        data: {
          totalBrands: metrics[0].toString(),
          totalVerified: metrics[1].toString(),
          totalPassports: metrics[2].toString(),
          totalCertificates: metrics[3].toString(),
          totalFees: metrics[4].toString(),
          brandRegEnabled: metrics[5],
          passportEnabled: metrics[6],
          certEnabled: metrics[7],
          approvalRequired: metrics[8],
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
