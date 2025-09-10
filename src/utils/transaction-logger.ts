import { BlockchainActivity } from "../models/BlockchainActivity.model.js";
import { logger } from "./logger.js";

export interface TransactionLogData {
  transactionHash?: string;
  blockNumber?: number;
  blockHash?: string;
  from: string;
  to: string;
  value: string;
  gasUsed?: string;
  gasPrice?: string;
  status: boolean;
  contractAddress: string;
  functionName: string;
  functionArgs: any;
  error?: string;
}

/**
 * Log blockchain transaction to MongoDB
 * This function logs both successful and failed transactions
 */
export async function logTransaction(data: TransactionLogData): Promise<void> {
  try {
    // Generate unique transaction hash for failed transactions
    const transactionHash =
      data.transactionHash ||
      `failed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const activity = new BlockchainActivity({
      transactionHash,
      blockNumber: data.blockNumber || 0,
      blockHash: data.blockHash || "failed",
      from: data.from,
      to: data.to,
      value: data.value,
      gasUsed: data.gasUsed || "0",
      gasPrice: data.gasPrice || "0",
      status: data.status,
      contractAddress: data.contractAddress,
      functionName: data.functionName,
      functionArgs: data.functionArgs,
      timestamp: Date.now(),
      error: data.error,
    });

    await activity.save();

    if (data.status) {
      logger.info(
        `✅ Blockchain transaction logged: ${data.functionName} - ${data.transactionHash}`
      );
    } else {
      logger.warn(
        `❌ Failed blockchain transaction logged: ${data.functionName} - ${data.error}`
      );
    }
  } catch (error) {
    logger.error("Failed to log blockchain transaction:", error);
  }
}

/**
 * Log successful transaction
 */
export async function logSuccessfulTransaction(
  receipt: any,
  from: string,
  contractAddress: string,
  functionName: string,
  functionArgs: any
): Promise<void> {
  await logTransaction({
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash,
    from,
    to: contractAddress,
    value: "0",
    gasUsed: receipt.gasUsed?.toString() || "0",
    gasPrice: receipt.gasPrice?.toString() || "0",
    status: true,
    contractAddress,
    functionName,
    functionArgs,
  });
}

/**
 * Log failed transaction
 */
export async function logFailedTransaction(
  error: any,
  from: string,
  contractAddress: string,
  functionName: string,
  functionArgs: any
): Promise<void> {
  await logTransaction({
    from,
    to: contractAddress,
    value: "0",
    status: false,
    contractAddress,
    functionName,
    functionArgs,
    error: error.message || "Unknown error",
  });
}
