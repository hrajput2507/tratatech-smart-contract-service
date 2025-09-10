import { Router, Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { ApiKeyService } from "../services/apikey.service.js";
import {
  authenticateApiKey,
  requirePermission,
  AuthenticatedRequest,
} from "../middleware/apikey.middleware.js";
import { logger } from "../utils/logger.js";

const router = Router();
const apiKeyService = ApiKeyService.getInstance();

/**
 * @route POST /api/apikey
 * @desc Create a new API key
 * @access Admin only
 */
router.post(
  "/",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("description").optional().isString(),
    body("permissions").isArray().withMessage("Permissions must be an array"),
    body("permissions.*")
      .isIn([
        "main:read",
        "main:write",
        "passport:read",
        "passport:write",
        "ownership:read",
        "ownership:write",
        "provenance:read",
        "provenance:write",
        "forwarder:read",
        "forwarder:write",
        "admin:all",
      ])
      .withMessage("Invalid permission"),
    body("expiresAt")
      .optional()
      .isISO8601()
      .withMessage("Invalid expiration date"),
  ],
  authenticateApiKey,
  requirePermission("admin:all"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          details: errors.array(),
        });
        return;
      }

      const { name, description, permissions, expiresAt } = req.body;
      const createdBy = req.apiKey?.name || "system";

      const { apiKey, keyDoc } = await apiKeyService.createApiKey({
        name,
        description,
        permissions,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        createdBy,
      });

      return res.status(201).json({
        success: true,
        message: "API key created successfully",
        data: {
          id: keyDoc._id,
          name: keyDoc.name,
          description: keyDoc.description,
          permissions: keyDoc.permissions,
          expiresAt: keyDoc.expiresAt,
          apiKey, // Only returned on creation
        },
      });
    } catch (error) {
      logger.error("Error creating API key:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to create API key",
      });
    }
  }
);

/**
 * @route GET /api/apikey
 * @desc Get all API keys
 * @access Admin only
 */
router.get(
  "/",
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("createdBy").optional().isString(),
  ],
  authenticateApiKey,
  requirePermission("admin:all"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          details: errors.array(),
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const createdBy = req.query.createdBy as string;

      const result = await apiKeyService.getApiKeys(page, limit, createdBy);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error("Error fetching API keys:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to fetch API keys",
      });
    }
  }
);

/**
 * @route GET /api/apikey/:id
 * @desc Get API key by ID
 * @access Admin only
 */
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid API key ID")],
  authenticateApiKey,
  requirePermission("admin:all"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          details: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const keyDoc = await apiKeyService.getApiKeyById(id);

      if (!keyDoc) {
        return res.status(404).json({
          success: false,
          error: "Not found",
          message: "API key not found",
        });
      }

      return res.json({
        success: true,
        data: keyDoc,
      });
    } catch (error) {
      logger.error("Error fetching API key:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to fetch API key",
      });
    }
  }
);

/**
 * @route PUT /api/apikey/:id
 * @desc Update API key
 * @access Admin only
 */
router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid API key ID"),
    body("name").optional().notEmpty().withMessage("Name cannot be empty"),
    body("description").optional().isString(),
    body("permissions")
      .optional()
      .isArray()
      .withMessage("Permissions must be an array"),
    body("permissions.*")
      .optional()
      .isIn([
        "main:read",
        "main:write",
        "passport:read",
        "passport:write",
        "ownership:read",
        "ownership:write",
        "provenance:read",
        "provenance:write",
        "forwarder:read",
        "forwarder:write",
        "admin:all",
      ])
      .withMessage("Invalid permission"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
    body("expiresAt")
      .optional()
      .isISO8601()
      .withMessage("Invalid expiration date"),
  ],
  authenticateApiKey,
  requirePermission("admin:all"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          details: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const updates = req.body;

      if (updates.expiresAt) {
        updates.expiresAt = new Date(updates.expiresAt);
      }

      const keyDoc = await apiKeyService.updateApiKey(id, updates);

      if (!keyDoc) {
        return res.status(404).json({
          success: false,
          error: "Not found",
          message: "API key not found",
        });
      }

      return res.json({
        success: true,
        message: "API key updated successfully",
        data: keyDoc,
      });
    } catch (error) {
      logger.error("Error updating API key:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to update API key",
      });
    }
  }
);

/**
 * @route DELETE /api/apikey/:id
 * @desc Delete API key
 * @access Admin only
 */
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid API key ID")],
  authenticateApiKey,
  requirePermission("admin:all"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          details: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const deleted = await apiKeyService.deleteApiKey(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: "Not found",
          message: "API key not found",
        });
      }

      return res.json({
        success: true,
        message: "API key deleted successfully",
      });
    } catch (error) {
      logger.error("Error deleting API key:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to delete API key",
      });
    }
  }
);

/**
 * @route POST /api/apikey/:id/revoke
 * @desc Revoke API key
 * @access Admin only
 */
router.post(
  "/:id/revoke",
  [param("id").isMongoId().withMessage("Invalid API key ID")],
  authenticateApiKey,
  requirePermission("admin:all"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          details: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const revoked = await apiKeyService.revokeApiKey(id);

      if (!revoked) {
        return res.status(404).json({
          success: false,
          error: "Not found",
          message: "API key not found",
        });
      }

      return res.json({
        success: true,
        message: "API key revoked successfully",
      });
    } catch (error) {
      logger.error("Error revoking API key:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to revoke API key",
      });
    }
  }
);

/**
 * @route GET /api/apikey/stats/overview
 * @desc Get API key statistics
 * @access Admin only
 */
router.get(
  "/stats/overview",
  authenticateApiKey,
  requirePermission("admin:all"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await apiKeyService.getApiKeyStats();

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error("Error fetching API key stats:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to fetch API key statistics",
      });
    }
  }
);

export default router;
