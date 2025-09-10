import crypto from "crypto";
import { ApiKey } from "../models/ApiKey.model.js";
import { logger } from "../utils/logger.js";

export class ApiKeyService {
  private static instance: ApiKeyService;

  public static getInstance(): ApiKeyService {
    if (!ApiKeyService.instance) {
      ApiKeyService.instance = new ApiKeyService();
    }
    return ApiKeyService.instance;
  }

  /**
   * Generate a new API key
   */
  public generateApiKey(): string {
    const prefix = "tt_";
    const randomBytes = crypto.randomBytes(32);
    const key = randomBytes.toString("hex");
    return `${prefix}${key}`;
  }

  /**
   * Create a new API key
   */
  public async createApiKey(data: {
    name: string;
    description?: string;
    permissions: string[];
    expiresAt?: Date;
    createdBy: string;
  }): Promise<{ apiKey: string; keyDoc: any }> {
    try {
      const apiKey = this.generateApiKey();

      const keyDoc = new ApiKey({
        key: apiKey,
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        expiresAt: data.expiresAt,
        createdBy: data.createdBy,
        isActive: true,
      });

      await keyDoc.save();

      logger.info(`API key created: ${data.name} by ${data.createdBy}`);

      return { apiKey, keyDoc };
    } catch (error) {
      logger.error("Error creating API key:", error);
      throw error;
    }
  }

  /**
   * Get all API keys (with pagination)
   */
  public async getApiKeys(
    page: number = 1,
    limit: number = 10,
    createdBy?: string
  ): Promise<{ keys: any[]; total: number; pages: number }> {
    try {
      const query = createdBy ? { createdBy } : {};

      const skip = (page - 1) * limit;

      const [keys, total] = await Promise.all([
        ApiKey.find(query)
          .select("-key") // Don't return the actual key
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        ApiKey.countDocuments(query),
      ]);

      const pages = Math.ceil(total / limit);

      return { keys, total, pages };
    } catch (error) {
      logger.error("Error fetching API keys:", error);
      throw error;
    }
  }

  /**
   * Get API key by ID (without exposing the actual key)
   */
  public async getApiKeyById(id: string): Promise<any> {
    try {
      const keyDoc = await ApiKey.findById(id).select("-key");
      return keyDoc;
    } catch (error) {
      logger.error("Error fetching API key:", error);
      throw error;
    }
  }

  /**
   * Update API key
   */
  public async updateApiKey(
    id: string,
    updates: {
      name?: string;
      description?: string;
      permissions?: string[];
      isActive?: boolean;
      expiresAt?: Date;
    }
  ): Promise<any> {
    try {
      const keyDoc = await ApiKey.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true }
      ).select("-key");

      if (!keyDoc) {
        throw new Error("API key not found");
      }

      logger.info(`API key updated: ${id}`);
      return keyDoc;
    } catch (error) {
      logger.error("Error updating API key:", error);
      throw error;
    }
  }

  /**
   * Delete API key
   */
  public async deleteApiKey(id: string): Promise<boolean> {
    try {
      const result = await ApiKey.findByIdAndDelete(id);

      if (result) {
        logger.info(`API key deleted: ${id}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error("Error deleting API key:", error);
      throw error;
    }
  }

  /**
   * Revoke API key (deactivate)
   */
  public async revokeApiKey(id: string): Promise<boolean> {
    try {
      const result = await ApiKey.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      );

      if (result) {
        logger.info(`API key revoked: ${id}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error("Error revoking API key:", error);
      throw error;
    }
  }

  /**
   * Get API key usage statistics
   */
  public async getApiKeyStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    recentlyUsed: number;
  }> {
    try {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [total, active, expired, recentlyUsed] = await Promise.all([
        ApiKey.countDocuments(),
        ApiKey.countDocuments({ isActive: true }),
        ApiKey.countDocuments({ expiresAt: { $lt: now } }),
        ApiKey.countDocuments({ lastUsed: { $gte: oneWeekAgo } }),
      ]);

      return { total, active, expired, recentlyUsed };
    } catch (error) {
      logger.error("Error fetching API key stats:", error);
      throw error;
    }
  }
}
