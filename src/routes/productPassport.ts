import express, { Request, Response } from "express";
import { body, param, validationResult } from "express-validator";

// Import types
import {
  AuthenticatedRequest,
  ApiResponse,
  CreateBrandRequest,
  CreatePassportRequest,
  UpdatePassportRequest,
  InvalidatePassportRequest,
  CreateCertificateRequest,
  Brand,
  ProductPassportData,
  CertificateData,
  FeeStructure,
  TransactionResponse,
} from "../types";

// Import services
import blockchainService from "../services/blockchainService";
import databaseService from "../services/databaseService";

// Import middleware
import { requireRole, rateLimitByUser } from "../middleware/auth";
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
 *     BrandRegistration:
 *       type: object
 *       required:
 *         - name
 *         - description
 *         - website
 *         - authorizedCountries
 *         - ipfsCID
 *       properties:
 *         name:
 *           type: string
 *           description: Brand name
 *         description:
 *           type: string
 *           description: Brand description
 *         website:
 *           type: string
 *           description: Brand website URL
 *         authorizedCountries:
 *           type: array
 *           items:
 *             type: string
 *           description: List of authorized countries
 *         ipfsCID:
 *           type: string
 *           description: IPFS CID for brand metadata
 *     ProductPassport:
 *       type: object
 *       required:
 *         - brandId
 *         - productName
 *         - productDescription
 *         - serialNumber
 *         - manufacturingDate
 *         - expiryDate
 *         - ipfsCID
 *       properties:
 *         brandId:
 *           type: string
 *           description: Brand ID
 *         productName:
 *           type: string
 *           description: Product name
 *         productDescription:
 *           type: string
 *           description: Product description
 *         serialNumber:
 *           type: string
 *           description: Product serial number
 *         manufacturingDate:
 *           type: integer
 *           description: Manufacturing date timestamp
 *         expiryDate:
 *           type: integer
 *           description: Expiry date timestamp
 *         ipfsCID:
 *           type: string
 *           description: IPFS CID for product metadata
 */

/**
 * @swagger
 * /api/v1/product-passport/brands:
 *   post:
 *     summary: Register a new brand
 *     tags: [Product Passport]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BrandRegistration'
 *     responses:
 *       201:
 *         description: Brand registered successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/brands",
  [
    body("name").notEmpty().withMessage("Brand name is required"),
    body("description").notEmpty().withMessage("Brand description is required"),
    body("website").isURL().withMessage("Valid website URL is required"),
    body("authorizedCountries")
      .isArray({ min: 1 })
      .withMessage("At least one authorized country is required"),
    body("ipfsData").isObject().withMessage("IPFS data object is required"),
    body("ipfsData.metadata")
      .isObject()
      .withMessage("IPFS metadata is required"),
    body("ipfsData.metadata.name")
      .notEmpty()
      .withMessage("IPFS metadata name is required"),
    body("ipfsData.metadata.description")
      .notEmpty()
      .withMessage("IPFS metadata description is required"),
    requireRole(["admin", "operator"]),
    rateLimitByUser(5 * 60 * 1000, 10), // 5 minutes, 10 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const brandData: CreateBrandRequest = req.body;
    const userAddress = req.user?.walletAddress;

    if (!userAddress) {
      throw new Error("User wallet address is required");
    }

    try {
      // First register the brand with full data
      const receipt = await blockchainService.registerBrand(brandData);

      // Then authorize the brand address to make it active
      const authReceipt = await blockchainService.authorizeBrand(userAddress);

      // Generate the actual brandId that was used in the contract
      const actualBrandId = brandData.name.toLowerCase().replace(/\s+/g, "-");

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Brand registered and activated successfully",
        data: {
          transactionHash: receipt.hash,
          authorizationHash: authReceipt.hash,
          brandData,
          ipfsCID: receipt.ipfsCID || "",
          brandAddress: userAddress,
          brandId: actualBrandId, // Add the actual brandId used in the contract
          isActive: true,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to register and activate brand: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/product-passport/brands/{brandId}:
 *   get:
 *     summary: Get brand details
 *     tags: [Product Passport]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *         description: Brand ID
 *     responses:
 *       200:
 *         description: Brand details retrieved successfully
 *       404:
 *         description: Brand not found
 *       500:
 *         description: Server error
 */
router.get(
  "/brands/:brandId",
  [
    param("brandId")
      .isString()
      .notEmpty()
      .withMessage("Valid brand ID is required"),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const brandId = req.params["brandId"] || "";

    try {
      // Try to get brand from database first
      const brandRecord = await databaseService.getBrand(brandId);

      if (brandRecord) {
        const brand: Brand = {
          brandId,
          name: brandRecord.name,
          description: brandRecord.description,
          website: brandRecord.website,
          authorizedCountries: brandRecord.authorizedCountries,
          ipfsCID: brandRecord.ipfsHash,
          ipfsData: {
            metadata: {
              name: brandRecord.name,
              description: brandRecord.description,
            },
          },
          isVerified: true,
          isActive: brandRecord.isActive,
          registrationDate: brandRecord.createdAt.getTime(),
          owner: brandRecord.ownerAddress,
        };

        const response: ApiResponse<Brand> = {
          success: true,
          message: "Brand details retrieved successfully",
          data: brand,
        };

        return res.json(response);
      }

      // If not found in database, return 404
      const response: ApiResponse<null> = {
        success: false,
        message: "Brand not found",
        data: null,
      };

      return res.status(404).json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to get brand details: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/product-passport/brands/status/{brandAddress}:
 *   get:
 *     summary: Check brand authorization status
 *     tags: [Product Passport]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Brand's wallet address
 *     responses:
 *       200:
 *         description: Brand status retrieved successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.get(
  "/brands/status/:brandAddress",
  [
    param("brandAddress")
      .isEthereumAddress()
      .withMessage("Valid Ethereum address is required"),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const brandAddress = req.params["brandAddress"];

    if (!brandAddress) {
      throw new ValidationError("Validation failed", [
        {
          msg: "Brand address is required",
          param: "brandAddress",
          location: "params",
        },
      ]);
    }

    try {
      const isAuthorized = await blockchainService.isBrandAuthorized(
        brandAddress
      );

      const response: ApiResponse<{
        brandAddress: string;
        isAuthorized: boolean;
      }> = {
        success: true,
        message: "Brand status retrieved successfully",
        data: {
          brandAddress,
          isAuthorized,
        },
      };

      res.json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to get brand status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/product-passport/passports:
 *   post:
 *     summary: Create a new product passport
 *     tags: [Product Passport]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductPassport'
 *     responses:
 *       201:
 *         description: Product passport created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/passports",
  [
    body("brandId").isString().notEmpty().withMessage("Brand ID is required"),
    body("productName").notEmpty().withMessage("Product name is required"),
    body("productDescription")
      .notEmpty()
      .withMessage("Product description is required"),
    body("serialNumber").notEmpty().withMessage("Serial number is required"),
    body("manufacturingDate")
      .isInt({ min: 0 })
      .withMessage("Valid manufacturing date is required"),
    body("expiryDate")
      .isInt({ min: 0 })
      .withMessage("Valid expiry date is required"),
    body("ipfsData").isObject().withMessage("IPFS data object is required"),
    body("ipfsData.metadata")
      .isObject()
      .withMessage("IPFS metadata is required"),
    body("ipfsData.metadata.name")
      .notEmpty()
      .withMessage("IPFS metadata name is required"),
    body("ipfsData.metadata.description")
      .notEmpty()
      .withMessage("IPFS metadata description is required"),
    requireRole(["admin", "operator", "brand"]),
    rateLimitByUser(5 * 60 * 1000, 20), // 5 minutes, 20 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const passportData: CreatePassportRequest = req.body;

    try {
      const receipt = await blockchainService.createProductPassport(
        passportData
      );

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Product passport created successfully",
        data: {
          transactionHash: receipt.hash,
          passportId: receipt.passportId,
          passportData,
          ipfsCID: receipt.ipfsCID || "",
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to create product passport: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/product-passport/passports/{passportId}:
 *   get:
 *     summary: Get product passport details
 *     tags: [Product Passport]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: passportId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product passport ID
 *     responses:
 *       200:
 *         description: Product passport details retrieved successfully
 *       404:
 *         description: Product passport not found
 *       500:
 *         description: Server error
 */
router.get(
  "/passports/:passportId",
  [
    param("passportId")
      .isInt({ min: 1 })
      .withMessage("Valid passport ID is required"),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const passportId = parseInt(req.params["passportId"] || "0");

    try {
      const passportData = await blockchainService.getProductPassport(
        passportId
      );

      const response: ApiResponse<ProductPassportData> = {
        success: true,
        message: "Product passport details retrieved successfully",
        data: passportData,
      };

      res.json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to get product passport: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/product-passport/passports/{passportId}:
 *   put:
 *     summary: Update product passport
 *     tags: [Product Passport]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: passportId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product passport ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ipfsCID
 *             properties:
 *               ipfsCID:
 *                 type: string
 *                 description: New IPFS CID for updated metadata
 *     responses:
 *       200:
 *         description: Product passport updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product passport not found
 *       500:
 *         description: Server error
 */
router.put(
  "/passports/:passportId",
  [
    param("passportId")
      .isInt({ min: 1 })
      .withMessage("Valid passport ID is required"),
    body("ipfsData").isObject().withMessage("IPFS data object is required"),
    body("ipfsData.metadata")
      .isObject()
      .withMessage("IPFS metadata is required"),
    body("ipfsData.metadata.name")
      .notEmpty()
      .withMessage("IPFS metadata name is required"),
    body("ipfsData.metadata.description")
      .notEmpty()
      .withMessage("IPFS metadata description is required"),
    requireRole(["admin", "operator", "brand"]),
    rateLimitByUser(5 * 60 * 1000, 10), // 5 minutes, 10 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const passportId = parseInt(req.params["passportId"] || "0");
    const { ipfsData }: UpdatePassportRequest = req.body;

    try {
      const receipt = await blockchainService.updateProductPassport(
        passportId,
        ipfsData
      );

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Product passport updated successfully",
        data: {
          transactionHash: receipt.hash,
          passportId,
          ipfsCID: receipt.ipfsCID || "",
        },
      };

      res.json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to update product passport: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/product-passport/passports/{passportId}/invalidate:
 *   post:
 *     summary: Invalidate product passport
 *     tags: [Product Passport]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: passportId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product passport ID
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
 *                 description: Reason for invalidation
 *     responses:
 *       200:
 *         description: Product passport invalidated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product passport not found
 *       500:
 *         description: Server error
 */
router.post(
  "/passports/:passportId/invalidate",
  [
    param("passportId")
      .isInt({ min: 1 })
      .withMessage("Valid passport ID is required"),
    body("reason").notEmpty().withMessage("Invalidation reason is required"),
    requireRole(["admin", "operator"]),
    rateLimitByUser(5 * 60 * 1000, 5), // 5 minutes, 5 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const passportId = parseInt(req.params["passportId"] || "0");
    const { reason }: InvalidatePassportRequest = req.body;

    try {
      // This would typically call a smart contract function to invalidate the passport
      // For now, we'll return a mock response
      const response: ApiResponse<{ passportId: number; reason: string }> = {
        success: true,
        message: "Product passport invalidated successfully",
        data: {
          passportId,
          reason,
        },
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to invalidate product passport: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/product-passport/certificates:
 *   post:
 *     summary: Create manufacturing certificate
 *     tags: [Product Passport]
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
 *               - issueDate
 *               - expiryDate
 *               - ipfsCID
 *             properties:
 *               passportId:
 *                 type: integer
 *                 description: Product passport ID
 *               certificateType:
 *                 type: string
 *                 description: Type of certificate
 *               issueDate:
 *                 type: integer
 *                 description: Issue date timestamp
 *               expiryDate:
 *                 type: integer
 *                 description: Expiry date timestamp
 *               ipfsCID:
 *                 type: string
 *                 description: IPFS CID for certificate metadata
 *     responses:
 *       201:
 *         description: Certificate created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/certificates",
  [
    body("passportId")
      .isInt({ min: 1 })
      .withMessage("Valid passport ID is required"),
    body("certificateType")
      .notEmpty()
      .withMessage("Certificate type is required"),
    body("issueDate")
      .isInt({ min: 0 })
      .withMessage("Valid issue date is required"),
    body("expiryDate")
      .isInt({ min: 0 })
      .withMessage("Valid expiry date is required"),
    body("ipfsData").isObject().withMessage("IPFS data object is required"),
    body("ipfsData.metadata")
      .isObject()
      .withMessage("IPFS metadata is required"),
    body("ipfsData.metadata.name")
      .notEmpty()
      .withMessage("IPFS metadata name is required"),
    body("ipfsData.metadata.description")
      .notEmpty()
      .withMessage("IPFS metadata description is required"),
    requireRole(["admin", "operator", "certifier"]),
    rateLimitByUser(5 * 60 * 1000, 15), // 5 minutes, 15 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const certificateData: CreateCertificateRequest = req.body;

    try {
      const receipt = await blockchainService.createManufacturingCertificate(
        certificateData
      );

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Certificate created successfully",
        data: {
          transactionHash: receipt.hash,
          certificateId: receipt.certificateId,
          certificateData,
          ipfsCID: receipt.ipfsCID || "",
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new BlockchainError(
        `Failed to create certificate: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/product-passport/certificates/{certificateId}:
 *   get:
 *     summary: Get certificate details
 *     tags: [Product Passport]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: certificateId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Certificate ID
 *     responses:
 *       200:
 *         description: Certificate details retrieved successfully
 *       404:
 *         description: Certificate not found
 *       500:
 *         description: Server error
 */
router.get(
  "/certificates/:certificateId",
  [
    param("certificateId")
      .isInt({ min: 1 })
      .withMessage("Valid certificate ID is required"),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const certificateId = parseInt(req.params["certificateId"] || "0");

    try {
      // This would typically fetch from a database or blockchain
      // For now, we'll return a mock response
      const certificate: CertificateData = {
        certificateId,
        passportId: 1,
        certificateType: "Manufacturing Certificate",
        issueDate: Date.now(),
        expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year from now
        ipfsCID: "QmCertificateCID",
        isValid: true,
        issuer:
          (req as AuthenticatedRequest).user?.walletAddress ||
          "0x0000000000000000000000000000000000000000",
      };

      const response: ApiResponse<CertificateData> = {
        success: true,
        message: "Certificate details retrieved successfully",
        data: certificate,
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to get certificate details: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/product-passport/fees:
 *   get:
 *     summary: Get current fee structure
 *     tags: [Product Passport]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Fee structure retrieved successfully
 *       500:
 *         description: Server error
 */
router.get(
  "/fees",
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      // This would typically fetch from the smart contract
      // For now, we'll return a mock response
      const feeStructure: FeeStructure = {
        brandRegistration: "10000000000000000", // 0.01 ETH in wei
        passportCreation: "20000000000000000", // 0.02 ETH in wei
        certificateCreation: "5000000000000000", // 0.005 ETH in wei
        platformFeePercentage: "500", // 5%
      };

      const response: ApiResponse<FeeStructure> = {
        success: true,
        message: "Fee structure retrieved successfully",
        data: feeStructure,
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to get fee structure: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

export default router;
