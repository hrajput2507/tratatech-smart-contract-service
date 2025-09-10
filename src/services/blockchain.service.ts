import { ethers, Contract, Wallet, JsonRpcProvider } from "ethers";
import { logger } from "../utils/logger.js";
import {
  ContractAddresses,
  TransactionRequest,
  TransactionReceipt,
} from "../types/index.js";

class BlockchainService {
  private static instance: BlockchainService;
  private provider: JsonRpcProvider | null = null;
  private wallet: Wallet | null = null;
  private contracts: Map<string, Contract> = new Map();
  private contractAddresses: ContractAddresses | null = null;

  private constructor() {}

  public static getInstance(): BlockchainService {
    if (!BlockchainService.instance) {
      BlockchainService.instance = new BlockchainService();
    }
    return BlockchainService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      // Initialize provider based on network
      const selectedNetwork = process.env.NETWORK || "polygon-amoy";
      let rpcUrl: string;

      if (selectedNetwork === "polygon-mainnet") {
        rpcUrl = process.env.POLYGON_MAINNET_RPC_URL || "";
        if (!rpcUrl || rpcUrl.includes("YOUR_ALCHEMY_KEY")) {
          throw new Error("Polygon Mainnet RPC URL not configured");
        }
      } else if (selectedNetwork === "polygon-amoy") {
        rpcUrl = process.env.POLYGON_AMOY_RPC_URL || "";
        if (!rpcUrl) {
          throw new Error("Polygon Amoy RPC URL not configured");
        }
      } else {
        throw new Error(`Unsupported network: ${selectedNetwork}`);
      }

      this.provider = new JsonRpcProvider(rpcUrl);

      // Initialize wallet
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        throw new Error("Private key not configured");
      }

      this.wallet = new Wallet(privateKey, this.provider);

      // Load contract addresses
      this.contractAddresses = {
        TrataTechMain: process.env.TRATATECH_MAIN_ADDRESS || "",
        TrataTechProductPassport: process.env.TRATATECH_PASSPORT_ADDRESS || "",
        TrataTechOwnershipRegistry:
          process.env.TRATATECH_OWNERSHIP_ADDRESS || "",
        TrataTechProvenance: process.env.TRATATECH_PROVENANCE_ADDRESS || "",
        TrataTechSecurityEnhanced: "",
        ERC2771Forwarder: process.env.TRATATECH_FORWARDER_ADDRESS || "",
      };

      // Validate that all required addresses are present
      const requiredAddresses = [
        "TrataTechMain",
        "TrataTechProductPassport",
        "TrataTechOwnershipRegistry",
        "TrataTechProvenance",
        "ERC2771Forwarder",
      ];

      for (const contractName of requiredAddresses) {
        if (!this.contractAddresses[contractName as keyof ContractAddresses]) {
          throw new Error(
            `Contract address for ${contractName} not configured`
          );
        }
      }

      // Test connection
      const network = await this.provider.getNetwork();
      const balance = await this.provider.getBalance(this.wallet.address);

      logger.info(
        `Connected to Ethereum network: ${network.name} (${network.chainId})`
      );
      logger.info(`Wallet address: ${this.wallet.address}`);
      logger.info(`Wallet balance: ${ethers.formatEther(balance)} ETH`);
    } catch (error) {
      logger.error("Failed to initialize blockchain service:", error);
      throw error;
    }
  }

  public getProvider(): JsonRpcProvider {
    if (!this.provider) {
      throw new Error("Blockchain provider not initialized");
    }
    return this.provider;
  }

  public getWallet(): Wallet {
    if (!this.wallet) {
      throw new Error("Wallet not initialized");
    }
    return this.wallet;
  }

  public getContractAddresses(): ContractAddresses {
    if (!this.contractAddresses) {
      throw new Error("Contract addresses not loaded");
    }
    return this.contractAddresses;
  }

  public async getContract(
    contractName: keyof ContractAddresses,
    abi: any[]
  ): Promise<Contract> {
    if (!this.contractAddresses || !this.wallet) {
      throw new Error("Blockchain service not initialized");
    }

    const contractKey = `${String(contractName)}_${
      this.contractAddresses[contractName]
    }`;

    if (this.contracts.has(contractKey)) {
      return this.contracts.get(contractKey)!;
    }

    const contractAddress = this.contractAddresses[contractName];
    if (!contractAddress) {
      throw new Error(`Contract address not found for ${String(contractName)}`);
    }

    const contract = new Contract(contractAddress, abi, this.wallet);
    this.contracts.set(contractKey, contract);

    logger.info(
      `Loaded contract ${String(contractName)} at address ${contractAddress}`
    );
    return contract;
  }

  public async sendTransaction(
    to: string,
    data: string,
    value: string = "0",
    gasLimit?: string
  ): Promise<TransactionReceipt> {
    if (!this.wallet) {
      throw new Error("Wallet not initialized");
    }

    try {
      const transactionRequest: TransactionRequest = {
        from: this.wallet.address,
        to,
        data,
        value,
        gasLimit,
      };

      // Estimate gas if not provided
      if (!gasLimit) {
        const estimatedGas = await this.wallet.estimateGas(transactionRequest);
        transactionRequest.gasLimit = estimatedGas.toString();
      }

      // Send transaction
      const tx = await this.wallet.sendTransaction(transactionRequest);
      logger.info(`Transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction receipt not received");
      }

      const transactionReceipt: TransactionReceipt = {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1,
        logs: [...receipt.logs],
      };

      logger.info(
        `Transaction confirmed: ${receipt.hash} in block ${receipt.blockNumber}`
      );
      return transactionReceipt;
    } catch (error) {
      logger.error("Failed to send transaction:", error);
      throw error;
    }
  }

  public async callContractMethod(
    contractName: keyof ContractAddresses,
    abi: any[],
    methodName: string,
    args: any[] = [],
    value: string = "0"
  ): Promise<TransactionReceipt> {
    try {
      const contract = await this.getContract(contractName, abi);

      // Get method signature
      const method = contract.interface.getFunction(methodName);
      if (!method) {
        throw new Error(
          `Method ${methodName} not found in contract ${String(contractName)}`
        );
      }

      // Encode function call
      const data = contract.interface.encodeFunctionData(methodName, args);

      // Send transaction
      const receipt = await this.sendTransaction(
        contract.target as string,
        data,
        value
      );

      logger.info(`Contract method ${methodName} executed successfully`);
      return receipt;
    } catch (error) {
      logger.error(`Failed to call contract method ${methodName}:`, error);
      throw error;
    }
  }

  public async readContractMethod(
    contractName: keyof ContractAddresses,
    abi: any[],
    methodName: string,
    args: any[] = []
  ): Promise<any> {
    try {
      const contract = await this.getContract(contractName, abi);
      const result = await contract[methodName](...args);

      logger.info(`Contract method ${methodName} read successfully`);
      return result;
    } catch (error) {
      logger.error(`Failed to read contract method ${methodName}:`, error);
      throw error;
    }
  }

  public async getTransactionStatus(txHash: string): Promise<{
    status: "pending" | "confirmed" | "failed";
    blockNumber?: number;
    gasUsed?: string;
  }> {
    if (!this.provider) {
      throw new Error("Provider not initialized");
    }

    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) {
        throw new Error("Transaction not found");
      }

      if (!tx.blockNumber) {
        return { status: "pending" };
      }

      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        return { status: "pending" };
      }

      return {
        status: receipt.status === 1 ? "confirmed" : "failed",
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      logger.error(`Failed to get transaction status for ${txHash}:`, error);
      throw error;
    }
  }

  public async getBlockNumber(): Promise<number> {
    if (!this.provider) {
      throw new Error("Provider not initialized");
    }

    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      logger.error("Failed to get block number:", error);
      throw error;
    }
  }

  public async getBalance(address: string): Promise<string> {
    if (!this.provider) {
      throw new Error("Provider not initialized");
    }

    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error(`Failed to get balance for ${address}:`, error);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.provider) {
        return false;
      }

      await this.provider.getBlockNumber();
      return true;
    } catch (error) {
      logger.error("Blockchain health check failed:", error);
      return false;
    }
  }
}

export const blockchainService = BlockchainService.getInstance();
