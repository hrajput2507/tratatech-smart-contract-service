import express, { Response } from "express";
import { body, param, validationResult } from "express-validator";

// Import types
import {
  AuthenticatedRequest,
  ApiResponse,
  OperatorAuthorization,
  FeeUpdate,
  EmergencyRecoveryRequest,
  SystemStatus,
  ContractAddresses,
  TransactionResponse,
} from "../types";

// Import services
import blockchainService from "../services/blockchainService";

// Import middleware
import { requireRole, rateLimitByUser } from "../middleware/auth";
import { asyncHandler, ValidationError } from "../middleware/errorHandler";

const router = express.Router();

/**
 * @swagger
 * /api/v1/admin/brands:
 *   post:
 *     summary: Authorize a new brand (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - brandAddress
 *             properties:
 *               brandAddress:
 *                 type: string
 *                 description: Brand's wallet address to authorize
 *               brandName:
 *                 type: string
 *                 description: Name of the brand (optional, for reference)
 *               description:
 *                 type: string
 *                 description: Description of the brand (optional, for reference)
 *     responses:
 *       201:
 *         description: Brand authorized successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.post(
  "/brands",
  [
    body("brandAddress")
      .isEthereumAddress()
      .withMessage("Valid Ethereum address is required"),
    body("brandName")
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage("Brand name must be 1-100 characters"),
    body("description")
      .optional()
      .isLength({ min: 1, max: 500 })
      .withMessage("Description must be 1-500 characters"),
    requireRole(["admin"]),
    rateLimitByUser(5 * 60 * 1000, 5), // 5 minutes, 5 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const {
      brandAddress,
      brandName,
      description,
    }: { brandAddress: string; brandName?: string; description?: string } =
      req.body;

    try {
      // Check if brand is already authorized
      const isAlreadyAuthorized = await blockchainService.isBrandAuthorized(
        brandAddress
      );

      if (isAlreadyAuthorized) {
        const response: ApiResponse<TransactionResponse> = {
          success: true,
          message: "Brand is already authorized",
          data: {
            transactionHash: "already-authorized",
            brandAddress,
            brandName,
            description,
            isActive: true,
          },
        };
        return res.status(200).json(response);
      }

      const receipt = await blockchainService.authorizeBrand(brandAddress);

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Brand authorized successfully",
        data: {
          transactionHash: receipt.hash,
          brandAddress,
          brandName,
          description,
          isActive: true,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new Error(
        `Failed to authorize brand: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/admin/operators:
 *   post:
 *     summary: Authorize a new operator
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operatorAddress
 *             properties:
 *               operatorAddress:
 *                 type: string
 *                 description: Operator's wallet address
 *     responses:
 *       201:
 *         description: Operator authorized successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.post(
  "/operators",
  [
    body("operatorAddress")
      .isEthereumAddress()
      .withMessage("Valid Ethereum address is required"),
    requireRole(["admin"]),
    rateLimitByUser(5 * 60 * 1000, 5), // 5 minutes, 5 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const { operatorAddress }: OperatorAuthorization = req.body;

    try {
      const receipt = await blockchainService.authorizeOperator(
        operatorAddress
      );

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Operator authorized successfully",
        data: {
          transactionHash: receipt.hash,
          operatorAddress,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new Error(
        `Failed to authorize operator: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/admin/certifiers:
 *   post:
 *     summary: Authorize a new certifier (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - certifierAddress
 *             properties:
 *               certifierAddress:
 *                 type: string
 *                 description: Certifier's wallet address to authorize
 *     responses:
 *       201:
 *         description: Certifier authorized successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.post(
  "/certifiers",
  [
    body("certifierAddress")
      .isEthereumAddress()
      .withMessage("Valid Ethereum address is required"),
    requireRole(["admin"]),
    rateLimitByUser(5 * 60 * 1000, 5), // 5 minutes, 5 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const { certifierAddress }: { certifierAddress: string } = req.body;

    try {
      const receipt = await blockchainService.authorizeCertifier(
        certifierAddress
      );

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Certifier authorized successfully",
        data: {
          transactionHash: receipt.hash,
          certifierAddress,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new Error(
        `Failed to authorize certifier: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/admin/operators/{operatorAddress}:
 *   delete:
 *     summary: Revoke operator authorization
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: operatorAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Operator's wallet address
 *     responses:
 *       200:
 *         description: Operator authorization revoked successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.delete(
  "/operators/:operatorAddress",
  [
    param("operatorAddress")
      .isEthereumAddress()
      .withMessage("Valid Ethereum address is required"),
    requireRole(["admin"]),
    rateLimitByUser(5 * 60 * 1000, 5), // 5 minutes, 5 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const operatorAddress = req.params["operatorAddress"];

    if (!operatorAddress || typeof operatorAddress !== "string") {
      throw new ValidationError("Validation failed", [
        {
          msg: "Operator address is required",
          param: "operatorAddress",
          location: "params",
        },
      ]);
    }

    try {
      const receipt = await blockchainService.revokeOperator(operatorAddress);
      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Operator authorization revoked successfully",
        data: {
          transactionHash: receipt.hash,
          operatorAddress,
        },
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to revoke operator: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/admin/fees:
 *   put:
 *     summary: Update fee structure
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - feeType
 *               - newFee
 *             properties:
 *               feeType:
 *                 type: string
 *                 enum: [brandRegistration, passportCreation, certificateCreation, deedCreation, serviceFee, transferRequestFee]
 *                 description: Type of fee to update
 *               newFee:
 *                 type: string
 *                 description: New fee amount in wei
 *     responses:
 *       200:
 *         description: Fee structure updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.put(
  "/fees",
  [
    body("feeType")
      .isIn([
        "brandRegistration",
        "passportCreation",
        "certificateCreation",
        "deedCreation",
        "serviceFee",
        "transferRequestFee",
      ])
      .withMessage("Valid fee type is required"),
    body("newFee").notEmpty().withMessage("New fee amount is required"),
    requireRole(["admin"]),
    rateLimitByUser(5 * 60 * 1000, 3), // 5 minutes, 3 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const { feeType, newFee }: FeeUpdate = req.body;

    try {
      const receipt = await blockchainService.updateFeeStructure(
        feeType,
        newFee
      );

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Fee structure updated successfully",
        data: {
          transactionHash: receipt.hash,
          feeType,
          newFee,
        },
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to update fee structure: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/admin/emergency-stop:
 *   post:
 *     summary: Activate emergency stop (circuit breaker)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Emergency stop activated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.post(
  "/emergency-stop",
  [
    requireRole(["admin"]),
    rateLimitByUser(5 * 60 * 1000, 1), // 5 minutes, 1 request
  ],
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const receipt = await blockchainService.emergencyStop();

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Emergency stop activated successfully",
        data: {
          transactionHash: receipt.hash,
          emergencyStop: true,
        },
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to activate emergency stop: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/admin/resume:
 *   post:
 *     summary: Resume operations after emergency stop
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Operations resumed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.post(
  "/resume",
  [
    requireRole(["admin"]),
    rateLimitByUser(5 * 60 * 1000, 1), // 5 minutes, 1 request
  ],
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const receipt = await blockchainService.resumeOperations();

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Operations resumed successfully",
        data: {
          transactionHash: receipt.hash,
          emergencyStop: false,
        },
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to resume operations: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/admin/status:
 *   get:
 *     summary: Get system status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System status retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get(
  "/status",
  [requireRole(["admin"])],
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    try {
      // This would typically fetch from smart contracts
      // For now, we'll return a mock response
      const systemStatus: SystemStatus = {
        productPassport: {
          paused: false,
          emergencyStopped: false,
          owner:
            _req.user?.walletAddress ||
            "0x0000000000000000000000000000000000000000",
        },
        provenance: {
          paused: false,
          owner:
            _req.user?.walletAddress ||
            "0x0000000000000000000000000000000000000000",
        },
        ownershipRegistry: {
          paused: false,
          owner:
            _req.user?.walletAddress ||
            "0x0000000000000000000000000000000000000000",
        },
        main: {
          paused: false,
          owner:
            _req.user?.walletAddress ||
            "0x0000000000000000000000000000000000000000",
        },
      };

      const response: ApiResponse<SystemStatus> = {
        success: true,
        message: "System status retrieved successfully",
        data: systemStatus,
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to get system status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/admin/contracts:
 *   get:
 *     summary: Get deployed contract addresses
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contract addresses retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get(
  "/contracts",
  [requireRole(["admin"])],
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const contractAddresses: ContractAddresses = {
        productPassport:
          process.env["PRODUCT_PASSPORT_ADDRESS"] ||
          "0x0000000000000000000000000000000000000000",
        provenance:
          process.env["PROVENANCE_ADDRESS"] ||
          "0x0000000000000000000000000000000000000000",
        ownershipRegistry:
          process.env["OWNERSHIP_REGISTRY_ADDRESS"] ||
          "0x0000000000000000000000000000000000000000",
        main:
          process.env["MAIN_CONTRACT_ADDRESS"] ||
          "0x0000000000000000000000000000000000000000",
      };

      const response: ApiResponse<ContractAddresses> = {
        success: true,
        message: "Contract addresses retrieved successfully",
        data: contractAddresses,
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to get contract addresses: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/admin/recovery:
 *   post:
 *     summary: Emergency recovery of tokens or ETH
 *     tags: [Admin]
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
 *               tokenAddress:
 *                 type: string
 *                 description: Token contract address (optional for ETH recovery)
 *               recipient:
 *                 type: string
 *                 description: Recipient wallet address
 *     responses:
 *       200:
 *         description: Emergency recovery executed successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.post(
  "/recovery",
  [
    body("tokenAddress")
      .optional()
      .isEthereumAddress()
      .withMessage("Valid token address is required"),
    body("recipient")
      .isEthereumAddress()
      .withMessage("Valid recipient address is required"),
    requireRole(["admin"]),
    rateLimitByUser(5 * 60 * 1000, 1), // 5 minutes, 1 request
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const { tokenAddress, recipient }: EmergencyRecoveryRequest = req.body;

    try {
      // This would typically call a smart contract function for emergency recovery
      // For now, we'll return a mock response
      const response: ApiResponse<{
        tokenAddress?: string;
        recipient: string;
        recovered: boolean;
      }> = {
        success: true,
        message: "Emergency recovery executed successfully",
        data: {
          ...(tokenAddress !== undefined ? { tokenAddress } : {}),
          recipient,
          recovered: true,
        },
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to execute emergency recovery: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

export default router;
