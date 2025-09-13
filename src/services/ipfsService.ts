import { PinataSDK } from "pinata";
import { logger } from "../utils/logger";
import { IPFSUploadResult, IPFSMetadata } from "../types";

class IPFSService {
  private static instance: IPFSService;
  private pinata: PinataSDK | null = null;
  private gatewayUrl: string;
  private isConnected: boolean = false;

  private constructor() {
    this.gatewayUrl =
      process.env["PINATA_GATEWAY_URL"] || "https://gateway.pinata.cloud/ipfs/";
  }

  public static getInstance(): IPFSService {
    if (!IPFSService.instance) {
      IPFSService.instance = new IPFSService();
    }
    return IPFSService.instance;
  }

  public async connect(): Promise<void> {
    try {
      const pinataJwt = process.env["PINATA_JWT"];

      if (!pinataJwt) {
        throw new Error(
          "Pinata JWT is required. Please set PINATA_JWT environment variable."
        );
      }

      // Initialize Pinata SDK
      this.pinata = new PinataSDK({
        pinataJwt: pinataJwt,
        pinataGateway: process.env["PINATA_GATEWAY"] || "gateway.pinata.cloud",
      });

      // Test connection by listing files
      await this.pinata.files.public.list();

      this.isConnected = true;
      logger.info("Connected to Pinata IPFS successfully");
    } catch (error) {
      this.isConnected = false;
      logger.error("Failed to connect to Pinata IPFS:", error);
      throw new Error("IPFS connection failed");
    }
  }

  public async uploadJSON(data: any, name?: string): Promise<IPFSUploadResult> {
    if (!this.pinata || !this.isConnected) {
      throw new Error("Pinata client not connected");
    }

    try {
      const jsonString = JSON.stringify(data, null, 2);
      // const blob = new Blob([jsonString], { type: "application/json" }); // Not used

      // Pinata expects a File, not a Blob. Create a File from the Blob.
      const file = new File([jsonString], name || "data.json", {
        type: "application/json",
      });

      const upload = await this.pinata.upload.public
        .file(file)
        .name(name || "data.json")
        .keyvalues({
          type: "json",
          timestamp: new Date().toISOString(),
        });

      const hash = upload.cid;
      // const url = `${this.gatewayUrl}${hash}`; // Not used

      logger.info(`JSON uploaded to Pinata IPFS: ${hash}`);

      return {
        hash,
        size: upload.size,
        path: hash,
      };
    } catch (error) {
      logger.error("Failed to upload JSON to Pinata IPFS:", error);
      throw error;
    }
  }

  public async uploadFile(
    fileBuffer: Buffer,
    filename: string
  ): Promise<IPFSUploadResult> {
    if (!this.pinata || !this.isConnected) {
      throw new Error("Pinata client not connected");
    }

    try {
      // const blob = new Blob([fileBuffer]); // Not used

      // Pinata expects a File, not a Blob. Create a File from the Buffer.
      const file = new File([fileBuffer], filename, {
        type: "application/octet-stream",
      });

      const upload = await this.pinata.upload.public
        .file(file)
        .name(filename)
        .keyvalues({
          type: "file",
          timestamp: new Date().toISOString(),
        });

      const hash = upload.cid;
      // const url = `${this.gatewayUrl}${hash}`; // Not used

      logger.info(`File uploaded to Pinata IPFS: ${hash} (${filename})`);

      return {
        hash,
        size: upload.size,
        path: hash,
      };
    } catch (error) {
      logger.error("Failed to upload file to Pinata IPFS:", error);
      throw error;
    }
  }

  public async uploadMetadata(
    metadata: IPFSMetadata
  ): Promise<IPFSUploadResult> {
    // Add a unique timestamp to ensure each upload generates a unique hash
    const uniqueMetadata = {
      ...metadata,
      _uploadTimestamp: new Date().toISOString(),
      _uniqueId: Math.random().toString(36).substring(2, 15),
    };
    return this.uploadJSON(uniqueMetadata, "metadata.json");
  }

  public async retrieveData(hash: string): Promise<any> {
    try {
      const response = await fetch(`${this.gatewayUrl}${hash}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      logger.error(
        `Failed to retrieve data from Pinata IPFS (hash: ${hash}):`,
        error
      );
      throw error;
    }
  }

  public async pinHash(hash: string): Promise<void> {
    if (!this.pinata || !this.isConnected) {
      throw new Error("Pinata client not connected");
    }

    try {
      // In V2 SDK, pinning is handled automatically during upload
      // This method is kept for compatibility but doesn't need to do anything
      logger.info(`Hash ${hash} is already pinned (automatic in V2 SDK)`);
    } catch (error) {
      logger.error(`Failed to pin hash ${hash}:`, error);
      throw error;
    }
  }

  public async unpinHash(hash: string): Promise<void> {
    if (!this.pinata || !this.isConnected) {
      throw new Error("Pinata client not connected");
    }

    try {
      await this.pinata.files.public.delete([hash]);
      logger.info(`Unpinned hash from Pinata IPFS: ${hash}`);
    } catch (error) {
      logger.error(`Failed to unpin hash ${hash}:`, error);
      throw error;
    }
  }

  public getGatewayURL(hash: string): string {
    return `${this.gatewayUrl}${hash}`;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.pinata || !this.isConnected) {
        return false;
      }

      // Test connection by listing files
      await this.pinata.files.public.list();
      return true;
    } catch (error) {
      logger.error("Pinata IPFS health check failed:", error);
      return false;
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public async disconnect(): Promise<void> {
    this.isConnected = false;
    this.pinata = null;
    logger.info("Disconnected from Pinata IPFS");
  }

  public async getPinnedFiles(): Promise<any[]> {
    if (!this.pinata || !this.isConnected) {
      throw new Error("Pinata client not connected");
    }

    try {
      const response = await this.pinata.files.public.list();
      // According to lint, 'rows' does not exist on FileListResponse.
      // Return the response as is, or adapt as needed.
      return Array.isArray(response) ? response : [response];
    } catch (error) {
      logger.error("Failed to get pinned files from Pinata IPFS:", error);
      throw error;
    }
  }

  public async listFiles(_options?: {
    pageLimit?: number;
    pageOffset?: number;
  }): Promise<any> {
    if (!this.pinata || !this.isConnected) {
      throw new Error("Pinata client not connected");
    }

    try {
      // The Pinata SDK's files.public.list() does not accept any arguments.
      // If options are needed, handle pagination/filtering at a higher level.
      return await this.pinata.files.public.list();
    } catch (error) {
      logger.error("Failed to list files from Pinata IPFS:", error);
      throw error;
    }
  }

  public async updateFileMetadata(
    cid: string,
    _name?: string,
    _keyvalues?: Record<string, any>
  ): Promise<any> {
    if (!this.pinata || !this.isConnected) {
      throw new Error("Pinata client not connected");
    }

    try {
      // The Pinata SDK's files.public.update() expects only the CID as an argument.
      // Metadata updates (name, keyvalues) are not supported in the current SDK.
      // The Pinata SDK's files.public.update() expects an UpdateFileOptions object, not just a CID string.
      // However, metadata updates (name, keyvalues) are not supported in the current SDK.
      // We'll call update with the minimal required object.
      // return await this.pinata.files.public.update({ cid });
      // Note: name and keyvalues are ignored as the SDK does not support them.
    } catch (error) {
      logger.error(`Failed to update file metadata for ${cid}:`, error);
      throw error;
    }
  }
}

export const ipfsService = IPFSService.getInstance();
/**
 * Helper functions for IPFS data handling
 */

export interface NormalizedIPFSMetadata {
  name: string;
  description: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  external_url?: string;
  animation_url?: string;
  [key: string]: any; // Allow additional properties
}

/**
 * Normalizes IPFS metadata to ensure required fields are present
 */
export function normalizeIPFSMetadata(
  ipfsData: any,
  fallbackName: string,
  fallbackDescription: string
): NormalizedIPFSMetadata {
  return {
    name: ipfsData.name || fallbackName,
    description: ipfsData.description || fallbackDescription,
    image: ipfsData.image,
    attributes: ipfsData.attributes,
    external_url: ipfsData.external_url,
    animation_url: ipfsData.animation_url,
    ...ipfsData, // Include all other properties
  };
}
