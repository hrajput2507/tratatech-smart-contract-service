import {
  ethers,
  Contract,
  JsonRpcProvider,
  Wallet,
  ContractTransactionResponse,
} from "ethers";
import fs from "fs";
import path from "path";

// Import types
import {
  BrandRegistration,
  ProductPassport,
  ProvenanceEntry,
  ServiceRecord,
  OwnershipDeed,
  TransferRequest,
  EventInvite,
  ProductLaunch,
  ArtDrop,
  Offer,
  ContractArtifact,
  ContractAddresses as ContractAddressesType,
  IPFSObject,
} from "../types";

// Import services
import { ipfsService } from "./ipfsService";
import databaseService from "./databaseService";

class BlockchainService {
  private provider: JsonRpcProvider | null = null;
  private signer: Wallet | null = null;
  private contracts: Record<string, ContractArtifact> = {};
  private isInitialized: boolean = false;
  private network: string = process.env["NETWORK"] || "polygon-amoy";

  // Contract instances
  public productPassportContract: Contract | any = null;
  public provenanceContract: Contract | any = null;
  public ownershipRegistryContract: Contract | any = null;
  public mainContract: Contract | any = null;

  async initialize(): Promise<void> {
    try {
      // Initialize provider based on network
      const rpcUrl = this.getRpcUrl();
      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      // Initialize signer if private key is provided
      if (process.env["PRIVATE_KEY"]) {
        this.signer = new ethers.Wallet(
          process.env["PRIVATE_KEY"],
          this.provider
        );
      }

      // Load contract ABIs
      await this.loadContractABIs();

      // Initialize contracts
      await this.initializeContracts();

      // Initialize database connection
      await databaseService.connect();

      // Test IPFS connection
      await ipfsService.connect();

      this.isInitialized = true;
      console.log(
        `✅ Blockchain service initialized for network: ${this.network}`
      );
    } catch (error) {
      console.error("❌ Failed to initialize blockchain service:", error);
      throw error;
    }
  }

  private getRpcUrl(): string {
    const rpcUrls: Record<string, string> = {
      polygon: process.env["POLYGON_RPC_URL"] || "https://polygon-rpc.com",
      "polygon-amoy":
        process.env["POLYGON_AMOY_RPC_URL"] ||
        "https://rpc-amoy.polygon.technology",
    };

    const url = rpcUrls[this.network];
    if (!url) {
      return rpcUrls["polygon-amoy"] || "https://rpc-amoy.polygon.technology";
    }
    return url;
  }

  private async loadContractABIs(): Promise<void> {
    try {
      const artifactsPath = path.join(__dirname, "../../artifacts/contracts");

      // Load contract ABIs
      const contractNames = [
        "TrataTechProductPassportUpgradeableSecure",
        "TrataTechProvenanceUpgradeableSecure",
        "TrataTechOwnershipRegistryUpgradeableSecure",
        "TrataTechMainUpgradeableSecure",
      ];

      for (const contractName of contractNames) {
        const artifactPath = path.join(
          artifactsPath,
          `${contractName}.sol/${contractName}.json`
        );
        if (fs.existsSync(artifactPath)) {
          const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
          this.contracts[contractName] = {
            abi: artifact.abi,
            bytecode: artifact.bytecode,
          };
        }
      }
    } catch (error) {
      console.error("Error loading contract ABIs:", error);
      throw error;
    }
  }

  private async initializeContracts(): Promise<void> {
    try {
      // Get deployed contract addresses from environment or deployment
      const contractAddresses: ContractAddressesType = {
        productPassport: process.env["PRODUCT_PASSPORT_ADDRESS"] || "",
        provenance: process.env["PROVENANCE_ADDRESS"] || "",
        ownershipRegistry: process.env["OWNERSHIP_REGISTRY_ADDRESS"] || "",
        main: process.env["MAIN_CONTRACT_ADDRESS"] || "",
      };

      // Initialize contract instances
      if (
        contractAddresses.productPassport &&
        this.contracts["TrataTechProductPassportUpgradeableSecure"]
      ) {
        this.productPassportContract = new ethers.Contract(
          contractAddresses.productPassport,
          this.contracts["TrataTechProductPassportUpgradeableSecure"].abi,
          this.signer || this.provider
        );
      }

      if (
        contractAddresses.provenance &&
        this.contracts["TrataTechProvenanceUpgradeableSecure"]
      ) {
        this.provenanceContract = new ethers.Contract(
          contractAddresses.provenance,
          this.contracts["TrataTechProvenanceUpgradeableSecure"].abi,
          this.signer || this.provider
        );
      }

      if (
        contractAddresses.ownershipRegistry &&
        this.contracts["TrataTechOwnershipRegistryUpgradeableSecure"]
      ) {
        this.ownershipRegistryContract = new ethers.Contract(
          contractAddresses.ownershipRegistry,
          this.contracts["TrataTechOwnershipRegistryUpgradeableSecure"].abi,
          this.signer || this.provider
        );
      }

      if (
        contractAddresses.main &&
        this.contracts["TrataTechMainUpgradeableSecure"]
      ) {
        this.mainContract = new ethers.Contract(
          contractAddresses.main,
          this.contracts["TrataTechMainUpgradeableSecure"].abi,
          this.signer || this.provider
        );
      }
    } catch (error) {
      console.error("Error initializing contracts:", error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.isInitialized && this.provider !== null;
  }

  // Product Passport Methods
  async registerBrand(brandData: BrandRegistration): Promise<any> {
    try {
      if (!this.productPassportContract) {
        throw new Error("Product passport contract not initialized");
      }

      // Handle IPFS data - use provided CID or upload metadata
      let finalIpfsCID = brandData.ipfsData.cid;
      if (!finalIpfsCID) {
        // Merge provided metadata with default attributes
        const metadata = {
          ...brandData.ipfsData.metadata,
          external_url: brandData.website,
          attributes: [
            ...(brandData.ipfsData.metadata.attributes || []),
            {
              trait_type: "Type",
              value: "Brand Registration",
            },
            {
              trait_type: "Authorized Countries",
              value: brandData.authorizedCountries.join(", "),
            },
            {
              trait_type: "Registration Date",
              value: new Date().toISOString(),
            },
          ],
        };
        const result = await ipfsService.uploadMetadata(metadata);
        finalIpfsCID = result.hash;
      }

      // For upgradeable contracts, no fee is required
      const tx = await this.productPassportContract["registerBrand"](
        brandData.name.toLowerCase().replace(/\s+/g, "-"), // brandId
        brandData.name, // brandName
        brandData.description, // brandDescription
        finalIpfsCID, // ipfsCID
        brandData.authorizedCountries // authorizedCountries
      );

      const receipt = await tx.wait();

      // Save transaction to database
      await databaseService.saveTransaction({
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString(),
        gasPrice: receipt.gasPrice?.toString() || "0",
        from: receipt.from,
        to: receipt.to || "",
        value: "0",
        contractAddress: this.productPassportContract.target as string,
        functionName: "registerBrand",
        parameters: brandData,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        status: "confirmed",
        timestamp: new Date(),
      });

      // Save brand record to database
      await databaseService.saveBrand({
        brandId: brandData.name.toLowerCase().replace(/\s+/g, "-"),
        name: brandData.name,
        description: brandData.description,
        website: brandData.website,
        authorizedCountries: brandData.authorizedCountries,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        transactionHash: receipt.hash,
        ownerAddress: brandData.walletAddress || "",
        isActive: true,
      });

      return { ...receipt, ipfsCID: finalIpfsCID };
    } catch (error) {
      throw new Error(
        `Failed to register brand: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async createProductPassport(passportData: ProductPassport): Promise<any> {
    try {
      if (!this.productPassportContract) {
        throw new Error("Product passport contract not initialized");
      }

      // Handle IPFS data - use provided CID or upload metadata
      let finalIpfsCID = passportData.ipfsData.cid;
      if (!finalIpfsCID) {
        // Merge provided metadata with default attributes
        const metadata = {
          ...passportData.ipfsData.metadata,
          attributes: [
            ...(passportData.ipfsData.metadata.attributes || []),
            {
              trait_type: "Type",
              value: "Product Passport",
            },
            {
              trait_type: "Serial Number",
              value: passportData.serialNumber,
            },
            {
              trait_type: "Brand ID",
              value: passportData.brandId,
            },
            {
              trait_type: "Manufacturing Date",
              value: new Date(
                passportData.manufacturingDate * 1000
              ).toISOString(),
            },
            {
              trait_type: "Creation Date",
              value: new Date().toISOString(),
            },
          ],
        };
        if (passportData.expiryDate) {
          metadata.attributes.push({
            trait_type: "Expiry Date",
            value: new Date(passportData.expiryDate * 1000).toISOString(),
          });
        }
        const result = await ipfsService.uploadMetadata(metadata);
        finalIpfsCID = result.hash;
      }

      // For upgradeable contracts, no fee is required and different parameter order
      const tx = await this.productPassportContract["createProductPassport"](
        passportData.serialNumber,
        passportData.brandId, // brandId is already a string
        passportData.productName,
        passportData.productDescription,
        passportData.materials || "Not specified", // materials - provide default if not specified
        passportData.manufacturingLocation || "Not specified", // manufacturingLocation - provide default if not specified
        passportData.manufacturingDate,
        finalIpfsCID,
        ethers.keccak256(ethers.toUtf8Bytes(finalIpfsCID)), // metadataHash
        passportData.additionalAttributes || [] // additionalAttributes
      );

      const receipt = await tx.wait();

      // Parse the ProductPassportCreated event to get the actual passportId
      let actualPassportId = 0;
      if (receipt.logs) {
        for (const log of receipt.logs) {
          try {
            const parsedLog =
              this.productPassportContract.interface.parseLog(log);
            if (parsedLog && parsedLog.name === "ProductPassportCreated") {
              actualPassportId = Number(parsedLog.args.passportId);
              break;
            }
          } catch (error) {
            // Continue to next log if parsing fails
            continue;
          }
        }
      }

      // Save transaction to database
      await databaseService.saveTransaction({
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice?.toString() || "0",
        from: receipt.from,
        to: receipt.to || "",
        value: "0",
        contractAddress: this.productPassportContract.target as string,
        functionName: "createProductPassport",
        parameters: passportData,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        status: "confirmed",
        timestamp: new Date(),
      });

      // Save product passport record to database
      await databaseService.saveProductPassport({
        passportId: actualPassportId, // Use the actual ID from the contract event
        serialNumber: passportData.serialNumber,
        brandId: passportData.brandId,
        productName: passportData.productName,
        productDescription: passportData.productDescription,
        manufacturingDate: passportData.manufacturingDate,
        expiryDate: passportData.expiryDate,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        transactionHash: receipt.hash,
        ownerAddress: receipt.from,
        isValid: true,
      });

      return {
        ...receipt,
        ipfsCID: finalIpfsCID,
        passportId: actualPassportId,
      };
    } catch (error) {
      throw new Error(
        `Failed to create product passport: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getProductPassport(passportId: number): Promise<any> {
    try {
      if (!this.productPassportContract) {
        throw new Error("Product passport contract not initialized");
      }

      const passportData = await this.productPassportContract[
        "getProductPassportDetails"
      ](passportId);

      // Fetch IPFS data if CID exists
      let ipfsData = null;
      if (passportData.ipfsCID && passportData.ipfsCID !== "") {
        try {
          ipfsData = await ipfsService.retrieveData(passportData.ipfsCID);
        } catch (ipfsError) {
          console.warn(
            `Failed to fetch IPFS data for CID ${passportData.ipfsCID}:`,
            ipfsError
          );
          // Continue without IPFS data rather than failing the entire request
        }
      }

      // Convert BigInt values to strings to avoid serialization issues
      return {
        id: passportData.id.toString(),
        serialNumber: passportData.serialNumber,
        brandId: passportData.brandId,
        productName: passportData.productName,
        productDescription: passportData.productDescription,
        materials: passportData.materials,
        manufacturingLocation: passportData.manufacturingLocation,
        manufacturingDate: passportData.manufacturingDate.toString(),
        ipfsCID: passportData.ipfsCID,
        ipfsData: ipfsData, // Include the actual IPFS metadata
        ipfsUrl: ipfsService.getGatewayURL(passportData.ipfsCID),
        metadataHash: passportData.metadataHash,
        additionalAttributes: passportData.additionalAttributes,
        isValid: passportData.isValid,
        createdAt: passportData.createdAt.toString(),
        updatedAt: passportData.updatedAt.toString(),
      };
    } catch (error) {
      throw new Error(
        `Failed to get product passport: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async updateProductPassport(
    passportId: number,
    ipfsData: IPFSObject
  ): Promise<any> {
    try {
      if (!this.productPassportContract) {
        throw new Error("Product passport contract not initialized");
      }

      // Handle IPFS data - use provided CID or upload metadata
      let finalIpfsCID = ipfsData.cid;
      if (!finalIpfsCID) {
        const result = await ipfsService.uploadMetadata(ipfsData.metadata);
        finalIpfsCID = result.hash;
      }

      const tx = await this.productPassportContract["updateProductPassport"](
        passportId,
        finalIpfsCID,
        ethers.keccak256(ethers.toUtf8Bytes(finalIpfsCID)), // metadataHash
        ipfsData.metadata?.["additionalAttributes"] || [] // additionalAttributes
      );
      const receipt = await tx.wait();
      return { ...receipt, ipfsCID: finalIpfsCID };
    } catch (error) {
      throw new Error(
        `Failed to update product passport: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async createManufacturingCertificate(certificateData: any): Promise<any> {
    try {
      if (!this.productPassportContract) {
        throw new Error("Product passport contract not initialized");
      }

      // Handle IPFS data - use provided CID or upload metadata
      let finalIpfsCID = certificateData.ipfsData.cid;
      if (!finalIpfsCID) {
        // Merge provided metadata with default attributes
        const metadata = {
          ...certificateData.ipfsData.metadata,
          attributes: [
            ...(certificateData.ipfsData.metadata.attributes || []),
            {
              trait_type: "Type",
              value: "Manufacturing Certificate",
            },
            {
              trait_type: "Passport ID",
              value: certificateData.passportId,
            },
            {
              trait_type: "Issue Date",
              value: new Date(certificateData.issueDate * 1000).toISOString(),
            },
            {
              trait_type: "Expiry Date",
              value: new Date(certificateData.expiryDate * 1000).toISOString(),
            },
            {
              trait_type: "Creation Date",
              value: new Date().toISOString(),
            },
          ],
        };
        const result = await ipfsService.uploadMetadata(metadata);
        finalIpfsCID = result.hash;
      }

      // Generate a certificate number if not provided
      const certificateNumber = `CERT-${Date.now()}-${
        certificateData.passportId
      }`;

      const tx = await this.productPassportContract[
        "createManufacturingCertificate"
      ](
        certificateData.passportId,
        certificateData.certificateType,
        certificateNumber,
        "TrataTech Certification Authority", // issuingAuthority
        certificateData.issueDate,
        certificateData.expiryDate,
        finalIpfsCID
      );

      const receipt = await tx.wait();

      // Parse the ManufacturingCertificateCreated event to get the actual certificateId
      let actualCertificateId = 0;
      if (receipt.logs) {
        for (const log of receipt.logs) {
          try {
            const parsedLog =
              this.productPassportContract.interface.parseLog(log);
            if (
              parsedLog &&
              parsedLog.name === "ManufacturingCertificateCreated"
            ) {
              actualCertificateId = Number(parsedLog.args.certificateId);
              break;
            }
          } catch (error) {
            // Continue to next log if parsing fails
            continue;
          }
        }
      }

      // Save transaction to database
      await databaseService.saveTransaction({
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice?.toString() || "0",
        from: receipt.from,
        to: receipt.to || "",
        value: "0",
        contractAddress: this.productPassportContract.target as string,
        functionName: "createManufacturingCertificate",
        parameters: certificateData,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        status: "confirmed",
        timestamp: new Date(),
      });

      // Save certificate record to database
      await databaseService.saveManufacturingCertificate({
        certificateId: actualCertificateId,
        passportId: certificateData.passportId,
        certificateType: certificateData.certificateType,
        certificateNumber: certificateNumber,
        issuingAuthority: "TrataTech Certification Authority",
        issueDate: certificateData.issueDate,
        expiryDate: certificateData.expiryDate,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        transactionHash: receipt.hash,
        issuerAddress: receipt.from,
        isValid: true,
      });

      return {
        ...receipt,
        ipfsCID: finalIpfsCID,
        certificateId: actualCertificateId,
      };
    } catch (error) {
      throw new Error(
        `Failed to create manufacturing certificate: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Provenance Methods
  async createProvenanceEntry(entryData: ProvenanceEntry): Promise<any> {
    try {
      if (!this.provenanceContract) {
        throw new Error("Provenance contract not initialized");
      }

      // Handle IPFS data - use provided CID or upload metadata
      let finalIpfsCID = entryData.ipfsData.cid;
      if (!finalIpfsCID) {
        // Merge provided metadata with default attributes
        const metadata = {
          ...entryData.ipfsData.metadata,
          attributes: [
            ...(entryData.ipfsData.metadata.attributes || []),
            {
              trait_type: "Type",
              value: "Provenance Entry",
            },
            {
              trait_type: "Entry Type",
              value: entryData.entryType,
            },
            {
              trait_type: "Location",
              value: entryData.location,
            },
            {
              trait_type: "Passport ID",
              value: entryData.passportId,
            },
            {
              trait_type: "Timestamp",
              value: new Date().toISOString(),
            },
          ],
        };
        const result = await ipfsService.uploadMetadata(metadata);
        finalIpfsCID = result.hash;
      }

      // Map entry type to contract enum
      let entryType: number;
      switch (entryData.entryType) {
        case "MANUFACTURING":
          entryType = 0;
          break;
        case "TRANSFER":
          entryType = 1;
          break;
        case "SERVICE":
          entryType = 2;
          break;
        case "REPAIR":
          entryType = 3;
          break;
        case "MAINTENANCE":
          entryType = 4;
          break;
        case "INSPECTION":
          entryType = 5;
          break;
        case "CERTIFICATION":
          entryType = 6;
          break;
        case "RECALL":
          entryType = 7;
          break;
        case "DISPOSAL":
          entryType = 8;
          break;
        case "CUSTOM":
          entryType = 9;
          break;
        default:
          entryType = 9; // CUSTOM
      }

      const tx = await this.provenanceContract["createProvenanceEntry"](
        entryData.passportId,
        entryType,
        ethers.ZeroAddress, // from
        ethers.ZeroAddress, // to
        entryData.location,
        entryData.description,
        finalIpfsCID,
        ethers.keccak256(ethers.toUtf8Bytes(finalIpfsCID)), // metadataHash
        [] // additionalData
      );

      const receipt = await tx.wait();

      // Save transaction to database
      await databaseService.saveTransaction({
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice?.toString() || "0",
        from: receipt.from,
        to: receipt.to || "",
        value: "0",
        contractAddress: this.provenanceContract.target as string,
        functionName: "createProvenanceEntry",
        parameters: entryData,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        status: "confirmed",
        timestamp: new Date(),
      });

      // Save provenance record to database
      await databaseService.saveProvenanceEntry({
        entryId: 0, // Will be updated with actual ID from contract
        passportId: entryData.passportId,
        entryType: entryData.entryType,
        location: entryData.location,
        description: entryData.description,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        transactionHash: receipt.hash,
        recorderAddress: receipt.from,
        timestamp: Math.floor(Date.now() / 1000),
      });

      return { ...receipt, ipfsCID: finalIpfsCID };
    } catch (error) {
      throw new Error(
        `Failed to create provenance entry: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async createServiceRecord(serviceData: ServiceRecord): Promise<any> {
    try {
      if (!this.provenanceContract) {
        throw new Error("Provenance contract not initialized");
      }

      // Handle IPFS data - use provided CID or upload metadata
      let finalIpfsCID = serviceData.ipfsData.cid;
      if (!finalIpfsCID) {
        const result = await ipfsService.uploadMetadata(
          serviceData.ipfsData.metadata
        );
        finalIpfsCID = result.hash;
      }

      const tx = await this.provenanceContract["createServiceRecord"](
        serviceData.passportId,
        serviceData.serviceType,
        "Service Provider", // serviceProvider
        serviceData.serviceDescription,
        serviceData.serviceDate,
        serviceData.nextServiceDate,
        finalIpfsCID,
        "CERT-001" // certificateNumber
      );
      const receipt = await tx.wait();
      return { ...receipt, ipfsCID: finalIpfsCID };
    } catch (error) {
      throw new Error(
        `Failed to create service record: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getProvenanceHistory(passportId: number): Promise<any> {
    try {
      if (!this.provenanceContract) {
        throw new Error("Provenance contract not initialized");
      }

      const history = await this.provenanceContract["getProvenanceHistory"](
        passportId
      );

      // Convert BigInt values to strings to avoid serialization issues
      return history.map((entry: any) => ({
        id: entry.id.toString(),
        passportId: entry.passportId.toString(),
        eventType: entry.eventType,
        description: entry.description,
        timestamp: entry.timestamp.toString(),
        ipfsCID: entry.ipfsCID,
        metadataHash: entry.metadataHash,
        isValid: entry.isValid,
        createdAt: entry.createdAt.toString(),
        updatedAt: entry.updatedAt.toString(),
      }));
    } catch (error) {
      throw new Error(
        `Failed to get provenance history: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Ownership Registry Methods
  async createOwnershipDeed(deedData: OwnershipDeed): Promise<any> {
    try {
      if (!this.ownershipRegistryContract) {
        throw new Error("Ownership registry contract not initialized");
      }

      // Handle IPFS data - use provided CID or upload metadata
      let finalIpfsCID = deedData.ipfsData.cid;
      if (!finalIpfsCID) {
        // Merge provided metadata with default attributes
        const metadata = {
          ...deedData.ipfsData.metadata,
          attributes: [
            ...(deedData.ipfsData.metadata.attributes || []),
            {
              trait_type: "Type",
              value: "Ownership Deed",
            },
            {
              trait_type: "Passport ID",
              value: deedData.passportId,
            },
            {
              trait_type: "Owner Address",
              value: deedData.ownerAddress,
            },
            {
              trait_type: "Purchase Price",
              value: deedData.purchasePrice,
            },
            {
              trait_type: "Acquisition Method",
              value: "Purchase",
            },
            {
              trait_type: "Creation Date",
              value: new Date().toISOString(),
            },
          ],
        };
        const result = await ipfsService.uploadMetadata(metadata);
        finalIpfsCID = result.hash;
      }

      const tx = await this.ownershipRegistryContract["createOwnershipDeed"](
        deedData.passportId,
        deedData.ownerAddress,
        deedData.purchasePrice,
        "Purchase", // acquisitionMethod
        finalIpfsCID,
        ethers.keccak256(ethers.toUtf8Bytes(finalIpfsCID)), // metadataHash
        [] // additionalData (empty array)
      );

      const receipt = await tx.wait();

      // Parse the OwnershipDeedCreated event to get the actual deedId
      let actualDeedId = 0;
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          try {
            const parsedLog = this.ownershipRegistryContract.interface.parseLog(
              {
                topics: log.topics,
                data: log.data,
              }
            );
            if (parsedLog && parsedLog.name === "OwnershipDeedCreated") {
              actualDeedId = Number(parsedLog.args.deedId);
              break;
            }
          } catch (error) {
            // Continue to next log if parsing fails
            continue;
          }
        }
      }

      if (actualDeedId === 0) {
        throw new Error("Failed to extract deedId from transaction receipt");
      }

      // Save transaction to database
      await databaseService.saveTransaction({
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice?.toString() || "0",
        from: receipt.from,
        to: receipt.to || "",
        value: "0",
        contractAddress: this.ownershipRegistryContract.target as string,
        functionName: "createOwnershipDeed",
        parameters: deedData,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        status: "confirmed",
        timestamp: new Date(),
      });

      // Save ownership deed record to database
      await databaseService.saveOwnershipDeed({
        deedId: actualDeedId,
        passportId: deedData.passportId,
        ownerAddress: deedData.ownerAddress,
        acquisitionDate: Math.floor(Date.now() / 1000),
        acquisitionPrice: deedData.purchasePrice,
        acquisitionMethod: "Purchase",
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        transactionHash: receipt.hash,
        isValid: true,
        isLocked: false,
      });

      return { ...receipt, ipfsCID: finalIpfsCID, deedId: actualDeedId };
    } catch (error) {
      throw new Error(
        `Failed to create ownership deed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async transferOwnershipDeed(
    deedId: number,
    newOwner: string,
    transferPrice: string = "0",
    transferType: number = 0,
    ipfsCID: string = "QmTransferCID"
  ): Promise<any> {
    try {
      if (!this.ownershipRegistryContract) {
        throw new Error("Ownership registry contract not initialized");
      }

      // Check if deed exists before attempting transfer
      const deedExists = await this.deedExists(deedId);
      if (!deedExists) {
        throw new Error(
          `Ownership deed ${deedId} does not exist. Please create the deed first using the /api/v1/ownership/deeds endpoint.`
        );
      }

      const tx = await this.ownershipRegistryContract["transferOwnershipDeed"](
        deedId,
        newOwner,
        transferPrice,
        transferType,
        ipfsCID
      );
      return await tx.wait();
    } catch (error) {
      throw new Error(
        `Failed to transfer ownership deed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getOwnershipDeed(deedId: number): Promise<any> {
    try {
      if (!this.ownershipRegistryContract) {
        throw new Error("Ownership registry contract not initialized");
      }

      const deedData = await this.ownershipRegistryContract[
        "getOwnershipDeedDetails"
      ](deedId);

      // Check if deedData exists
      if (!deedData) {
        throw new Error("No deed data returned from contract");
      }

      // Convert the Result object to a proper response
      // Handle BigInt conversion safely
      const processedData = {
        id: String(deedData[0] || ""),
        owner: String(deedData[1] || ""),
        acquisitionDate: String(deedData[2] || ""),
        amount: String(deedData[3] || ""),
        type: String(deedData[4] || ""),
        ipfsHash: String(deedData[5] || ""),
        transactionHash: String(deedData[6] || ""),
        isActive: Boolean(deedData[7]),
        hasTransfers: Boolean(deedData[8]),
        transferCount: String(deedData[9] || "0"),
        lastTransferTo: String(deedData[10] || ""),
        transferHistory: [], // Always return empty array - no iteration needed
      };

      console.log("Processed deed data:", processedData);
      return processedData;
    } catch (error) {
      console.error("Error in getOwnershipDeed:", error);
      throw error; // Re-throw the original error
    }
  }
  async deedExists(deedId: number): Promise<boolean> {
    try {
      const deedData = await this.getOwnershipDeed(deedId);
      return (
        deedData &&
        deedData.owner !== "0x0000000000000000000000000000000000000000"
      );
    } catch (error) {
      return false;
    }
  }

  async getDeedOwner(deedId: number): Promise<string> {
    try {
      if (!this.ownershipRegistryContract) {
        throw new Error("Ownership registry contract not initialized");
      }

      // Try using the public mapping directly first
      try {
        const owner = await this.ownershipRegistryContract["ownershipDeeds"](
          deedId,
          2
        ); // owner is at index 2 in the struct
        console.log("Owner from public mapping:", owner);
        return owner.toString();
      } catch (mappingError) {
        console.log("Public mapping failed, trying getOwnershipDeedDetails");

        // Fallback to the function
        const deedData = await this.ownershipRegistryContract[
          "getOwnershipDeedDetails"
        ](deedId);

        // Debug logging to see what we're getting
        console.log("Deed data array:", deedData);
        console.log("Deed data length:", deedData.length);
        console.log("Index 0 (passportId):", deedData[0]);
        console.log("Index 1 (owner):", deedData[1]);
        console.log("Index 2 (acquisitionDate):", deedData[2]);

        return deedData[1].toString(); // owner is the 2nd element in the returned array
      }
    } catch (error) {
      throw new Error(
        `Failed to get deed owner: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async createTransferRequest(requestData: TransferRequest): Promise<any> {
    try {
      if (!this.ownershipRegistryContract) {
        throw new Error("Ownership registry contract not initialized");
      }

      const tx = await this.ownershipRegistryContract["createTransferRequest"](
        requestData.deedId,
        requestData.requesterAddress,
        requestData.proposedPrice,
        requestData.reason
      );

      const receipt = await tx.wait();

      // Parse the TransferRequestCreated event to get the actual requestId
      let actualRequestId = 0;
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          try {
            const parsedLog = this.ownershipRegistryContract.interface.parseLog(
              {
                topics: log.topics,
                data: log.data,
              }
            );
            if (parsedLog && parsedLog.name === "TransferRequestCreated") {
              actualRequestId = Number(parsedLog.args.requestId);
              break;
            }
          } catch (error) {
            // Continue to next log if parsing fails
            continue;
          }
        }
      }

      return { ...receipt, requestId: actualRequestId };
    } catch (error) {
      throw new Error(
        `Failed to create transfer request: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Business Operations Methods
  async createEventInvite(
    eventData: EventInvite,
    ipfsCID?: string
  ): Promise<any> {
    try {
      if (!this.mainContract) {
        throw new Error("Main contract not initialized");
      }

      // Upload metadata to IPFS if not provided
      let finalIpfsCID = ipfsCID;
      if (!finalIpfsCID) {
        const metadata = {
          name: eventData.eventName,
          description: eventData.eventDescription,
          attributes: [
            {
              trait_type: "Type",
              value: "Event Invite",
            },
            {
              trait_type: "Event Date",
              value: new Date(eventData.eventDate * 1000).toISOString(),
            },
            {
              trait_type: "Max Attendees",
              value: eventData.maxAttendees,
            },
            {
              trait_type: "Creation Date",
              value: new Date().toISOString(),
            },
          ],
        };
        const result = await ipfsService.uploadMetadata(metadata);
        finalIpfsCID = result.hash;
      }

      const tx = await this.mainContract["createEventInvite"](
        eventData.eventName,
        eventData.eventDescription,
        eventData.eventDate,
        eventData.maxAttendees,
        finalIpfsCID
      );

      const receipt = await tx.wait();

      // Save transaction to database
      await databaseService.saveTransaction({
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice?.toString() || "0",
        from: receipt.from,
        to: receipt.to || "",
        value: "0",
        contractAddress: this.mainContract.target as string,
        functionName: "createEventInvite",
        parameters: eventData,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        status: "confirmed",
        timestamp: new Date(),
      });

      // Save event invite record to database
      await databaseService.saveEventInvite({
        eventId: 0, // Will be updated with actual ID from contract
        eventName: eventData.eventName,
        eventDescription: eventData.eventDescription,
        eventDate: eventData.eventDate,
        maxAttendees: eventData.maxAttendees,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        transactionHash: receipt.hash,
        creatorAddress: receipt.from,
      });

      return receipt;
    } catch (error) {
      throw new Error(
        `Failed to create event invite: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async submitRSVP(eventId: number): Promise<any> {
    try {
      if (!this.mainContract) {
        throw new Error("Main contract not initialized");
      }

      const tx = await this.mainContract["submitRSVP"](eventId);
      return await tx.wait();
    } catch (error) {
      throw new Error(
        `Failed to submit RSVP: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async createProductLaunch(
    launchData: ProductLaunch,
    ipfsCID?: string
  ): Promise<any> {
    try {
      if (!this.mainContract) {
        throw new Error("Main contract not initialized");
      }

      // Calculate early access end date (must be before launch date)
      const earlyAccessEndDate =
        launchData.launchDate - launchData.earlyAccessPeriod;

      // Upload metadata to IPFS if not provided
      let finalIpfsCID = ipfsCID;
      if (!finalIpfsCID) {
        const metadata = {
          name: launchData.productName,
          description: launchData.productDescription,
          attributes: [
            {
              trait_type: "Type",
              value: "Product Launch",
            },
            {
              trait_type: "Launch Date",
              value: new Date(launchData.launchDate * 1000).toISOString(),
            },
            {
              trait_type: "Early Access End Date",
              value: new Date(earlyAccessEndDate * 1000).toISOString(),
            },
            {
              trait_type: "Max Early Access Users",
              value: launchData.maxEarlyAccessUsers,
            },
            {
              trait_type: "Creation Date",
              value: new Date().toISOString(),
            },
          ],
        };
        const result = await ipfsService.uploadMetadata(metadata);
        finalIpfsCID = result.hash;
      }

      const tx = await this.mainContract["createProductLaunch"](
        launchData.productName,
        launchData.productDescription,
        launchData.launchDate,
        earlyAccessEndDate,
        launchData.maxEarlyAccessUsers,
        finalIpfsCID
      );

      const receipt = await tx.wait();

      // Save transaction to database
      await databaseService.saveTransaction({
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice?.toString() || "0",
        from: receipt.from,
        to: receipt.to || "",
        value: "0",
        contractAddress: this.mainContract.target as string,
        functionName: "createProductLaunch",
        parameters: launchData,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        status: "confirmed",
        timestamp: new Date(),
      });

      // Save product launch record to database
      await databaseService.saveProductLaunch({
        launchId: 0, // Will be updated with actual ID from contract
        productName: launchData.productName,
        productDescription: launchData.productDescription,
        launchDate: launchData.launchDate,
        earlyAccessEndDate,
        maxEarlyAccessUsers: launchData.maxEarlyAccessUsers,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        transactionHash: receipt.hash,
        creatorAddress: receipt.from,
      });

      return receipt;
    } catch (error) {
      throw new Error(
        `Failed to create product launch: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async grantEarlyAccess(launchId: number, userAddress: string): Promise<any> {
    try {
      if (!this.mainContract) {
        throw new Error("Main contract not initialized");
      }

      const tx = await this.mainContract["grantEarlyAccess"](
        launchId,
        userAddress
      );
      return await tx.wait();
    } catch (error) {
      throw new Error(
        `Failed to grant early access: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async createArtDrop(artData: ArtDrop, ipfsCID?: string): Promise<any> {
    try {
      if (!this.mainContract) {
        throw new Error("Main contract not initialized");
      }

      // Upload metadata to IPFS if not provided
      let finalIpfsCID = ipfsCID;
      if (!finalIpfsCID) {
        const metadata = {
          name: artData.artworkTitle,
          description: `Digital artwork by ${artData.artistName}`,
          attributes: [
            {
              trait_type: "Type",
              value: "Art Drop",
            },
            {
              trait_type: "Artist",
              value: artData.artistName,
            },
            {
              trait_type: "Edition Size",
              value: artData.editionSize,
            },
            {
              trait_type: "Creation Date",
              value: new Date().toISOString(),
            },
          ],
        };
        const result = await ipfsService.uploadMetadata(metadata);
        finalIpfsCID = result.hash;
      }

      const tx = await this.mainContract["createArtDrop"](
        artData.artistName,
        artData.artworkTitle,
        1, // edition (starting from 1)
        artData.editionSize, // maxEditions
        finalIpfsCID
      );

      const receipt = await tx.wait();

      // Save transaction to database
      await databaseService.saveTransaction({
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice?.toString() || "0",
        from: receipt.from,
        to: receipt.to || "",
        value: "0",
        contractAddress: this.mainContract.target as string,
        functionName: "createArtDrop",
        parameters: artData,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        status: "confirmed",
        timestamp: new Date(),
      });

      // Save art drop record to database
      await databaseService.saveArtDrop({
        artDropId: 0, // Will be updated with actual ID from contract
        artistName: artData.artistName,
        artworkTitle: artData.artworkTitle,
        editionSize: artData.editionSize,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        transactionHash: receipt.hash,
        creatorAddress: receipt.from,
      });

      return receipt;
    } catch (error) {
      throw new Error(
        `Failed to create art drop: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async airdropArtwork(artDropId: number, recipients: string[]): Promise<any> {
    try {
      if (!this.mainContract) {
        throw new Error("Main contract not initialized");
      }

      const tx = await this.mainContract["airdropArtwork"](
        artDropId,
        recipients
      );
      return await tx.wait();
    } catch (error) {
      throw new Error(
        `Failed to airdrop artwork: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async createOffer(offerData: Offer, ipfsCID?: string): Promise<any> {
    try {
      if (!this.mainContract) {
        throw new Error("Main contract not initialized");
      }

      // Upload metadata to IPFS if not provided
      let finalIpfsCID = ipfsCID;
      if (!finalIpfsCID) {
        const metadata = {
          name: offerData.offerName,
          description: offerData.offerDescription || "Special offer",
          attributes: [
            {
              trait_type: "Type",
              value: "Offer",
            },
            {
              trait_type: "Discount Percentage",
              value: offerData.discountPercentage,
            },
            {
              trait_type: "Valid From",
              value: new Date(offerData.validFrom * 1000).toISOString(),
            },
            {
              trait_type: "Valid Until",
              value: new Date(offerData.validUntil * 1000).toISOString(),
            },
            {
              trait_type: "Max Redemptions",
              value: offerData.maxRedemptions,
            },
            {
              trait_type: "Creation Date",
              value: new Date().toISOString(),
            },
          ],
        };
        const result = await ipfsService.uploadMetadata(metadata);
        finalIpfsCID = result.hash;
      }

      const tx = await this.mainContract["createOffer"](
        offerData.offerName, // title
        offerData.discountPercentage * 100, // Convert to basis points
        offerData.validFrom,
        offerData.validUntil,
        "All Products", // productScope (default)
        offerData.offerDescription || "No conditions", // conditions
        finalIpfsCID,
        false, // isMerkleBased (default to false)
        ethers.ZeroHash, // merkleRoot (empty)
        offerData.maxRedemptions
      );

      const receipt = await tx.wait();

      // Save transaction to database
      await databaseService.saveTransaction({
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice?.toString() || "0",
        from: receipt.from,
        to: receipt.to || "",
        value: "0",
        contractAddress: this.mainContract.target as string,
        functionName: "createOffer",
        parameters: offerData,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        status: "confirmed",
        timestamp: new Date(),
      });

      // Save offer record to database
      await databaseService.saveOffer({
        offerId: 0, // Will be updated with actual ID from contract
        offerName: offerData.offerName,
        discountPercentage: offerData.discountPercentage,
        validFrom: offerData.validFrom,
        validUntil: offerData.validUntil,
        maxRedemptions: offerData.maxRedemptions,
        offerDescription: offerData.offerDescription,
        ipfsHash: finalIpfsCID || "",
        ipfsUrl: ipfsService.getGatewayURL(finalIpfsCID || ""),
        transactionHash: receipt.hash,
        creatorAddress: receipt.from,
      });

      return receipt;
    } catch (error) {
      throw new Error(
        `Failed to create offer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async redeemOffer(offerId: number): Promise<any> {
    try {
      if (!this.mainContract) {
        throw new Error("Main contract not initialized");
      }

      const tx = await this.mainContract["redeemOffer"](offerId);
      return await tx.wait();
    } catch (error) {
      throw new Error(
        `Failed to redeem offer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Admin Methods
  async authorizeBrand(brandAddress: string): Promise<any> {
    try {
      if (!this.productPassportContract) {
        throw new Error("Product passport contract not initialized");
      }

      const tx = await this.productPassportContract["authorizeBrand"](
        brandAddress
      );
      return await tx.wait();
    } catch (error) {
      throw new Error(
        `Failed to authorize brand: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async authorizeCertifier(certifierAddress: string): Promise<any> {
    try {
      if (!this.productPassportContract) {
        throw new Error("Product passport contract not initialized");
      }

      const tx = await this.productPassportContract["authorizeCertifier"](
        certifierAddress
      );
      return await tx.wait();
    } catch (error) {
      throw new Error(
        `Failed to authorize certifier: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async isBrandAuthorized(brandAddress: string): Promise<boolean> {
    try {
      if (!this.productPassportContract) {
        throw new Error("Product passport contract not initialized");
      }

      // Check if the brand is authorized by calling the contract
      const isAuthorized = await this.productPassportContract[
        "authorizedBrands"
      ](brandAddress);
      return isAuthorized;
    } catch (error) {
      // If there's an error checking authorization, assume not authorized
      console.warn(
        `Failed to check brand authorization: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return false;
    }
  }

  async brandExists(brandId: string): Promise<boolean> {
    try {
      if (!this.productPassportContract) {
        throw new Error("Product passport contract not initialized");
      }

      // Try to get brand details - if it throws BrandNotFound, brand doesn't exist
      await this.productPassportContract["getBrandDetails"](brandId);
      return true; // Brand exists
    } catch (error) {
      // Check if it's a BrandNotFound error
      if (error instanceof Error && error.message.includes("BrandNotFound")) {
        return false; // Brand doesn't exist
      }
      // For other errors, re-throw
      throw error;
    }
  }

  async serialNumberExists(serialNumber: string): Promise<boolean> {
    try {
      if (!this.productPassportContract) {
        throw new Error("Product passport contract not initialized");
      }

      // Get passport ID by serial number - if it returns 0, serial number doesn't exist
      const passportId = await this.productPassportContract[
        "getPassportIdBySerialNumber"
      ](serialNumber);
      return passportId > 0; // Serial number exists if passportId > 0
    } catch (error) {
      // For any errors, assume serial number doesn't exist
      return false;
    }
  }

  async authorizeOperator(operatorAddress: string): Promise<any> {
    try {
      if (!this.productPassportContract) {
        throw new Error("Product passport contract not initialized");
      }

      const tx = await this.productPassportContract["authorizeOperator"](
        operatorAddress
      );
      return await tx.wait();
    } catch (error) {
      throw new Error(
        `Failed to authorize operator: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async revokeOperator(operatorAddress: string): Promise<any> {
    try {
      if (!this.productPassportContract) {
        throw new Error("Product passport contract not initialized");
      }

      const tx = await this.productPassportContract["revokeOperator"](
        operatorAddress
      );
      return await tx.wait();
    } catch (error) {
      throw new Error(
        `Failed to revoke operator: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async updateFeeStructure(feeType: string, newFee: string): Promise<any> {
    try {
      let tx: ContractTransactionResponse;

      switch (feeType) {
        case "brandRegistration":
          if (!this.productPassportContract) {
            throw new Error("Product passport contract not initialized");
          }
          tx = await this.productPassportContract["setBrandRegistrationFee"](
            newFee
          );
          break;
        case "passportCreation":
          if (!this.productPassportContract) {
            throw new Error("Product passport contract not initialized");
          }
          tx = await this.productPassportContract["setPassportCreationFee"](
            newFee
          );
          break;
        case "deedCreation":
          if (!this.ownershipRegistryContract) {
            throw new Error("Ownership registry contract not initialized");
          }
          tx = await this.ownershipRegistryContract["setDeedCreationFee"](
            newFee
          );
          break;
        default:
          throw new Error(`Unknown fee type: ${feeType}`);
      }
      return await tx.wait();
    } catch (error) {
      throw new Error(
        `Failed to update fee structure: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async emergencyStop(): Promise<any> {
    try {
      if (!this.productPassportContract) {
        throw new Error("Product passport contract not initialized");
      }

      const tx = await this.productPassportContract["emergencyStop"]();
      return await tx.wait();
    } catch (error) {
      throw new Error(
        `Failed to activate emergency stop: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async resumeOperations(): Promise<any> {
    try {
      if (!this.productPassportContract) {
        throw new Error("Product passport contract not initialized");
      }

      const tx = await this.productPassportContract["resumeOperations"]();
      return await tx.wait();
    } catch (error) {
      throw new Error(
        `Failed to resume operations: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Utility Methods
  async getGasEstimate(contractMethod: any, ...args: any[]): Promise<bigint> {
    try {
      return await contractMethod.estimateGas(...args);
    } catch (error) {
      throw new Error(
        `Failed to estimate gas: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Database and Analytics Methods
  async getTransactionStats(): Promise<any> {
    try {
      return await databaseService.getTransactionStats();
    } catch (error) {
      throw new Error(
        `Failed to get transaction stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getTransaction(transactionHash: string): Promise<any> {
    try {
      return await databaseService.getTransaction(transactionHash);
    } catch (error) {
      throw new Error(
        `Failed to get transaction: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getAllBrands(): Promise<any[]> {
    try {
      return await databaseService.getAllBrands();
    } catch (error) {
      throw new Error(
        `Failed to get brands: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getAllProductPassports(): Promise<any[]> {
    try {
      return await databaseService.getAllProductPassports();
    } catch (error) {
      throw new Error(
        `Failed to get product passports: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getCurrentBlock(): Promise<number> {
    try {
      if (!this.provider) {
        throw new Error("Provider not initialized");
      }
      return await this.provider.getBlockNumber();
    } catch (error) {
      throw new Error(
        `Failed to get current block: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getBalance(address: string): Promise<bigint> {
    try {
      if (!this.provider) {
        throw new Error("Provider not initialized");
      }
      return await this.provider.getBalance(address);
    } catch (error) {
      throw new Error(
        `Failed to get balance: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Batch Operations
  async createBatchProvenanceEntries(entries: ProvenanceEntry[]): Promise<any> {
    try {
      if (!this.provenanceContract) {
        throw new Error("Provenance contract not initialized");
      }

      const tx = await this.provenanceContract["createBatchProvenanceEntries"](
        entries
      );
      return await tx.wait();
    } catch (error) {
      throw new Error(
        `Failed to create batch provenance entries: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async batchAirdropArtwork(
    artDropId: number,
    recipients: string[]
  ): Promise<any> {
    try {
      if (!this.mainContract) {
        throw new Error("Main contract not initialized");
      }

      const tx = await this.mainContract["batchAirdropArtwork"](
        artDropId,
        recipients
      );
      return await tx.wait();
    } catch (error) {
      throw new Error(
        `Failed to batch airdrop artwork: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}

export default new BlockchainService();
