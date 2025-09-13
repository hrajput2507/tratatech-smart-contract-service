import express, { Request, Response } from "express";
import { body, param, validationResult } from "express-validator";

// Import types
import {
  AuthenticatedRequest,
  ApiResponse,
  CreateEventRequest,
  CreateLaunchRequest,
  CreateArtDropRequest,
  CreateOfferRequest,
  GrantEarlyAccessRequest,
  AirdropArtworkRequest,
  EventInvite,
  ProductLaunch,
  ArtDrop,
  Offer,
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
 *     EventInvite:
 *       type: object
 *       required:
 *         - eventName
 *         - eventDescription
 *         - eventDate
 *         - maxAttendees
 *         - ipfsCID
 *       properties:
 *         eventName:
 *           type: string
 *           description: Name of the event
 *         eventDescription:
 *           type: string
 *           description: Description of the event
 *         eventDate:
 *           type: integer
 *           description: Event date timestamp
 *         maxAttendees:
 *           type: integer
 *           description: Maximum number of attendees
 *         ipfsCID:
 *           type: string
 *           description: IPFS CID for event metadata
 *     ProductLaunch:
 *       type: object
 *       required:
 *         - productName
 *         - productDescription
 *         - launchDate
 *         - earlyAccessPeriod
 *         - maxEarlyAccessUsers
 *         - ipfsCID
 *       properties:
 *         productName:
 *           type: string
 *           description: Name of the product
 *         productDescription:
 *           type: string
 *           description: Description of the product
 *         launchDate:
 *           type: integer
 *           description: Launch date timestamp
 *         earlyAccessPeriod:
 *           type: integer
 *           description: Early access period in seconds
 *         maxEarlyAccessUsers:
 *           type: integer
 *           description: Maximum number of early access users
 *         ipfsCID:
 *           type: string
 *           description: IPFS CID for launch metadata
 *     ArtDrop:
 *       type: object
 *       required:
 *         - artistName
 *         - artworkTitle
 *         - artworkDescription
 *         - editionSize
 *         - ipfsCID
 *       properties:
 *         artistName:
 *           type: string
 *           description: Name of the artist
 *         artworkTitle:
 *           type: string
 *           description: Title of the artwork
 *         artworkDescription:
 *           type: string
 *           description: Description of the artwork
 *         editionSize:
 *           type: integer
 *           description: Number of editions
 *         ipfsCID:
 *           type: string
 *           description: IPFS CID for artwork metadata
 *     Offer:
 *       type: object
 *       required:
 *         - offerName
 *         - offerDescription
 *         - discountPercentage
 *         - validFrom
 *         - validUntil
 *         - maxRedemptions
 *         - ipfsCID
 *       properties:
 *         offerName:
 *           type: string
 *           description: Name of the offer
 *         offerDescription:
 *           type: string
 *           description: Description of the offer
 *         discountPercentage:
 *           type: number
 *           description: Discount percentage
 *         validFrom:
 *           type: integer
 *           description: Valid from timestamp
 *         validUntil:
 *           type: integer
 *           description: Valid until timestamp
 *         maxRedemptions:
 *           type: integer
 *           description: Maximum number of redemptions
 *         ipfsCID:
 *           type: string
 *           description: IPFS CID for offer metadata
 */

// Event Invites
router.post(
  "/events",
  [
    body("eventName").notEmpty().withMessage("Event name is required"),
    body("eventDescription")
      .notEmpty()
      .withMessage("Event description is required"),
    body("eventDate")
      .isInt({ min: 0 })
      .withMessage("Valid event date is required"),
    body("maxAttendees")
      .isInt({ min: 1 })
      .withMessage("Valid max attendees is required"),
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

    const eventData: CreateEventRequest = req.body;

    try {
      // Validate event date
      const currentTime = Math.floor(Date.now() / 1000);

      if (eventData.eventDate <= currentTime) {
        throw new Error("Event date must be in the future");
      }

      const receipt = await blockchainService.createEventInvite(eventData);

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Event invite created successfully",
        data: {
          transactionHash: receipt.hash,
          eventData,
          ipfsCID: receipt.ipfsCID || "",
        },
      };

      res.status(201).json(response);
    } catch (error) {
      // Provide more specific error messages
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("Event date must be in the future")) {
        throw new Error(
          "Event date must be in the future. Please use a timestamp that is after the current time."
        );
      } else {
        throw new Error(`Failed to create event invite: ${errorMessage}`);
      }
    }
  })
);

router.get(
  "/events/:id",
  [
    param("id").isInt({ min: 1 }).withMessage("Valid event ID is required"),
    rateLimitByUser(5 * 60 * 1000, 30), // 5 minutes, 30 requests
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    try {
      // Note: getEventInvite method doesn't exist, using mock data for now
      const eventData: EventInvite = {
        eventName: "Sample Event",
        eventDescription: "Sample event description",
        eventDate: Date.now(),
        maxAttendees: 100,
        ipfsData: {
          metadata: {
            name: "Sample Event",
            description: "Sample event description",
          },
        },
      };

      const response: ApiResponse<EventInvite> = {
        success: true,
        message: "Event invite retrieved successfully",
        data: eventData,
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to get event invite: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

router.post(
  "/events/:id/rsvp",
  [
    param("id").isInt({ min: 1 }).withMessage("Valid event ID is required"),
    requireRole(["admin", "operator", "user"]),
    rateLimitByUser(5 * 60 * 1000, 5), // 5 minutes, 5 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const eventId = parseInt(req.params["id"] || "0");
    const userAddress = req.user?.walletAddress;

    if (!userAddress) {
      throw new Error("User wallet address is required");
    }

    try {
      const receipt = await blockchainService.submitRSVP(eventId);

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "RSVP submitted successfully",
        data: {
          transactionHash: receipt.hash,
          eventId,
          userAddress,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new Error(
        `Failed to submit RSVP: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

// Product Launches
router.post(
  "/launches",
  [
    body("productName").notEmpty().withMessage("Product name is required"),
    body("productDescription")
      .notEmpty()
      .withMessage("Product description is required"),
    body("launchDate")
      .isInt({ min: 0 })
      .withMessage("Valid launch date is required"),
    body("earlyAccessPeriod")
      .isInt({ min: 0 })
      .withMessage("Valid early access period is required"),
    body("maxEarlyAccessUsers")
      .isInt({ min: 1 })
      .withMessage("Valid max early access users is required"),
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

    const launchData: CreateLaunchRequest = req.body;
    // IPFS data is now handled within the blockchain service

    try {
      // Validate early access period
      const currentTime = Math.floor(Date.now() / 1000);
      const earlyAccessEndDate =
        launchData.launchDate + launchData.earlyAccessPeriod;

      if (launchData.launchDate <= currentTime) {
        throw new Error("Launch date must be in the future");
      }

      if (earlyAccessEndDate <= launchData.launchDate) {
        throw new Error("Early access period must be positive");
      }

      const receipt = await blockchainService.createProductLaunch(launchData);

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Product launch created successfully",
        data: {
          transactionHash: receipt.hash,
          launchData,
          ipfsCID: receipt.ipfsCID || "",
        },
      };

      res.status(201).json(response);
    } catch (error) {
      // Provide more specific error messages
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("Invalid early access end date")) {
        throw new Error(
          "Invalid early access configuration. Please ensure launch date is in the future and early access period is reasonable."
        );
      } else if (errorMessage.includes("Event date must be in the future")) {
        throw new Error("Launch date must be in the future");
      } else {
        throw new Error(`Failed to create product launch: ${errorMessage}`);
      }
    }
  })
);

router.get(
  "/launches/:id",
  [
    param("id").isInt({ min: 1 }).withMessage("Valid launch ID is required"),
    rateLimitByUser(5 * 60 * 1000, 30), // 5 minutes, 30 requests
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    try {
      // Note: getProductLaunch method doesn't exist, using mock data for now
      const launchData: ProductLaunch = {
        productName: "Sample Product",
        productDescription: "Sample product description",
        launchDate: Date.now(),
        earlyAccessPeriod: 86400,
        maxEarlyAccessUsers: 1000,
        ipfsData: {
          metadata: {
            name: "Sample Event",
            description: "Sample event description",
          },
        },
      };

      const response: ApiResponse<ProductLaunch> = {
        success: true,
        message: "Product launch retrieved successfully",
        data: launchData,
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to get product launch: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

router.post(
  "/launches/:id/early-access",
  [
    param("id").isInt({ min: 1 }).withMessage("Valid launch ID is required"),
    body("userAddress")
      .isEthereumAddress()
      .withMessage("Valid Ethereum address is required"),
    requireRole(["admin", "operator"]),
    rateLimitByUser(5 * 60 * 1000, 20), // 5 minutes, 20 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const launchId = parseInt(req.params["id"] || "0");
    const { userAddress }: GrantEarlyAccessRequest = req.body;

    try {
      const receipt = await blockchainService.grantEarlyAccess(
        launchId,
        userAddress
      );

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Early access granted successfully",
        data: {
          transactionHash: receipt.hash,
          launchId,
          userAddress,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new Error(
        `Failed to grant early access: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

// Art Drops
router.post(
  "/art-drops",
  [
    body("artistName").notEmpty().withMessage("Artist name is required"),
    body("artworkTitle").notEmpty().withMessage("Artwork title is required"),
    body("artworkDescription")
      .notEmpty()
      .withMessage("Artwork description is required"),
    body("editionSize")
      .isInt({ min: 1 })
      .withMessage("Valid edition size is required"),
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

    const artDropData: CreateArtDropRequest = req.body;
    // IPFS data is now handled within the blockchain service

    try {
      const receipt = await blockchainService.createArtDrop(artDropData);

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Art drop created successfully",
        data: {
          transactionHash: receipt.hash,
          artDropData,
          ipfsCID: receipt.ipfsCID || "",
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new Error(
        `Failed to create art drop: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

router.get(
  "/art-drops/:id",
  [
    param("id").isInt({ min: 1 }).withMessage("Valid art drop ID is required"),
    rateLimitByUser(5 * 60 * 1000, 30), // 5 minutes, 30 requests
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    try {
      // Note: getArtDrop method doesn't exist, using mock data for now
      const artDropData: ArtDrop = {
        artistName: "Sample Artist",
        artworkTitle: "Sample Artwork",
        artworkDescription: "Sample artwork description",
        editionSize: 100,
        ipfsData: {
          metadata: {
            name: "Sample Event",
            description: "Sample event description",
          },
        },
      };

      const response: ApiResponse<ArtDrop> = {
        success: true,
        message: "Art drop retrieved successfully",
        data: artDropData,
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to get art drop: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

router.post(
  "/art-drops/:id/airdrop",
  [
    param("id").isInt({ min: 1 }).withMessage("Valid art drop ID is required"),
    body("recipients")
      .isArray({ min: 1 })
      .withMessage("At least one recipient is required"),
    body("recipients.*")
      .isEthereumAddress()
      .withMessage("Valid Ethereum addresses are required"),
    requireRole(["admin", "operator"]),
    rateLimitByUser(5 * 60 * 1000, 5), // 5 minutes, 5 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const artDropId = parseInt(req.params["id"] || "0");
    const { recipients }: AirdropArtworkRequest = req.body;

    try {
      const receipt = await blockchainService.airdropArtwork(
        artDropId,
        recipients
      );

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Artwork airdropped successfully",
        data: {
          transactionHash: receipt.hash,
          artDropId,
          recipients,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new Error(
        `Failed to airdrop artwork: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

// Offers
router.post(
  "/offers",
  [
    body("offerName").notEmpty().withMessage("Offer name is required"),
    body("offerDescription")
      .notEmpty()
      .withMessage("Offer description is required"),
    body("discountPercentage")
      .isFloat({ min: 0, max: 100 })
      .withMessage("Valid discount percentage is required"),
    body("validFrom")
      .isInt({ min: 0 })
      .withMessage("Valid from date is required"),
    body("validUntil")
      .isInt({ min: 0 })
      .withMessage("Valid until date is required"),
    body("maxRedemptions")
      .isInt({ min: 1 })
      .withMessage("Valid max redemptions is required"),
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

    const offerData: CreateOfferRequest = req.body;
    // IPFS data is now handled within the blockchain service

    try {
      const receipt = await blockchainService.createOffer(offerData);

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Offer created successfully",
        data: {
          transactionHash: receipt.hash,
          offerData,
          ipfsCID: receipt.ipfsCID || "",
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new Error(
        `Failed to create offer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

router.get(
  "/offers/:id",
  [
    param("id").isInt({ min: 1 }).withMessage("Valid offer ID is required"),
    rateLimitByUser(5 * 60 * 1000, 30), // 5 minutes, 30 requests
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    try {
      // Note: getOffer method doesn't exist, using mock data for now
      const offerData: Offer = {
        offerName: "Sample Offer",
        offerDescription: "Sample offer description",
        discountPercentage: 10,
        validFrom: Date.now(),
        validUntil: Date.now() + 86400000,
        maxRedemptions: 100,
        ipfsData: {
          metadata: {
            name: "Sample Event",
            description: "Sample event description",
          },
        },
      };

      const response: ApiResponse<Offer> = {
        success: true,
        message: "Offer retrieved successfully",
        data: offerData,
      };

      res.json(response);
    } catch (error) {
      throw new Error(
        `Failed to get offer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

router.post(
  "/offers/:id/redeem",
  [
    param("id").isInt({ min: 1 }).withMessage("Valid offer ID is required"),
    requireRole(["admin", "operator", "user"]),
    rateLimitByUser(5 * 60 * 1000, 5), // 5 minutes, 5 requests
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation failed", errors.array());
    }

    const offerId = parseInt(req.params["id"] || "0");
    const userAddress = req.user?.walletAddress;

    if (!userAddress) {
      throw new Error("User wallet address is required");
    }

    try {
      // Note: redeemOffer method only takes one parameter
      const receipt = await blockchainService.redeemOffer(offerId);

      const response: ApiResponse<TransactionResponse> = {
        success: true,
        message: "Offer redeemed successfully",
        data: {
          transactionHash: receipt.hash,
          offerId,
          userAddress,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      throw new Error(
        `Failed to redeem offer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  })
);

export default router;
