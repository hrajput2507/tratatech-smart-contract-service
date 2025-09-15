import express, { Request, Response } from "express";
import { body, param, validationResult } from "express-validator";

// Import types
import {
  AuthenticatedRequest,
  ApiResponse,
  CreateDeedRequest,
  TransferDeedRequest,
  CreateTransferRequestRequest,
  SetRoyaltyRequest,
  OwnershipDeedData,
  TransferRequestData,
  RoyaltyInfo,
  TransactionResponse,
} from "../types";

// Import services
import blockchainService from "../services/blockchainService";
import { ipfsService } from "../services/ipfsService";

// Import middleware
import {
  requireRole,
  rateLimitByUser,
  requireWalletAddress,
} from "../middleware/auth";
import {
  asyncHandler,
  ValidationError,
  BlockchainError,
} from "../middleware/errorHandler";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     OwnershipDeed:
 *       type: object
 *       required:
 *         - passportId
 *         - ownerAddress
 *         - purchaseDate
 *         - purchasePrice
 *         - ipfsCID
 *       properties:
 *         passportId:
 *           type: integer
 *           description: Product passport ID
 *         ownerAddress:
 *           type: string
 *           description: Owner's wallet address
 *         purchaseDate:
 *           type: integer
 *           description: Purchase date timestamp
 *         purchasePrice:
 *           type: string
 *           description: Purchase price in wei
 *         ipfsCID:
 *           type: string
 *           description: IPFS CID for deed metadata
 *     TransferRequest:
 *       type: object
 *       required:
 *         - deedId
 *         - requesterAddress
 *         - proposedPrice
 *         - reason
 *         - expirationDate
 *       properties:
 *         deedId:
 *           type: integer
 *           description: Ownership deed ID
 *         requesterAddress:
 *           type: string
 *           description: Requester's wallet address
 *         proposedPrice:
 *           type: string
 *           description: Proposed price in wei
 *         reason:
 *           type: string
 *           description: Reason for transfer request
 *         expirationDate:
 *           type: integer
 *           description: Expiration date timestamp
 */

/**
 * @swagger
 * /api/v1/ownership/deeds:
 *   post:
 *     summary: Create a new ownership deed
 *     tags: [Ownership]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OwnershipDeed'
 *     responses:
 *       201:
 *         description: Ownership deed created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/deeds",
  [
    body("passportId")
      .isInt({ min: 1 })
      .withMessage("Valid passport ID is required"),
    body("ownerAddress")
      .isEthereumAddress()
      .withMessage("Valid Ethereum address is required"),
    body("purchaseDate")
      .isInt({ min: 0 })
      .withMessage("Valid purchase date is required"),
    body("purchasePrice").notEmpty().withMessage("Purchase price is required"),
    body("ipfsData").isObject().withMessage("IPFS data is required"),
    body("ipfsData.metadata")
      .isObject()
      .withMessage("IPFS metadata is required"),
    body("ipfsData.metadata.name")
      .notEmpty()
      .withMessage("IPFS metadata name is required"),
    body("ipfsData.metadata.description")
      .notEmpty()
      .withMessage("IPFS metadata description is required"),
    requireRole(["admin", "operator", "transferAgent"]),
    rateLimitByUser(5 * 60 * 1000, 15), // 5 minutes, 15 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const deedData: CreateDeedRequest = req.body;
    // IPFS data is now handled within the blockchain service

    try {
      const receipt = await blockchainService.createOwnershipDeed(deedData);

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Ownership deed created successfully",
        data: {
          transactionHash: receipt.hash,
          deedData,
          ipfsCID: receipt.ipfsCID || "",
          deedId: receipt.deedId,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to create ownership deed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/ownership/deeds/{deedId}:
 *   get:
 *     summary: Get ownership deed details
 *     tags: [Ownership]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deedId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ownership deed ID
 *     responses:
 *       200:
 *         description: Ownership deed details retrieved successfully
 *       404:
 *         description: Ownership deed not found
 *       500:
 *         description: Server error
 */
router.get(
  "/deeds/:deedId",
  [param("deedId").isInt({ min: 1 }).withMessage("Valid deed ID is required")],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const deedId = parseInt(req.params["deedId"] || "0");

    try {
      const deedData = await blockchainService.getOwnershipDeed(deedId);

      const response: ApiResponse<OwnershipDeedData> = {
        success: true,
        message: "Ownership deed details retrieved successfully",
        data: { ...deedData },
      };

      res.json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to get ownership deed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/ownership/deeds/{deedId}/transfer:
 *   post:
 *     summary: Transfer ownership deed to new owner
 *     tags: [Ownership]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deedId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ownership deed ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newOwner
 *               - currentOwner
 *             properties:
 *               newOwner:
 *                 type: string
 *                 description: New owner's wallet address
 *               currentOwner:
 *                 type: string
 *                 description: Current owner's wallet address (for verification)
 *     responses:
 *       200:
 *         description: Ownership deed transferred successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the current owner
 *       404:
 *         description: Ownership deed not found
 *       500:
 *         description: Server error
 */
router.post(
  "/deeds/:deedId/transfer",
  [
    param("deedId").isInt({ min: 1 }).withMessage("Valid deed ID is required"),
    body("newOwner")
      .isEthereumAddress()
      .withMessage("Valid Ethereum address is required"),
    body("currentOwner")
      .isEthereumAddress()
      .withMessage("Valid current owner address is required"),
    requireWalletAddress,
    rateLimitByUser(5 * 60 * 1000, 5), // 5 minutes, 5 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const deedId = parseInt(req.params["deedId"] || "0");
    const {
      newOwner,
      currentOwner,
    }: TransferDeedRequest & { currentOwner: string } = req.body;

    try {
      // Verify that the provided currentOwner matches the actual deed owner
      const actualOwner = await blockchainService.getDeedOwner(deedId);
      const actualOwnerStr = actualOwner.toString().toLowerCase();

      if (currentOwner.toLowerCase() !== actualOwnerStr) {
        throw new BlockchainError(
          `Invalid current owner. Provided: ${currentOwner}, Actual owner: ${actualOwnerStr}. Please provide the correct current owner address.`
        );
      }

      // Since the smart contract requires the transaction sender to be the deed owner,
      // and we don't have the private key for the deed owner, we need to use a different approach.
      // We'll create a transfer request instead, which is designed for this scenario.

      const transferRequestData = {
        deedId: deedId,
        requesterAddress: newOwner,
        proposedPrice: "0", // Free transfer
        reason: "Direct transfer request",
      };

      const receipt = await blockchainService.createTransferRequest(
        transferRequestData
      );

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message:
          "Transfer request created successfully. The deed owner needs to approve this request.",
        data: {
          transactionHash: receipt.hash,
          deedId,
          newOwner,
          currentOwner: actualOwnerStr,
          requestId: receipt.requestId || "pending",
          note: "This creates a transfer request. The current owner must approve it for the transfer to complete.",
        },
      };

      res.json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to create transfer request: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/ownership/deeds/{deedId}/direct-transfer:
 *   post:
 *     summary: Direct ownership transfer (requires current owner's private key)
 *     tags: [Ownership]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deedId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ownership deed ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newOwner
 *               - transferPrice
 *               - transferType
 *             properties:
 *               newOwner:
 *                 type: string
 *                 description: New owner's Ethereum address
 *               transferPrice:
 *                 type: string
 *                 description: Transfer price in wei
 *               transferType:
 *                 type: integer
 *                 description: Transfer type (0=PRIMARY_SALE, 1=SECONDARY_SALE, 2=GIFT)
 *               ipfsCID:
 *                 type: string
 *                 description: IPFS CID for transfer metadata
 *     responses:
 *       200:
 *         description: Ownership transferred successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the current owner
 *       404:
 *         description: Ownership deed not found
 *       500:
 *         description: Server error
 */
router.post(
  "/deeds/:deedId/direct-transfer",
  [
    param("deedId").isInt({ min: 1 }).withMessage("Valid deed ID is required"),
    body("newOwner")
      .isEthereumAddress()
      .withMessage("Valid Ethereum address is required"),
    body("transferPrice")
      .isString()
      .notEmpty()
      .withMessage("Transfer price is required"),
    body("transferType")
      .isInt({ min: 0, max: 2 })
      .withMessage(
        "Valid transfer type is required (0=PRIMARY_SALE, 1=SECONDARY_SALE, 2=GIFT)"
      ),
    body("ipfsData")
      .optional()
      .isObject()
      .withMessage("IPFS data must be an object"),
    body("ipfsData.metadata")
      .optional()
      .isObject()
      .withMessage("IPFS metadata must be an object"),
    requireRole(["admin", "operator", "owner"]),
    rateLimitByUser(5 * 60 * 1000, 3), // 5 minutes, 3 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const deedId = parseInt(req.params["deedId"] || "0");
    const { newOwner, transferPrice, transferType, ipfsData } = req.body;

    try {
      // Handle IPFS data - use provided CID or upload metadata
      let finalIpfsCID = ipfsData?.cid;
      if (!finalIpfsCID && ipfsData?.metadata) {
        // Upload metadata to IPFS
        const result = await ipfsService.uploadMetadata(ipfsData.metadata);
        finalIpfsCID = result.hash;
      } else if (!finalIpfsCID) {
        // Generate default IPFS CID
        finalIpfsCID = `QmDirectTransfer${Date.now()}`;
      }

      // Verify current owner before transfer
      const currentOwner = await blockchainService.getDeedOwner(deedId);
      console.log(`Current owner of deed ${deedId}: ${currentOwner}`);

      // Execute direct transfer
      const receipt = await blockchainService.transferOwnershipDeed(
        deedId,
        newOwner,
        transferPrice,
        transferType,
        finalIpfsCID
      );

      // Verify transfer was successful
      const newOwnerAfterTransfer = await blockchainService.getDeedOwner(
        deedId
      );

      if (newOwnerAfterTransfer.toLowerCase() !== newOwner.toLowerCase()) {
        throw new Error(
          "Transfer verification failed - ownership did not change"
        );
      }

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Ownership transferred successfully",
        data: {
          transactionHash: receipt.hash,
          deedId,
          previousOwner: currentOwner,
          newOwner,
          transferPrice,
          transferType,
          ipfsCID: finalIpfsCID,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed?.toString() || "0",
        },
      };

      res.json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to transfer ownership: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/ownership/deeds/{deedId}/lock:
 *   post:
 *     summary: Lock ownership deed (prevent transfers)
 *     tags: [Ownership]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deedId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ownership deed ID
 *     responses:
 *       200:
 *         description: Ownership deed locked successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the current owner
 *       404:
 *         description: Ownership deed not found
 *       500:
 *         description: Server error
 */
router.post(
  "/deeds/:deedId/lock",
  [
    param("deedId").isInt({ min: 1 }).withMessage("Valid deed ID is required"),
    requireWalletAddress,
    rateLimitByUser(5 * 60 * 1000, 3), // 5 minutes, 3 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const deedId = parseInt(req.params["deedId"] || "0");

    try {
      // This would typically call a smart contract function to lock the deed
      // For now, we'll return a mock response
      const response: ApiResponse<{ deedId: number; locked: boolean }> = {
        success: true,
        message: "Ownership deed locked successfully",
        data: {
          deedId,
          locked: true,
        },
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to lock ownership deed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/ownership/deeds/{deedId}/unlock:
 *   post:
 *     summary: Unlock ownership deed (allow transfers)
 *     tags: [Ownership]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deedId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ownership deed ID
 *     responses:
 *       200:
 *         description: Ownership deed unlocked successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the current owner
 *       404:
 *         description: Ownership deed not found
 *       500:
 *         description: Server error
 */
router.post(
  "/deeds/:deedId/unlock",
  [
    param("deedId").isInt({ min: 1 }).withMessage("Valid deed ID is required"),
    requireWalletAddress,
    rateLimitByUser(5 * 60 * 1000, 3), // 5 minutes, 3 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const deedId = parseInt(req.params["deedId"] || "0");

    try {
      // This would typically call a smart contract function to unlock the deed
      // For now, we'll return a mock response
      const response: ApiResponse<{ deedId: number; locked: boolean }> = {
        success: true,
        message: "Ownership deed unlocked successfully",
        data: {
          deedId,
          locked: false,
        },
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to unlock ownership deed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/ownership/transfer-requests:
 *   post:
 *     summary: Create a transfer request for an ownership deed
 *     tags: [Ownership]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransferRequest'
 *     responses:
 *       201:
 *         description: Transfer request created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/transfer-requests",
  [
    body("deedId").isInt({ min: 1 }).withMessage("Valid deed ID is required"),
    body("requesterAddress")
      .isEthereumAddress()
      .withMessage("Valid Ethereum address is required"),
    body("proposedPrice").notEmpty().withMessage("Proposed price is required"),
    body("reason").notEmpty().withMessage("Reason is required"),
    body("expirationDate")
      .isInt({ min: 0 })
      .withMessage("Valid expiration date is required"),
    requireRole(["admin", "operator", "transferAgent"]),
    rateLimitByUser(5 * 60 * 1000, 10), // 5 minutes, 10 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const requestData: CreateTransferRequestRequest = req.body;

    try {
      const receipt = await blockchainService.createTransferRequest(
        requestData
      );

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Transfer request created successfully",
        data: {
          transactionHash: receipt.hash,
          requestData,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to create transfer request: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/ownership/transfer-requests/{requestId}:
 *   get:
 *     summary: Get transfer request details
 *     tags: [Ownership]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Transfer request ID
 *     responses:
 *       200:
 *         description: Transfer request details retrieved successfully
 *       404:
 *         description: Transfer request not found
 *       500:
 *         description: Server error
 */
router.get(
  "/transfer-requests/:requestId",
  [
    param("requestId")
      .isInt({ min: 1 })
      .withMessage("Valid request ID is required"),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const requestId = parseInt(req.params["requestId"] || "0");

    try {
      // This would typically fetch from a database or blockchain
      // For now, we'll return a mock response
      const transferRequest: TransferRequestData = {
        requestId,
        deedId: 1,
        requesterAddress: "0x1234567890123456789012345678901234567890",
        proposedPrice: "1000000000000000000", // 1 ETH in wei
        reason: "Purchase offer",
        expirationDate: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
        status: "PENDING",
        creationDate: Date.now(),
      };

      const response: ApiResponse<TransferRequestData> = {
        success: true,
        message: "Transfer request details retrieved successfully",
        data: transferRequest,
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to get transfer request: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/ownership/transfer-requests/{requestId}/approve:
 *   post:
 *     summary: Approve a transfer request
 *     tags: [Ownership]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Transfer request ID
 *     responses:
 *       200:
 *         description: Transfer request approved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the deed owner
 *       404:
 *         description: Transfer request not found
 *       500:
 *         description: Server error
 */
router.post(
  "/transfer-requests/:requestId/approve",
  [
    param("requestId")
      .isInt({ min: 1 })
      .withMessage("Valid request ID is required"),
    requireWalletAddress,
    rateLimitByUser(5 * 60 * 1000, 5), // 5 minutes, 5 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const requestId = parseInt(req.params["requestId"] || "0");

    try {
      // This would typically call a smart contract function to approve the request
      // For now, we'll return a mock response
      const response: ApiResponse<{ requestId: number; status: string }> = {
        success: true,
        message: "Transfer request approved successfully",
        data: {
          requestId,
          status: "APPROVED",
        },
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to approve transfer request: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/ownership/transfer-requests/{requestId}/reject:
 *   post:
 *     summary: Reject a transfer request
 *     tags: [Ownership]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Transfer request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for rejection
 *     responses:
 *       200:
 *         description: Transfer request rejected successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the deed owner
 *       404:
 *         description: Transfer request not found
 *       500:
 *         description: Server error
 */
router.post(
  "/transfer-requests/:requestId/reject",
  [
    param("requestId")
      .isInt({ min: 1 })
      .withMessage("Valid request ID is required"),
    body("reason").notEmpty().withMessage("Rejection reason is required"),
    requireWalletAddress,
    rateLimitByUser(5 * 60 * 1000, 5), // 5 minutes, 5 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const requestId = parseInt(req.params["requestId"] || "0");
    const { reason } = req.body;

    try {
      // This would typically call a smart contract function to reject the request
      // For now, we'll return a mock response
      const response: ApiResponse<{
        requestId: number;
        status: string;
        reason: string;
      }> = {
        success: true,
        message: "Transfer request rejected successfully",
        data: {
          requestId,
          status: "REJECTED",
          reason,
        },
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to reject transfer request: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/ownership/transfer-requests/{requestId}/execute:
 *   post:
 *     summary: Execute an approved transfer request
 *     tags: [Ownership]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Transfer request ID
 *     responses:
 *       200:
 *         description: Transfer request executed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the requester
 *       404:
 *         description: Transfer request not found
 *       500:
 *         description: Server error
 */
router.post(
  "/transfer-requests/:requestId/execute",
  [
    param("requestId")
      .isInt({ min: 1 })
      .withMessage("Valid request ID is required"),
    requireWalletAddress,
    rateLimitByUser(5 * 60 * 1000, 3), // 5 minutes, 3 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const requestId = parseInt(req.params["requestId"] || "0");

    try {
      // This would typically call a smart contract function to execute the transfer
      // For now, we'll return a mock response
      const response: ApiResponse<{ requestId: number; status: string }> = {
        success: true,
        message: "Transfer request executed successfully",
        data: {
          requestId,
          status: "EXECUTED",
        },
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to execute transfer request: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/ownership/deeds/{deedId}/royalty:
 *   post:
 *     summary: Set royalty information for an ownership deed
 *     tags: [Ownership]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deedId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ownership deed ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiver
 *               - percentage
 *             properties:
 *               receiver:
 *                 type: string
 *                 description: Royalty receiver address
 *               percentage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Royalty percentage (0-100)
 *     responses:
 *       200:
 *         description: Royalty information set successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the deed owner
 *       404:
 *         description: Ownership deed not found
 *       500:
 *         description: Server error
 */
router.post(
  "/deeds/:deedId/royalty",
  [
    param("deedId").isInt({ min: 1 }).withMessage("Valid deed ID is required"),
    body("receiver")
      .isEthereumAddress()
      .withMessage("Valid Ethereum address is required"),
    body("percentage")
      .isFloat({ min: 0, max: 100 })
      .withMessage("Percentage must be between 0 and 100"),
    requireWalletAddress,
    rateLimitByUser(5 * 60 * 1000, 5), // 5 minutes, 5 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const deedId = parseInt(req.params["deedId"] || "0");
    const { receiver, percentage }: SetRoyaltyRequest = req.body;

    try {
      // This would typically call a smart contract function to set royalty
      // For now, we'll return a mock response
      const royaltyInfo: RoyaltyInfo = {
        receiver,
        percentage,
      };

      const response: ApiResponse<{ deedId: number; royalty: RoyaltyInfo }> = {
        success: true,
        message: "Royalty information set successfully",
        data: {
          deedId,
          royalty: royaltyInfo,
        },
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to set royalty information: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/ownership/deeds/{deedId}/royalty:
 *   delete:
 *     summary: Disable royalty for an ownership deed
 *     tags: [Ownership]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deedId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ownership deed ID
 *     responses:
 *       200:
 *         description: Royalty disabled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the deed owner
 *       404:
 *         description: Ownership deed not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/deeds/:deedId/royalty",
  [
    param("deedId").isInt({ min: 1 }).withMessage("Valid deed ID is required"),
    requireWalletAddress,
    rateLimitByUser(5 * 60 * 1000, 3), // 5 minutes, 3 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const deedId = parseInt(req.params["deedId"] || "0");

    try {
      // This would typically call a smart contract function to disable royalty
      // For now, we'll return a mock response
      const response: ApiResponse<{
        deedId: number;
        royaltyDisabled: boolean;
      }> = {
        success: true,
        message: "Royalty disabled successfully",
        data: {
          deedId,
          royaltyDisabled: true,
        },
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to disable royalty: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

export default router;
