import express, { Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { blockchainService } from "../services/blockchain.service.js";
import { ipfsService } from "../services/ipfs.service.js";
import { BlockchainActivity } from "../models/BlockchainActivity.model.js";
import { IPFSData } from "../models/IPFSData.model.js";
import { logger } from "../utils/logger.js";
import { TRATATECH_MAIN_ABI } from "../contracts/abis.js";
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
  CreateEventInviteRequest,
  CreateProductLaunchRequest,
  TokenType,
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
 * /api/main/events:
 *   post:
 *     summary: Create a new event invite
 *     tags: [TrataTech Main - Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventName
 *               - eventDescription
 *               - eventDate
 *               - maxAttendees
 *               - ipfsData
 *             properties:
 *               eventName:
 *                 type: string
 *               eventDescription:
 *                 type: string
 *               eventDate:
 *                 type: number
 *               maxAttendees:
 *                 type: number
 *               ipfsData:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   image:
 *                     type: string
 *                   attributes:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         trait_type:
 *                           type: string
 *                         value:
 *                           type: string
 *     responses:
 *       200:
 *         description: Event created successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post(
  "/events",
  authenticateSimpleApiKey,
  [
    body("eventName").notEmpty().isString().isLength({ min: 1, max: 256 }),
    body("eventDescription")
      .notEmpty()
      .isString()
      .isLength({ min: 1, max: 1000 }),
    body("eventDate")
      .isNumeric()
      .custom((value) => {
        if (value <= Date.now() / 1000) {
          throw new Error("Event date must be in the future");
        }
        return true;
      }),
    body("maxAttendees").isInt({ min: 1, max: 10000 }),
    body("ipfsData").isObject(),
    body("ipfsData.name").notEmpty().isString(),
    body("ipfsData.description").notEmpty().isString(),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        eventName,
        eventDescription,
        eventDate,
        maxAttendees,
        ipfsData,
      }: CreateEventInviteRequest = req.body;

      // Upload metadata to IPFS
      const ipfsResult = await ipfsService.uploadMetadata(ipfsData);

      // Save IPFS data to database
      const normalizedMetadata = normalizeIPFSMetadata(
        ipfsData,
        ipfsData.name || "Event",
        ipfsData.description || "Event Description"
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
        eventName,
        eventDescription,
        eventDate,
        maxAttendees,
        ipfsCID: ipfsResult.hash,
      };

      try {
        const receipt = await blockchainService.callContractMethod(
          "TrataTechMain",
          TRATATECH_MAIN_ABI,
          "createEventInvite",
          [
            eventName,
            eventDescription,
            eventDate,
            maxAttendees,
            ipfsResult.hash,
          ]
        );

        // Log successful transaction
        await logSuccessfulTransaction(
          receipt,
          blockchainService.getWallet().address,
          contractAddresses.TrataTechMain,
          "createEventInvite",
          functionArgs
        );

        res.json({
          success: true,
          data: {
            eventId: null, // TODO: Parse from contract events
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            ipfsHash: ipfsResult.hash,
            ipfsURL: ipfsService.getGatewayURL(ipfsResult.hash),
          },
          message: "Event created successfully",
          transactionHash: receipt.transactionHash,
          timestamp: new Date().toISOString(),
        });
      } catch (blockchainError) {
        // Log failed transaction
        await logFailedTransaction(
          blockchainError,
          blockchainService.getWallet().address,
          contractAddresses.TrataTechMain,
          "createEventInvite",
          functionArgs
        );

        logger.error("Failed to create event:", blockchainError);
        res.status(500).json({
          success: false,
          message: "Failed to create event",
          error:
            blockchainError instanceof Error
              ? blockchainError.message
              : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("Failed to create event:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create event",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/main/events/{eventId}/rsvp:
 *   post:
 *     summary: Submit RSVP for an event
 *     tags: [TrataTech Main - Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: RSVP submitted successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post(
  "/events/:eventId/rsvp",
  authenticateSimpleApiKey,
  [param("eventId").isNumeric()],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const eventId = parseInt(req.params.eventId);

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechMain",
        TRATATECH_MAIN_ABI,
        "submitRSVP",
        [eventId]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechMain,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechMain,
        "submitRSVP",
        { eventId }
      );

      res.json({
        success: true,
        data: {
          eventId,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
        },
        message: "RSVP submitted successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to submit RSVP:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit RSVP",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/main/events/{eventId}/cancel-rsvp:
 *   post:
 *     summary: Cancel RSVP for an event
 *     tags: [TrataTech Main - Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: RSVP cancelled successfully
 */
router.post(
  "/events/:eventId/cancel-rsvp",
  authenticateSimpleApiKey,
  [param("eventId").isNumeric()],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const eventId = parseInt(req.params.eventId);

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechMain",
        TRATATECH_MAIN_ABI,
        "cancelRSVP",
        [eventId]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechMain,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechMain,
        "cancelRSVP",
        { eventId }
      );

      res.json({
        success: true,
        data: {
          eventId,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
        },
        message: "RSVP cancelled successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to cancel RSVP:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel RSVP",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/main/product-launches:
 *   post:
 *     summary: Create a new product launch
 *     tags: [TrataTech Main - Product Launches]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productName
 *               - productDescription
 *               - launchDate
 *               - earlyAccessEndDate
 *               - maxEarlyAccess
 *               - ipfsData
 *             properties:
 *               productName:
 *                 type: string
 *               productDescription:
 *                 type: string
 *               launchDate:
 *                 type: number
 *               earlyAccessEndDate:
 *                 type: number
 *               maxEarlyAccess:
 *                 type: number
 *               ipfsData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Product launch created successfully
 */
router.post(
  "/product-launches",
  authenticateSimpleApiKey,
  [
    body("productName").notEmpty().isString().isLength({ min: 1, max: 256 }),
    body("productDescription")
      .notEmpty()
      .isString()
      .isLength({ min: 1, max: 1000 }),
    body("launchDate")
      .isNumeric()
      .custom((value) => {
        if (value <= Date.now() / 1000) {
          throw new Error("Launch date must be in the future");
        }
        return true;
      }),
    body("earlyAccessEndDate")
      .isNumeric()
      .custom((value, { req }) => {
        if (value <= Date.now() / 1000 || value >= req.body.launchDate) {
          throw new Error(
            "Early access end date must be in the future and before launch date"
          );
        }
        return true;
      }),
    body("maxEarlyAccess").isInt({ min: 1, max: 10000 }),
    body("ipfsData").isObject(),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        productName,
        productDescription,
        launchDate,
        earlyAccessEndDate,
        maxEarlyAccess,
        ipfsData,
      }: CreateProductLaunchRequest = req.body;

      // Upload metadata to IPFS
      const ipfsResult = await ipfsService.uploadMetadata(ipfsData);

      // Save IPFS data to database
      const normalizedMetadata = normalizeIPFSMetadata(
        ipfsData,
        ipfsData.name || "Event",
        ipfsData.description || "Event Description"
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
        productName,
        productDescription,
        launchDate,
        earlyAccessEndDate,
        maxEarlyAccess,
        ipfsCID: ipfsResult.hash,
      };

      try {
        const receipt = await blockchainService.callContractMethod(
          "TrataTechMain",
          TRATATECH_MAIN_ABI,
          "createProductLaunch",
          [
            productName,
            productDescription,
            launchDate,
            earlyAccessEndDate,
            maxEarlyAccess,
            ipfsResult.hash,
          ]
        );

        // Log successful transaction
        await logSuccessfulTransaction(
          receipt,
          blockchainService.getWallet().address,
          contractAddresses.TrataTechMain,
          "createProductLaunch",
          functionArgs
        );

        res.json({
          success: true,
          data: {
            launchId: null, // TODO: Parse from contract events
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            ipfsHash: ipfsResult.hash,
            ipfsURL: ipfsService.getGatewayURL(ipfsResult.hash),
          },
          message: "Product launch created successfully",
          transactionHash: receipt.transactionHash,
          timestamp: new Date().toISOString(),
        });
      } catch (blockchainError) {
        // Log failed transaction
        await logFailedTransaction(
          blockchainError,
          blockchainService.getWallet().address,
          contractAddresses.TrataTechMain,
          "createProductLaunch",
          functionArgs
        );

        logger.error("Failed to create product launch:", blockchainError);
        res.status(500).json({
          success: false,
          message: "Failed to create product launch",
          error:
            blockchainError instanceof Error
              ? blockchainError.message
              : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("Failed to create product launch:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create product launch",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/main/product-launches/{launchId}/pre-order:
 *   post:
 *     summary: Place a pre-order for a product launch
 *     tags: [TrataTech Main - Product Launches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: launchId
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
 *               - amount
 *             properties:
 *               amount:
 *                 type: string
 *                 description: Amount in wei
 *     responses:
 *       200:
 *         description: Pre-order placed successfully
 */
router.post(
  "/product-launches/:launchId/pre-order",
  authenticateSimpleApiKey,
  [param("launchId").isNumeric(), body("amount").notEmpty().isString()],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const launchId = parseInt(req.params.launchId);
      const { amount } = req.body;

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechMain",
        TRATATECH_MAIN_ABI,
        "placePreOrder",
        [launchId],
        amount
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechMain,
        amount,
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechMain,
        "placePreOrder",
        { launchId, amount }
      );

      res.json({
        success: true,
        data: {
          launchId,
          amount,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
        },
        message: "Pre-order placed successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to place pre-order:", error);
      res.status(500).json({
        success: false,
        message: "Failed to place pre-order",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/main/offers/{offerId}/redeem:
 *   post:
 *     summary: Redeem an offer
 *     tags: [TrataTech Main - Offers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offerId
 *         required: true
 *         schema:
 *           type: number
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               merkleProof:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Offer redeemed successfully
 */
router.post(
  "/offers/:offerId/redeem",
  authenticateSimpleApiKey,
  [param("offerId").isNumeric(), body("merkleProof").optional().isArray()],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const offerId = parseInt(req.params.offerId);
      const { merkleProof = [] } = req.body;

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechMain",
        TRATATECH_MAIN_ABI,
        "redeemOffer",
        [offerId, merkleProof]
      );

      // Log blockchain activity
      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechMain,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechMain,
        "redeemOffer",
        { offerId, merkleProof }
      );

      res.json({
        success: true,
        data: {
          offerId,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
        },
        message: "Offer redeemed successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to redeem offer:", error);
      res.status(500).json({
        success: false,
        message: "Failed to redeem offer",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/main/platform-fee:
 *   get:
 *     summary: Get platform fee information
 *     tags: [TrataTech Main - Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform fee information retrieved
 */
router.get(
  "/platform-fee",
  authenticateSimpleApiKey,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const contractAddresses = blockchainService.getContractAddresses();

      const [platformFee, feeLimits] = await Promise.all([
        blockchainService.readContractMethod(
          "TrataTechMain",
          TRATATECH_MAIN_ABI,
          "platformFee"
        ),
        blockchainService.readContractMethod(
          "TrataTechMain",
          TRATATECH_MAIN_ABI,
          "feeLimits"
        ),
      ]);

      res.json({
        success: true,
        data: {
          platformFee: platformFee.toString(),
          feeLimits: {
            min: feeLimits[0].toString(),
            max: feeLimits[1].toString(),
          },
        },
        message: "Platform fee information retrieved",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to get platform fee:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get platform fee",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @swagger
 * /api/main/blockchain-activity:
 *   get:
 *     summary: Get blockchain activity logs
 *     tags: [TrataTech Main - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *       - in: query
 *         name: contractAddress
 *         schema:
 *           type: string
 *       - in: query
 *         name: functionName
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Blockchain activity retrieved
 */
router.get(
  "/blockchain-activity",
  authenticateSimpleApiKey,
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("contractAddress").optional().isString(),
    query("functionName").optional().isString(),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const contractAddress = req.query.contractAddress as string;
      const functionName = req.query.functionName as string;

      const filter: any = {};
      if (contractAddress) filter.contractAddress = contractAddress;
      if (functionName) filter.functionName = functionName;

      const skip = (page - 1) * limit;

      const [activities, total] = await Promise.all([
        BlockchainActivity.find(filter)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        BlockchainActivity.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: activities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
        message: "Blockchain activity retrieved",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to get blockchain activity:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get blockchain activity",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Cancel Event
router.post(
  "/events/:eventId/cancel",
  authenticateSimpleApiKey,
  [
    param("eventId")
      .isInt({ min: 1 })
      .withMessage("Event ID must be a positive integer"),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { eventId } = req.params;

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechMain",
        TRATATECH_MAIN_ABI,
        "cancelEvent",
        [eventId]
      );

      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechMain,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechMain,
        "cancelEvent",
        { eventId }
      );

      res.json({
        success: true,
        data: {
          eventId: parseInt(eventId),
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
        },
        message: "Event cancelled successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to cancel event:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel event",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Airdrop Artwork
router.post(
  "/artwork/:dropId/airdrop",
  authenticateSimpleApiKey,
  [
    param("dropId")
      .isInt({ min: 1 })
      .withMessage("Drop ID must be a positive integer"),
    body("recipients")
      .isArray({ min: 1, max: 100 })
      .withMessage("Recipients must be an array with 1-100 addresses"),
    body("recipients.*")
      .isEthereumAddress()
      .withMessage("Invalid recipient address"),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { dropId } = req.params;
      const { recipients } = req.body;

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechMain",
        TRATATECH_MAIN_ABI,
        "airdropArtwork",
        [dropId, recipients]
      );

      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechMain,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechMain,
        "airdropArtwork",
        { dropId, recipients }
      );

      res.json({
        success: true,
        data: {
          dropId: parseInt(dropId),
          recipients,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
        },
        message: "Artwork airdropped successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to airdrop artwork:", error);
      res.status(500).json({
        success: false,
        message: "Failed to airdrop artwork",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Update Platform Fee
router.post(
  "/admin/update-platform-fee",
  authenticateSimpleApiKey,
  [
    body("newFee")
      .isInt({ min: 0, max: 1000 })
      .withMessage("Fee must be between 0 and 1000 basis points"),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { newFee } = req.body;

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechMain",
        TRATATECH_MAIN_ABI,
        "updatePlatformFee",
        [newFee]
      );

      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechMain,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechMain,
        "updatePlatformFee",
        { newFee }
      );

      res.json({
        success: true,
        data: {
          newFee,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
        },
        message: "Platform fee updated successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to update platform fee:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update platform fee",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Update Fee Limits
router.post(
  "/admin/update-fee-limits",
  authenticateSimpleApiKey,
  [
    body("minFee")
      .isInt({ min: 0, max: 1000 })
      .withMessage("Min fee must be between 0 and 1000 basis points"),
    body("maxFee")
      .isInt({ min: 0, max: 1000 })
      .withMessage("Max fee must be between 0 and 1000 basis points"),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { minFee, maxFee } = req.body;

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechMain",
        TRATATECH_MAIN_ABI,
        "updateFeeLimits",
        [minFee, maxFee]
      );

      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechMain,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechMain,
        "updateFeeLimits",
        { minFee, maxFee }
      );

      res.json({
        success: true,
        data: {
          minFee,
          maxFee,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
        },
        message: "Fee limits updated successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to update fee limits:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update fee limits",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Pause Contract
router.post(
  "/admin/pause",
  authenticateSimpleApiKey,
  [],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechMain",
        TRATATECH_MAIN_ABI,
        "pause",
        []
      );

      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechMain,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechMain,
        "pause",
        {}
      );

      res.json({
        success: true,
        data: {
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
        },
        message: "Contract paused successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to pause contract:", error);
      res.status(500).json({
        success: false,
        message: "Failed to pause contract",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Unpause Contract
router.post(
  "/admin/unpause",
  authenticateSimpleApiKey,
  [],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechMain",
        TRATATECH_MAIN_ABI,
        "unpause",
        []
      );

      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechMain,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechMain,
        "unpause",
        {}
      );

      res.json({
        success: true,
        data: {
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
        },
        message: "Contract unpaused successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to unpause contract:", error);
      res.status(500).json({
        success: false,
        message: "Failed to unpause contract",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Emergency Recover ETH
router.post(
  "/admin/emergency-recover-eth",
  authenticateSimpleApiKey,
  [
    body("to").isEthereumAddress().withMessage("Invalid recipient address"),
    body("amount").isString().withMessage("Amount must be a string"),
  ],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { to, amount } = req.body;

      const contractAddresses = blockchainService.getContractAddresses();
      const receipt = await blockchainService.callContractMethod(
        "TrataTechMain",
        TRATATECH_MAIN_ABI,
        "emergencyRecoverETH",
        [to, amount]
      );

      await logBlockchainActivity(
        receipt.transactionHash,
        receipt.blockNumber,
        receipt.blockHash,
        blockchainService.getWallet().address,
        contractAddresses.TrataTechMain,
        "0",
        receipt.gasUsed,
        "0",
        receipt.status,
        contractAddresses.TrataTechMain,
        "emergencyRecoverETH",
        { to, amount }
      );

      res.json({
        success: true,
        data: {
          to,
          amount,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
        },
        message: "ETH recovered successfully",
        transactionHash: receipt.transactionHash,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to recover ETH:", error);
      res.status(500).json({
        success: false,
        message: "Failed to recover ETH",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Get Fee Limits
router.get(
  "/fee-limits",
  authenticateSimpleApiKey,
  [],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const contractAddresses = blockchainService.getContractAddresses();
      const result = await blockchainService.callContractMethod(
        "TrataTechMain",
        TRATATECH_MAIN_ABI,
        "feeLimits",
        []
      );

      res.json({
        success: true,
        data: {
          minFee: (result as any)[0],
          maxFee: (result as any)[1],
        },
        message: "Fee limits retrieved successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to get fee limits:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get fee limits",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Get Contract Owner
router.get(
  "/owner",
  authenticateSimpleApiKey,
  [],
  validateRequest,
  async (req: SimpleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const contractAddresses = blockchainService.getContractAddresses();
      const owner = await blockchainService.callContractMethod(
        "TrataTechMain",
        TRATATECH_MAIN_ABI,
        "owner",
        []
      );

      res.json({
        success: true,
        data: {
          owner,
        },
        message: "Contract owner retrieved successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to get contract owner:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get contract owner",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
