const { ethers } = require("ethers");
const gaslessConfig = require("../../config/gasless-config");

/**
 * GaslessRelayService - Handles gasless transactions using meta-transactions
 */
class GaslessRelayService {
    constructor(network, contractAddress, contractABI) {
        this.network = network;
        this.contractAddress = contractAddress;
        this.contractABI = contractABI;
        this.config = gaslessConfig.getProvider(network);
        this.forwarder = gaslessConfig.getForwarder(network);
    }

    /**
     * Initialize Biconomy SDK for gasless transactions
     */
    async initBiconomy(provider, signer) {
        try {
            const { Biconomy } = await import("@biconomy/mexa");
            
            const biconomy = new Biconomy(provider, {
                apiKey: this.config.apiKey,
                contractAddresses: [this.contractAddress],
                debug: this.config.debug
            });

            await new Promise((resolve, reject) => {
                biconomy.onEvent(biconomy.READY, () => {
                    console.log("Biconomy initialized successfully");
                    resolve();
                }).onEvent(biconomy.ERROR, (error) => {
                    console.error("Biconomy initialization error:", error);
                    reject(error);
                });
            });

            return biconomy;
        } catch (error) {
            console.error("Failed to initialize Biconomy:", error);
            throw error;
        }
    }

    /**
     * Initialize Gelato Relay SDK
     */
    async initGelato() {
        try {
            const { GelatoRelay } = await import("@gelatonetwork/relay-sdk");
            
            const relay = new GelatoRelay();
            return relay;
        } catch (error) {
            console.error("Failed to initialize Gelato:", error);
            throw error;
        }
    }

    /**
     * Execute gasless transaction using Biconomy
     */
    async executeWithBiconomy(functionName, params, userAddress, provider) {
        const biconomy = await this.initBiconomy(provider);
        const ethersProvider = new ethers.BrowserProvider(biconomy);
        const signer = ethersProvider.getSigner(userAddress);
        
        const contract = new ethers.Contract(
            this.contractAddress,
            this.contractABI,
            signer
        );

        // Build meta-transaction
        const tx = await contract[functionName](...params);
        const receipt = await tx.wait();
        
        return receipt;
    }

    /**
     * Execute gasless transaction using Gelato
     */
    async executeWithGelato(functionName, params, userAddress) {
        const relay = await this.initGelato();
        
        // Encode function call
        const contract = new ethers.Contract(
            this.contractAddress,
            this.contractABI
        );
        
        const data = contract.interface.encodeFunctionData(functionName, params);
        
        // Create relay request
        const request = {
            chainId: this.getChainId(),
            target: this.contractAddress,
            data: data,
            sponsorApiKey: this.config.sponsorApiKey
        };

        // Send relay request
        const relayResponse = await relay.sponsoredCall(request);
        
        // Wait for transaction
        const taskId = relayResponse.taskId;
        const status = await this.waitForGelatoTask(relay, taskId);
        
        return status;
    }

    /**
     * Build meta-transaction for ERC2771
     */
    async buildMetaTransaction(functionName, params, userAddress, nonce) {
        const contract = new ethers.Contract(
            this.contractAddress,
            this.contractABI
        );

        // Encode function data
        const data = contract.interface.encodeFunctionData(functionName, params);

        // Build meta-transaction structure
        const metaTx = {
            from: userAddress,
            to: this.contractAddress,
            value: 0,
            gas: gaslessConfig.gasLimits[functionName] || gaslessConfig.gasLimits.default,
            nonce: nonce,
            data: data,
            chainId: this.getChainId()
        };

        return metaTx;
    }

    /**
     * Sign meta-transaction using EIP-712
     */
    async signMetaTransaction(metaTx, signer) {
        const domain = {
            name: "TrataTech Platform",
            version: "1",
            chainId: metaTx.chainId,
            verifyingContract: this.forwarder
        };

        const types = {
            ForwardRequest: [
                { name: "from", type: "address" },
                { name: "to", type: "address" },
                { name: "value", type: "uint256" },
                { name: "gas", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "data", type: "bytes" }
            ]
        };

        const signature = await signer.signTypedData(domain, types, metaTx);
        return signature;
    }

    /**
     * Submit meta-transaction to relayer
     */
    async submitMetaTransaction(metaTx, signature) {
        const relayerUrl = process.env.RELAYER_URL || "http://localhost:3001/relay";
        
        const response = await fetch(relayerUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                metaTx,
                signature,
                forwarder: this.forwarder
            })
        });

        if (!response.ok) {
            throw new Error(`Relay failed: ${response.statusText}`);
        }

        const result = await response.json();
        return result.txHash;
    }

    /**
     * Execute gasless transaction
     */
    async executeGasless(functionName, params, userAddress, signer) {
        try {
            // Check if method is supported for gasless
            if (!gaslessConfig.supportedMethods.includes(functionName)) {
                throw new Error(`Method ${functionName} is not supported for gasless transactions`);
            }

            // Get user's nonce from forwarder
            const nonce = await this.getUserNonce(userAddress);

            // Build meta-transaction
            const metaTx = await this.buildMetaTransaction(
                functionName,
                params,
                userAddress,
                nonce
            );

            // Sign meta-transaction
            const signature = await this.signMetaTransaction(metaTx, signer);

            // Submit to relayer
            const txHash = await this.submitMetaTransaction(metaTx, signature);

            // Wait for confirmation
            const receipt = await this.waitForTransaction(txHash);

            return {
                success: true,
                txHash,
                receipt
            };
        } catch (error) {
            console.error("Gasless transaction failed:", error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get user nonce from forwarder contract
     */
    async getUserNonce(userAddress) {
        const provider = new ethers.JsonRpcProvider(this.getRpcUrl());
        
        // Minimal forwarder ABI for getNonce
        const forwarderABI = [
            "function getNonce(address from) view returns (uint256)"
        ];
        
        const forwarder = new ethers.Contract(
            this.forwarder,
            forwarderABI,
            provider
        );

        const nonce = await forwarder.getNonce(userAddress);
        return nonce;
    }

    /**
     * Wait for transaction confirmation
     */
    async waitForTransaction(txHash) {
        const provider = new ethers.JsonRpcProvider(this.getRpcUrl());
        const receipt = await provider.waitForTransaction(txHash);
        return receipt;
    }

    /**
     * Wait for Gelato task completion
     */
    async waitForGelatoTask(relay, taskId) {
        let status;
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes with 5 second intervals

        while (attempts < maxAttempts) {
            status = await relay.getTaskStatus(taskId);
            
            if (status.taskState === "ExecSuccess") {
                return status;
            } else if (status.taskState === "ExecReverted" || status.taskState === "Cancelled") {
                throw new Error(`Task failed: ${status.taskState}`);
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
        }

        throw new Error("Task timeout");
    }

    /**
     * Get chain ID based on network
     */
    getChainId() {
        const chainIds = {
            polygon: 137,
            polygonAmoy: 80002,
            localhost: 31337,
            hardhat: 31337
        };
        return chainIds[this.network] || 1;
    }

    /**
     * Get RPC URL based on network
     */
    getRpcUrl() {
        const rpcUrls = {
            polygon: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
            polygonAmoy: process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
            localhost: "http://localhost:8545",
            hardhat: "http://localhost:8545"
        };
        return rpcUrls[this.network];
    }

    /**
     * Estimate gas for a transaction (for comparison with gasless)
     */
    async estimateGas(functionName, params) {
        const provider = new ethers.JsonRpcProvider(this.getRpcUrl());
        const contract = new ethers.Contract(
            this.contractAddress,
            this.contractABI,
            provider
        );

        const estimatedGas = await contract[functionName].estimateGas(...params);
        const gasPrice = await provider.getFeeData();
        
        const estimatedCost = estimatedGas * gasPrice.gasPrice;
        
        return {
            gasLimit: estimatedGas.toString(),
            gasPrice: gasPrice.gasPrice.toString(),
            estimatedCost: ethers.formatEther(estimatedCost),
            savedAmount: ethers.formatEther(estimatedCost) // Amount saved by using gasless
        };
    }
}

module.exports = GaslessRelayService;