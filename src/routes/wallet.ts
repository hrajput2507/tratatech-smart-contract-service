import { Router, Response } from "express";
import { body, validationResult } from "express-validator";
import { asyncHandler } from "../middleware/errorHandler";
import { ValidationError, BlockchainError } from "../middleware/errorHandler";
import { requireRole, rateLimitByUser } from "../middleware/auth";
import { ApiResponse, AuthenticatedRequest } from "../types";
import WalletService from "../services/walletService";
import { CreateWalletRequest, CreateWalletResponse } from "../types";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     WalletData:
 *       type: object
 *       properties:
 *         address:
 *           type: string
 *           description: The wallet address
 *           example: "0x46B176615cFa828Bd2Ad8CEA0726a7D9BED03E89"
 *         privateKey:
 *           type: string
 *           description: The wallet private key
 *           example: "0x1234567890abcdef..."
 *         publicKey:
 *           type: string
 *           description: The wallet public key
 *           example: "0x04abcdef..."
 *         mnemonic:
 *           type: string
 *           description: The mnemonic phrase (if requested)
 *           example: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the wallet was created
 *       required:
 *         - address
 *         - privateKey
 *         - publicKey
 *         - createdAt
 *
 *     CreateWalletRequest:
 *       type: object
 *       properties:
 *         includeMnemonic:
 *           type: boolean
 *           description: Whether to include mnemonic phrase
 *           default: false
 *         userId:
 *           type: string
 *           description: Optional user ID for tracking
 *
 *     CreateWalletResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           $ref: '#/components/schemas/WalletData'
 */

/**
 * @swagger
 * /api/v1/wallet/create:
 *   post:
 *     summary: Create a new Polygon wallet
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateWalletRequest'
 *     responses:
 *       201:
 *         description: Wallet created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateWalletResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/create",
  [
    body("includeMnemonic")
      .optional()
      .isBoolean()
      .withMessage("includeMnemonic must be a boolean"),
    body("userId").optional().isString().withMessage("userId must be a string"),
    requireRole(["admin", "user"]),
    rateLimitByUser(5 * 60 * 1000, 10), // 5 minutes, 10 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const createWalletRequest: CreateWalletRequest = req.body;

    try {
      const walletData = await WalletService.createWallet(createWalletRequest);

      const response: CreateWalletResponse = {
        success: true,
        message: "Wallet created successfully",
        data: walletData,
      };

      res.status(201).json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to create wallet: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/wallet/create-from-mnemonic:
 *   post:
 *     summary: Create a wallet from mnemonic phrase
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mnemonic:
 *                 type: string
 *                 description: The mnemonic phrase
 *                 example: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
 *               userId:
 *                 type: string
 *                 description: Optional user ID for tracking
 *             required:
 *               - mnemonic
 *     responses:
 *       201:
 *         description: Wallet created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateWalletResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/create-from-mnemonic",
  [
    body("mnemonic")
      .isString()
      .notEmpty()
      .withMessage("Valid mnemonic phrase is required"),
    body("userId").optional().isString().withMessage("userId must be a string"),
    requireRole(["admin", "user"]),
    rateLimitByUser(5 * 60 * 1000, 10), // 5 minutes, 10 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const { mnemonic, userId } = req.body;

    try {
      const walletData = await WalletService.createWalletFromMnemonic(
        mnemonic,
        userId
      );

      const response: CreateWalletResponse = {
        success: true,
        message: "Wallet created from mnemonic successfully",
        data: walletData,
      };

      res.status(201).json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to create wallet from mnemonic: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/wallet/validate-address:
 *   post:
 *     summary: Validate an Ethereum address
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address:
 *                 type: string
 *                 description: The address to validate
 *                 example: "0x46B176615cFa828Bd2Ad8CEA0726a7D9BED03E89"
 *             required:
 *               - address
 *     responses:
 *       200:
 *         description: Address validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     address:
 *                       type: string
 *                     isValid:
 *                       type: boolean
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/validate-address",
  [
    body("address")
      .isString()
      .notEmpty()
      .withMessage("Valid address is required"),
    requireRole(["admin", "user"]),
    rateLimitByUser(1 * 60 * 1000, 50), // 1 minute, 50 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const { address } = req.body;

    try {
      const isValid = WalletService.isValidAddress(address);

      const response: ApiResponse<{ address: string; isValid: boolean }> = {
        success: true,
        message: isValid ? "Address is valid" : "Address is invalid",
        data: {
          address,
          isValid,
        },
      };

      res.json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to validate address: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/wallet/balance/{address}:
 *   get:
 *     summary: Get wallet balance on Polygon mainnet
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: The wallet address
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     address:
 *                       type: string
 *                     balance:
 *                       type: string
 *                     network:
 *                       type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  "/balance/:address",
  [
    requireRole(["admin", "user"]),
    rateLimitByUser(1 * 60 * 1000, 30), // 1 minute, 30 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { address } = req.params;

    if (!address || !WalletService.isValidAddress(address)) {
      throw new ValidationError("Invalid address format");
    }

    try {
      const balance = await WalletService.getBalance(address);

      const response: ApiResponse<{
        address: string;
        balance: string;
        network: string;
      }> = {
        success: true,
        message: "Balance retrieved successfully",
        data: {
          address,
          balance,
          network: "Polygon Mainnet",
        },
      };

      res.json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to get balance: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/wallet/testnet-balance/{address}:
 *   get:
 *     summary: Get wallet balance on Polygon Amoy testnet
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: The wallet address
 *     responses:
 *       200:
 *         description: Testnet balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     address:
 *                       type: string
 *                     balance:
 *                       type: string
 *                     network:
 *                       type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  "/testnet-balance/:address",
  [
    requireRole(["admin", "user"]),
    rateLimitByUser(1 * 60 * 1000, 30), // 1 minute, 30 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { address } = req.params;

    if (!address || !WalletService.isValidAddress(address)) {
      throw new ValidationError("Invalid address format");
    }

    try {
      const balance = await WalletService.getTestnetBalance(address);

      const response: ApiResponse<{
        address: string;
        balance: string;
        network: string;
      }> = {
        success: true,
        message: "Testnet balance retrieved successfully",
        data: {
          address,
          balance,
          network: "Polygon Amoy Testnet",
        },
      };

      res.json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to get testnet balance: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/wallet/balance/{address}:
 *   post:
 *     summary: Get wallet balance by chain ID
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: The wallet address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chainId:
 *                 type: number
 *                 description: The chain ID (137 for Polygon Mainnet, 80002 for Amoy Testnet)
 *                 example: 137
 *             required:
 *               - chainId
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     address:
 *                       type: string
 *                     balance:
 *                       type: string
 *                     network:
 *                       type: string
 *                     chainId:
 *                       type: number
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/balance/:address",
  [
    body("chainId").isInt({ min: 1 }).withMessage("Valid chain ID is required"),
    requireRole(["admin", "user"]),
    rateLimitByUser(1 * 60 * 1000, 30), // 1 minute, 30 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const { address } = req.params;
    const { chainId } = req.body;

    if (!address || !WalletService.isValidAddress(address)) {
      throw new ValidationError("Invalid address format");
    }

    try {
      const result = await WalletService.getBalanceByChainId(address, chainId);

      const response: ApiResponse<{
        address: string;
        balance: string;
        network: string;
        chainId: number;
      }> = {
        success: true,
        message: "Balance retrieved successfully",
        data: {
          address,
          balance: result.balance,
          network: result.network,
          chainId: result.chainId,
        },
      };

      res.json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to get balance: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

export default router;
