import express, { Request, Response } from "express";
import { body, param, validationResult } from "express-validator";

// Import types
import {
  AuthenticatedRequest,
  ApiResponse,
  CreateProvenanceEntryRequest,
  BatchProvenanceEntriesRequest,
  CreateServiceRecordRequest,
  ProvenanceEntryData,
  ServiceRecordData,
  ProvenanceStatistics,
  ProvenanceType,
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
 * components:
 *   schemas:
 *     ProvenanceEntry:
 *       type: object
 *       required:
 *         - passportId
 *         - entryType
 *         - location
 *         - description
 *         - ipfsCID
 *       properties:
 *         passportId:
 *           type: integer
 *           description: Product passport ID
 *         entryType:
 *           type: string
 *           enum: [TRANSFER, SERVICE, CUSTOM]
 *           description: Type of provenance entry
 *         location:
 *           type: string
 *           description: Location of the event
 *         description:
 *           type: string
 *           description: Description of the event
 *         ipfsCID:
 *           type: string
 *           description: IPFS CID for entry metadata
 *     ServiceRecord:
 *       type: object
 *       required:
 *         - passportId
 *         - serviceType
 *         - serviceDescription
 *         - serviceDate
 *         - nextServiceDate
 *         - ipfsCID
 *       properties:
 *         passportId:
 *           type: integer
 *           description: Product passport ID
 *         serviceType:
 *           type: string
 *           description: Type of service performed
 *         serviceDescription:
 *           type: string
 *           description: Description of the service
 *         serviceDate:
 *           type: integer
 *           description: Service date timestamp
 *         nextServiceDate:
 *           type: integer
 *           description: Next service date timestamp
 *         ipfsCID:
 *           type: string
 *           description: IPFS CID for service metadata
 */

/**
 * @swagger
 * /api/v1/provenance/entries:
 *   post:
 *     summary: Create a new provenance entry
 *     tags: [Provenance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProvenanceEntry'
 *     responses:
 *       201:
 *         description: Provenance entry created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/entries",
  [
    body("passportId")
      .isInt({ min: 1 })
      .withMessage("Valid passport ID is required"),
    body("entryType")
      .isIn(["TRANSFER", "SERVICE", "CUSTOM"])
      .withMessage("Valid entry type is required"),
    body("location").notEmpty().withMessage("Location is required"),
    body("description").notEmpty().withMessage("Description is required"),
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
    requireRole(["admin", "operator", "manufacturer", "certifier"]),
    rateLimitByUser(5 * 60 * 1000, 30), // 5 minutes, 30 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const entryData: CreateProvenanceEntryRequest = req.body;
    // IPFS data is now handled within the blockchain service

    try {
      const receipt = await blockchainService.createProvenanceEntry(entryData);

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Provenance entry created successfully",
        data: {
          transactionHash: receipt.hash,
          entryData,
          ipfsCID: receipt.ipfsCID || "",
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new Error(
        `Failed to create provenance entry: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/provenance/entries/batch:
 *   post:
 *     summary: Create multiple provenance entries in batch
 *     tags: [Provenance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - entries
 *             properties:
 *               entries:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ProvenanceEntry'
 *                 minItems: 1
 *                 maxItems: 50
 *     responses:
 *       201:
 *         description: Batch provenance entries created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/entries/batch",
  [
    body("entries")
      .isArray({ min: 1, max: 50 })
      .withMessage("Entries array must contain 1-50 items"),
    body("entries.*.passportId")
      .isInt({ min: 1 })
      .withMessage("Valid passport ID is required"),
    body("entries.*.entryType")
      .isIn(["TRANSFER", "SERVICE", "CUSTOM"])
      .withMessage("Valid entry type is required"),
    body("entries.*.location").notEmpty().withMessage("Location is required"),
    body("entries.*.description")
      .notEmpty()
      .withMessage("Description is required"),
    body("entries.*.ipfsCID").notEmpty().withMessage("IPFS CID is required"),
    requireRole(["admin", "operator", "manufacturer"]),
    rateLimitByUser(5 * 60 * 1000, 10), // 5 minutes, 10 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const { entries }: BatchProvenanceEntriesRequest = req.body;

    try {
      const receipt = await blockchainService.createBatchProvenanceEntries(
        entries
      );

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Batch provenance entries created successfully",
        data: {
          transactionHash: receipt.hash,
          entriesCount: entries.length,
          entries,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new Error(
        `Failed to create batch provenance entries: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/provenance/entries/{entryId}:
 *   get:
 *     summary: Get provenance entry details
 *     tags: [Provenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entryId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Provenance entry ID
 *     responses:
 *       200:
 *         description: Provenance entry details retrieved successfully
 *       404:
 *         description: Provenance entry not found
 *       500:
 *         description: Server error
 */
router.get(
  "/entries/:entryId",
  [
    param("entryId")
      .isInt({ min: 1 })
      .withMessage("Valid entry ID is required"),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const entryId = parseInt(req.params["entryId"] || "0");

    try {
      // This would typically fetch from a database or blockchain
      // For now, we'll return a mock response
      const entry: ProvenanceEntryData = {
        entryId,
        passportId: 1,
        entryType: "TRANSFER" as ProvenanceType,
        location: "New York, USA",
        description: "Product transferred to retail store",
        ipfsCID: "QmProvenanceCID",
        timestamp: Date.now(),
        creator:
          (req as AuthenticatedRequest).user?.walletAddress ||
          "0x0000000000000000000000000000000000000000",
      };

      const response: ApiResponse<ProvenanceEntryData> = {
        success: true,
        message: "Provenance entry details retrieved successfully",
        data: entry,
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to get provenance entry: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/provenance/services:
 *   post:
 *     summary: Create a new service record
 *     tags: [Provenance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceRecord'
 *     responses:
 *       201:
 *         description: Service record created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/services",
  [
    body("passportId")
      .isInt({ min: 1 })
      .withMessage("Valid passport ID is required"),
    body("serviceType").notEmpty().withMessage("Service type is required"),
    body("serviceDescription")
      .notEmpty()
      .withMessage("Service description is required"),
    body("serviceDate")
      .isInt({ min: 0 })
      .withMessage("Valid service date is required"),
    body("nextServiceDate")
      .isInt({ min: 0 })
      .withMessage("Valid next service date is required"),
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
    requireRole(["admin", "operator", "manufacturer", "certifier"]),
    rateLimitByUser(5 * 60 * 1000, 20), // 5 minutes, 20 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const serviceData: CreateServiceRecordRequest = req.body;
    // IPFS data is now handled within the blockchain service

    try {
      const receipt = await blockchainService.createServiceRecord(serviceData);

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Service record created successfully",
        data: {
          transactionHash: receipt.hash,
          serviceData,
          ipfsCID: receipt.ipfsCID || "",
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new Error(
        `Failed to create service record: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/provenance/services/{serviceId}:
 *   get:
 *     summary: Get service record details
 *     tags: [Provenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Service record ID
 *     responses:
 *       200:
 *         description: Service record details retrieved successfully
 *       404:
 *         description: Service record not found
 *       500:
 *         description: Server error
 */
router.get(
  "/services/:serviceId",
  [
    param("serviceId")
      .isInt({ min: 1 })
      .withMessage("Valid service ID is required"),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const serviceId = parseInt(req.params["serviceId"] || "0");

    try {
      // This would typically fetch from a database or blockchain
      // For now, we'll return a mock response
      const service: ServiceRecordData = {
        serviceId,
        passportId: 1,
        serviceType: "Maintenance",
        serviceDescription: "Regular maintenance service performed",
        serviceDate: Date.now(),
        nextServiceDate: Date.now() + 6 * 30 * 24 * 60 * 60 * 1000, // 6 months from now
        ipfsCID: "QmServiceCID",
        certificateNumber: "SRV-2024-001",
        serviceProvider:
          (req as AuthenticatedRequest).user?.walletAddress ||
          "0x0000000000000000000000000000000000000000",
      };

      const response: ApiResponse<ServiceRecordData> = {
        success: true,
        message: "Service record details retrieved successfully",
        data: service,
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to get service record: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/provenance/history/{passportId}:
 *   get:
 *     summary: Get provenance history for a product passport
 *     tags: [Provenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: passportId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product passport ID
 *       - in: query
 *         name: entryType
 *         schema:
 *           type: string
 *           enum: [TRANSFER, SERVICE, CUSTOM]
 *         description: Filter by entry type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of entries to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of entries to skip
 *     responses:
 *       200:
 *         description: Provenance history retrieved successfully
 *       404:
 *         description: Product passport not found
 *       500:
 *         description: Server error
 */
router.get(
  "/history/:passportId",
  [
    param("passportId")
      .isInt({ min: 1 })
      .withMessage("Valid passport ID is required"),
    body("entryType")
      .optional()
      .isIn(["TRANSFER", "SERVICE", "CUSTOM"])
      .withMessage("Valid entry type is required"),
    body("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    body("offset")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Offset must be non-negative"),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const passportId = parseInt(req.params["passportId"] || "0");
    const entryType = req.query["entryType"] as ProvenanceType | undefined;
    const limit = parseInt(req.query["limit"] as string) || 20;
    const offset = parseInt(req.query["offset"] as string) || 0;

    try {
      const history = await blockchainService.getProvenanceHistory(passportId);

      // Filter by entry type if provided
      let filteredHistory = history;
      if (entryType) {
        filteredHistory = history.filter(
          (entry: any) => entry.entryType === entryType
        );
      }

      // Apply pagination
      const paginatedHistory = filteredHistory.slice(offset, offset + limit);

      const response: ApiResponse<{
        entries: any[];
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      }> = {
        success: true,
        message: "Provenance history retrieved successfully",
        data: {
          entries: paginatedHistory,
          total: filteredHistory.length,
          limit,
          offset,
          hasMore: offset + limit < filteredHistory.length,
        },
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to get provenance history: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/provenance/services/{passportId}:
 *   get:
 *     summary: Get service history for a product passport
 *     tags: [Provenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: passportId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product passport ID
 *       - in: query
 *         name: serviceType
 *         schema:
 *           type: string
 *         description: Filter by service type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of services to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of services to skip
 *     responses:
 *       200:
 *         description: Service history retrieved successfully
 *       404:
 *         description: Product passport not found
 *       500:
 *         description: Server error
 */
router.get(
  "/services/:passportId",
  [
    param("passportId")
      .isInt({ min: 1 })
      .withMessage("Valid passport ID is required"),
    body("serviceType")
      .optional()
      .notEmpty()
      .withMessage("Service type cannot be empty"),
    body("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    body("offset")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Offset must be non-negative"),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const passportId = parseInt(req.params["passportId"] || "0");
    const serviceType = req.query["serviceType"] as string | undefined;
    const limit = parseInt(req.query["limit"] as string) || 20;
    const offset = parseInt(req.query["offset"] as string) || 0;

    try {
      // This would typically fetch from a database or blockchain
      // For now, we'll return a mock response
      const mockServices: ServiceRecordData[] = [
        {
          serviceId: 1,
          passportId,
          serviceType: "Maintenance",
          serviceDescription: "Regular maintenance service",
          serviceDate: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
          nextServiceDate: Date.now() + 5 * 30 * 24 * 60 * 60 * 1000, // 5 months from now
          ipfsCID: "QmService1CID",
          certificateNumber: "SRV-2024-001",
          serviceProvider: "0x1234567890123456789012345678901234567890",
        },
        {
          serviceId: 2,
          passportId,
          serviceType: "Repair",
          serviceDescription: "Component replacement",
          serviceDate: Date.now() - 60 * 24 * 60 * 60 * 1000, // 60 days ago
          nextServiceDate: Date.now() + 4 * 30 * 24 * 60 * 60 * 1000, // 4 months from now
          ipfsCID: "QmService2CID",
          certificateNumber: "SRV-2024-002",
          serviceProvider: "0x1234567890123456789012345678901234567890",
        },
      ];

      // Filter by service type if provided
      let filteredServices = mockServices;
      if (serviceType) {
        filteredServices = mockServices.filter(
          (service) => service.serviceType === serviceType
        );
      }

      // Apply pagination
      const paginatedServices = filteredServices.slice(offset, offset + limit);

      const response: ApiResponse<{
        services: ServiceRecordData[];
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      }> = {
        success: true,
        message: "Service history retrieved successfully",
        data: {
          services: paginatedServices,
          total: filteredServices.length,
          limit,
          offset,
          hasMore: offset + limit < filteredServices.length,
        },
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to get service history: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/provenance/statistics/{passportId}:
 *   get:
 *     summary: Get provenance statistics for a product passport
 *     tags: [Provenance]
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
 *         description: Provenance statistics retrieved successfully
 *       404:
 *         description: Product passport not found
 *       500:
 *         description: Server error
 */
router.get(
  "/statistics/:passportId",
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

    try {
      // This would typically calculate from a database or blockchain
      // For now, we'll return a mock response
      const statistics: ProvenanceStatistics = {
        totalEntries: "15",
        totalServices: "8",
        totalTransfers: "7",
      };

      const response: ApiResponse<ProvenanceStatistics> = {
        success: true,
        message: "Provenance statistics retrieved successfully",
        data: statistics,
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to get provenance statistics: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

export default router;
