import {
  Wallet,
  JsonRpcProvider,
  formatEther,
  isAddress,
  Mnemonic,
} from "ethers";
import { WalletData, CreateWalletRequest } from "../types";

/**
 * Wallet Service for generating Polygon-compatible wallets
 */
export class WalletService {
  /**
   * Generate a new Polygon wallet
   * @param options - Wallet creation options
   * @returns Wallet data including address, private key, and public key
   */
  static async createWallet(
    options: CreateWalletRequest = {}
  ): Promise<WalletData> {
    try {
      const { includeMnemonic = false, userId } = options;

      // Generate a new random wallet
      const wallet = Wallet.createRandom();

      // Get the wallet data
      const address = wallet.address;
      const privateKey = wallet.privateKey;
      const publicKey = wallet.publicKey;

      // Create wallet data object
      const walletData: WalletData = {
        address,
        privateKey,
        publicKey,
        createdAt: new Date().toISOString(),
      };

      // Include mnemonic if requested
      if (includeMnemonic && wallet.mnemonic) {
        walletData.mnemonic = wallet.mnemonic.phrase;
      }

      // Log wallet creation (without sensitive data)
      console.log(
        `[WalletService] New wallet created for user: ${userId || "anonymous"}`
      );
      console.log(`[WalletService] Address: ${address}`);

      return walletData;
    } catch (error) {
      console.error("[WalletService] Error creating wallet:", error);
      throw new Error(
        `Failed to create wallet: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Create wallet from mnemonic phrase
   * @param mnemonic - The mnemonic phrase
   * @param userId - Optional user ID for tracking
   * @returns Wallet data
   */
  static async createWalletFromMnemonic(
    mnemonic: string,
    userId?: string
  ): Promise<WalletData> {
    try {
      // Validate mnemonic
      try {
        Mnemonic.fromPhrase(mnemonic);
      } catch (error) {
        throw new Error("Invalid mnemonic phrase");
      }

      // Create wallet from mnemonic
      const wallet = Wallet.fromPhrase(mnemonic);

      // Get the wallet data
      const address = wallet.address;
      const privateKey = wallet.privateKey;
      const publicKey = wallet.publicKey;

      // Create wallet data object
      const walletData: WalletData = {
        address,
        privateKey,
        publicKey,
        mnemonic,
        createdAt: new Date().toISOString(),
      };

      // Log wallet creation (without sensitive data)
      console.log(
        `[WalletService] Wallet created from mnemonic for user: ${
          userId || "anonymous"
        }`
      );
      console.log(`[WalletService] Address: ${address}`);

      return walletData;
    } catch (error) {
      console.error(
        "[WalletService] Error creating wallet from mnemonic:",
        error
      );
      throw new Error(
        `Failed to create wallet from mnemonic: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Validate an Ethereum address
   * @param address - The address to validate
   * @returns True if valid, false otherwise
   */
  static isValidAddress(address: string): boolean {
    try {
      return isAddress(address);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get wallet balance on Polygon network
   * @param address - The wallet address
   * @param rpcUrl - Optional RPC URL (defaults to Polygon mainnet)
   * @returns Balance in MATIC
   */
  static async getBalance(address: string, rpcUrl?: string): Promise<string> {
    try {
      // Use provided RPC URL or default to Polygon mainnet
      const provider = new JsonRpcProvider(
        rpcUrl || process.env["POLYGON_RPC_URL"] || "https://polygon-rpc.com"
      );

      const balance = await provider.getBalance(address);
      return formatEther(balance);
    } catch (error) {
      console.error("[WalletService] Error getting balance:", error);
      throw new Error(
        `Failed to get balance: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get wallet balance on Polygon Amoy testnet
   * @param address - The wallet address
   * @returns Balance in MATIC
   */
  static async getTestnetBalance(address: string): Promise<string> {
    try {
      const provider = new JsonRpcProvider(
        process.env["POLYGON_AMOY_RPC_URL"] ||
          "https://rpc-amoy.polygon.technology"
      );

      const balance = await provider.getBalance(address);
      return formatEther(balance);
    } catch (error) {
      console.error("[WalletService] Error getting testnet balance:", error);
      throw new Error(
        `Failed to get testnet balance: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get wallet balance by chain ID
   * @param address - The wallet address
   * @param chainId - The chain ID (137 for Polygon mainnet, 80002 for Amoy testnet)
   * @returns Balance in MATIC
   */
  static async getBalanceByChainId(
    address: string,
    chainId: number
  ): Promise<{ balance: string; network: string; chainId: number }> {
    try {
      let provider: JsonRpcProvider;
      let network: string;

      switch (chainId) {
        case 137: // Polygon Mainnet
          provider = new JsonRpcProvider(
            process.env["POLYGON_RPC_URL"] || "https://polygon-rpc.com"
          );
          network = "Polygon Mainnet";
          break;
        case 80002: // Polygon Amoy Testnet
          provider = new JsonRpcProvider(
            process.env["POLYGON_AMOY_RPC_URL"] ||
              "https://rpc-amoy.polygon.technology"
          );
          network = "Polygon Amoy Testnet";
          break;
        default:
          throw new Error(
            `Unsupported chain ID: ${chainId}. Supported chains: 137 (Polygon Mainnet), 80002 (Amoy Testnet)`
          );
      }

      const balance = await provider.getBalance(address);
      return {
        balance: formatEther(balance),
        network,
        chainId,
      };
    } catch (error) {
      console.error(
        "[WalletService] Error getting balance by chain ID:",
        error
      );
      throw new Error(
        `Failed to get balance: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}

export default WalletService;
