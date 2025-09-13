// import mongoose from "mongoose"; // Not used in this implementation
import { MongoClient, Db } from "mongodb";

interface TransactionRecord {
  _id?: string;
  transactionHash: string;
  blockNumber?: number;
  gasUsed?: string;
  gasPrice?: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  functionName: string;
  parameters: any;
  ipfsHash?: string;
  ipfsUrl?: string;
  status: "pending" | "confirmed" | "failed";
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface BrandRecord {
  _id?: string;
  brandId: string;
  name: string;
  description: string;
  website: string;
  authorizedCountries: string[];
  ipfsHash: string;
  ipfsUrl: string;
  transactionHash: string;
  ownerAddress: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductPassportRecord {
  _id?: string;
  passportId: number;
  serialNumber: string;
  brandId: string;
  productName: string;
  productDescription: string;
  manufacturingDate: number;
  expiryDate?: number;
  ipfsHash: string;
  ipfsUrl: string;
  transactionHash: string;
  ownerAddress: string;
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ProvenanceRecord {
  _id?: string;
  entryId: number;
  passportId: number;
  entryType: string;
  location: string;
  description: string;
  ipfsHash: string;
  ipfsUrl: string;
  transactionHash: string;
  recorderAddress: string;
  timestamp: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ManufacturingCertificateRecord {
  _id?: string;
  certificateId: number;
  passportId: number;
  certificateType: string;
  certificateNumber: string;
  issuingAuthority: string;
  issueDate: number;
  expiryDate: number;
  ipfsHash: string;
  ipfsUrl: string;
  transactionHash: string;
  issuerAddress: string;
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface OwnershipDeedRecord {
  _id?: string;
  deedId: number;
  passportId: number;
  ownerAddress: string;
  acquisitionDate: number;
  acquisitionPrice: string;
  acquisitionMethod: string;
  ipfsHash: string;
  ipfsUrl: string;
  transactionHash: string;
  isValid: boolean;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface EventInviteRecord {
  _id?: string;
  eventId: number;
  eventName: string;
  eventDescription: string;
  eventDate: number;
  maxAttendees: number;
  ipfsHash: string;
  ipfsUrl: string;
  transactionHash: string;
  creatorAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductLaunchRecord {
  _id?: string;
  launchId: number;
  productName: string;
  productDescription: string;
  launchDate: number;
  earlyAccessEndDate: number;
  maxEarlyAccessUsers: number;
  ipfsHash: string;
  ipfsUrl: string;
  transactionHash: string;
  creatorAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ArtDropRecord {
  _id?: string;
  artDropId: number;
  artistName: string;
  artworkTitle: string;
  editionSize: number;
  ipfsHash: string;
  ipfsUrl: string;
  transactionHash: string;
  creatorAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

interface OfferRecord {
  _id?: string;
  offerId: number;
  offerName: string;
  discountPercentage: number;
  validFrom: number;
  validUntil: number;
  maxRedemptions: number;
  offerDescription?: string;
  ipfsHash: string;
  ipfsUrl: string;
  transactionHash: string;
  creatorAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

class DatabaseService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isConnected: boolean = false;

  private async ensureConnected(): Promise<void> {
    if (this.isConnected && this.db) return;

    const mongoUri = process.env["MONGODB_URI"];
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is required");
    }

    this.client = new MongoClient(mongoUri);
    await this.client.connect();
    this.db = this.client.db();
    this.isConnected = true;

    // Create indexes for better performance
    await this.createIndexes();

    console.log("✅ MongoDB connected successfully");
  }

  async connect(): Promise<void> {
    await this.ensureConnected();
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      // Transaction records indexes
      await this.db
        .collection("transactions")
        .createIndex({ transactionHash: 1 }, { unique: true });
      await this.db
        .collection("transactions")
        .createIndex({ contractAddress: 1 });
      await this.db.collection("transactions").createIndex({ functionName: 1 });
      await this.db.collection("transactions").createIndex({ timestamp: -1 });

      // Brand records indexes
      await this.db
        .collection("brands")
        .createIndex({ brandId: 1 }, { unique: true });
      await this.db
        .collection("brands")
        .createIndex({ transactionHash: 1 }, { unique: true });
      await this.db.collection("brands").createIndex({ ownerAddress: 1 });

      // Product passport indexes
      await this.db
        .collection("productPassports")
        .createIndex({ passportId: 1 }, { unique: true });
      await this.db
        .collection("productPassports")
        .createIndex({ serialNumber: 1 }, { unique: true });
      await this.db.collection("productPassports").createIndex({ brandId: 1 });
      await this.db
        .collection("productPassports")
        .createIndex({ transactionHash: 1 }, { unique: true });

      // Provenance indexes
      await this.db
        .collection("provenance")
        .createIndex({ entryId: 1 }, { unique: true });
      await this.db.collection("provenance").createIndex({ passportId: 1 });
      await this.db
        .collection("provenance")
        .createIndex({ transactionHash: 1 }, { unique: true });

      // Ownership deed indexes
      await this.db
        .collection("ownershipDeeds")
        .createIndex({ deedId: 1 }, { unique: true });
      await this.db.collection("ownershipDeeds").createIndex({ passportId: 1 });
      await this.db
        .collection("ownershipDeeds")
        .createIndex({ ownerAddress: 1 });
      await this.db
        .collection("ownershipDeeds")
        .createIndex({ transactionHash: 1 }, { unique: true });

      console.log("✅ Database indexes created successfully");
    } catch (error) {
      console.error("❌ Failed to create database indexes:", error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log("✅ MongoDB disconnected");
    }
  }

  isConnectedToDatabase(): boolean {
    return this.isConnected && this.db !== null;
  }

  // Transaction Records
  async saveTransaction(
    transaction: Omit<TransactionRecord, "_id" | "createdAt" | "updatedAt">
  ): Promise<string> {
    await this.ensureConnected();

    const record: TransactionRecord = {
      ...transaction,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.db!.collection("transactions").insertOne(
      record as any
    );
    console.log(`✅ Transaction saved: ${transaction.transactionHash}`);
    return result.insertedId.toString();
  }

  async getTransaction(
    transactionHash: string
  ): Promise<TransactionRecord | null> {
    await this.ensureConnected();
    return (await this.db!.collection("transactions").findOne({
      transactionHash,
    })) as any;
  }

  async updateTransactionStatus(
    transactionHash: string,
    status: "pending" | "confirmed" | "failed",
    blockNumber?: number,
    gasUsed?: string
  ): Promise<void> {
    if (!this.db) throw new Error("Database not connected");

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (blockNumber) updateData.blockNumber = blockNumber;
    if (gasUsed) updateData.gasUsed = gasUsed;

    await this.db
      .collection("transactions")
      .updateOne({ transactionHash }, { $set: updateData });
  }

  // Brand Records
  async saveBrand(
    brand: Omit<BrandRecord, "_id" | "createdAt" | "updatedAt">
  ): Promise<string> {
    if (!this.db) throw new Error("Database not connected");

    const record: BrandRecord = {
      ...brand,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.db.collection("brands").insertOne(record as any);
    console.log(`✅ Brand saved: ${brand.name}`);
    return result.insertedId.toString();
  }

  async getBrand(brandId: string): Promise<BrandRecord | null> {
    if (!this.db) throw new Error("Database not connected");
    return (await this.db.collection("brands").findOne({ brandId })) as any;
  }

  async getAllBrands(): Promise<BrandRecord[]> {
    if (!this.db) throw new Error("Database not connected");
    return (await this.db.collection("brands").find({}).toArray()) as any;
  }

  // Product Passport Records
  async saveProductPassport(
    passport: Omit<ProductPassportRecord, "_id" | "createdAt" | "updatedAt">
  ): Promise<string> {
    if (!this.db) throw new Error("Database not connected");

    const record: ProductPassportRecord = {
      ...passport,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.db
      .collection("productPassports")
      .insertOne(record as any);
    console.log(`✅ Product passport saved: ${passport.serialNumber}`);
    return result.insertedId.toString();
  }

  async getProductPassport(
    passportId: number
  ): Promise<ProductPassportRecord | null> {
    if (!this.db) throw new Error("Database not connected");
    return (await this.db
      .collection("productPassports")
      .findOne({ passportId })) as any;
  }

  async getProductPassportBySerial(
    serialNumber: string
  ): Promise<ProductPassportRecord | null> {
    if (!this.db) throw new Error("Database not connected");
    return (await this.db
      .collection("productPassports")
      .findOne({ serialNumber })) as any;
  }

  async getAllProductPassports(): Promise<ProductPassportRecord[]> {
    if (!this.db) throw new Error("Database not connected");
    return (await this.db
      .collection("productPassports")
      .find({})
      .toArray()) as any;
  }

  // Manufacturing Certificate Records
  async saveManufacturingCertificate(
    certificate: Omit<
      ManufacturingCertificateRecord,
      "_id" | "createdAt" | "updatedAt"
    >
  ): Promise<string> {
    if (!this.db) throw new Error("Database not connected");

    const record: ManufacturingCertificateRecord = {
      ...certificate,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.db
      .collection("manufacturingCertificates")
      .insertOne(record as any);
    console.log(
      `✅ Manufacturing certificate saved: ${certificate.certificateNumber}`
    );
    return result.insertedId.toString();
  }

  async getManufacturingCertificate(
    certificateId: number
  ): Promise<ManufacturingCertificateRecord | null> {
    if (!this.db) throw new Error("Database not connected");
    return (await this.db
      .collection("manufacturingCertificates")
      .findOne({ certificateId })) as any;
  }

  async getCertificatesByPassport(
    passportId: number
  ): Promise<ManufacturingCertificateRecord[]> {
    if (!this.db) throw new Error("Database not connected");
    return (await this.db
      .collection("manufacturingCertificates")
      .find({ passportId })
      .toArray()) as any;
  }

  // Provenance Records
  async saveProvenanceEntry(
    entry: Omit<ProvenanceRecord, "_id" | "createdAt" | "updatedAt">
  ): Promise<string> {
    if (!this.db) throw new Error("Database not connected");

    const record: ProvenanceRecord = {
      ...entry,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.db
      .collection("provenance")
      .insertOne(record as any);
    console.log(`✅ Provenance entry saved: ${entry.entryId}`);
    return result.insertedId.toString();
  }

  async getProvenanceHistory(passportId: number): Promise<ProvenanceRecord[]> {
    if (!this.db) throw new Error("Database not connected");
    return (await this.db
      .collection("provenance")
      .find({ passportId })
      .sort({ timestamp: -1 })
      .toArray()) as any;
  }

  // Ownership Deed Records
  async saveOwnershipDeed(
    deed: Omit<OwnershipDeedRecord, "_id" | "createdAt" | "updatedAt">
  ): Promise<string> {
    if (!this.db) throw new Error("Database not connected");

    const record: OwnershipDeedRecord = {
      ...deed,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.db
      .collection("ownershipDeeds")
      .insertOne(record as any);
    console.log(`✅ Ownership deed saved: ${deed.deedId}`);
    return result.insertedId.toString();
  }

  async getOwnershipDeed(deedId: number): Promise<OwnershipDeedRecord | null> {
    if (!this.db) throw new Error("Database not connected");
    return (await this.db
      .collection("ownershipDeeds")
      .findOne({ deedId })) as any;
  }

  async getOwnershipDeedsByOwner(
    ownerAddress: string
  ): Promise<OwnershipDeedRecord[]> {
    if (!this.db) throw new Error("Database not connected");
    return (await this.db
      .collection("ownershipDeeds")
      .find({ ownerAddress })
      .toArray()) as any;
  }

  // Event Invite Records
  async saveEventInvite(
    event: Omit<EventInviteRecord, "_id" | "createdAt" | "updatedAt">
  ): Promise<string> {
    if (!this.db) throw new Error("Database not connected");

    const record: EventInviteRecord = {
      ...event,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.db
      .collection("eventInvites")
      .insertOne(record as any);
    console.log(`✅ Event invite saved: ${event.eventName}`);
    return result.insertedId.toString();
  }

  async getEventInvite(eventId: number): Promise<EventInviteRecord | null> {
    if (!this.db) throw new Error("Database not connected");
    return (await this.db
      .collection("eventInvites")
      .findOne({ eventId })) as any;
  }

  // Product Launch Records
  async saveProductLaunch(
    launch: Omit<ProductLaunchRecord, "_id" | "createdAt" | "updatedAt">
  ): Promise<string> {
    if (!this.db) throw new Error("Database not connected");

    const record: ProductLaunchRecord = {
      ...launch,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.db
      .collection("productLaunches")
      .insertOne(record as any);
    console.log(`✅ Product launch saved: ${launch.productName}`);
    return result.insertedId.toString();
  }

  async getProductLaunch(
    launchId: number
  ): Promise<ProductLaunchRecord | null> {
    if (!this.db) throw new Error("Database not connected");
    return (await this.db
      .collection("productLaunches")
      .findOne({ launchId })) as any;
  }

  // Art Drop Records
  async saveArtDrop(
    artDrop: Omit<ArtDropRecord, "_id" | "createdAt" | "updatedAt">
  ): Promise<string> {
    if (!this.db) throw new Error("Database not connected");

    const record: ArtDropRecord = {
      ...artDrop,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.db
      .collection("artDrops")
      .insertOne(record as any);
    console.log(`✅ Art drop saved: ${artDrop.artworkTitle}`);
    return result.insertedId.toString();
  }

  async getArtDrop(artDropId: number): Promise<ArtDropRecord | null> {
    if (!this.db) throw new Error("Database not connected");
    return (await this.db.collection("artDrops").findOne({ artDropId })) as any;
  }

  // Offer Records
  async saveOffer(
    offer: Omit<OfferRecord, "_id" | "createdAt" | "updatedAt">
  ): Promise<string> {
    if (!this.db) throw new Error("Database not connected");

    const record: OfferRecord = {
      ...offer,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.db.collection("offers").insertOne(record as any);
    console.log(`✅ Offer saved: ${offer.offerName}`);
    return result.insertedId.toString();
  }

  async getOffer(offerId: number): Promise<OfferRecord | null> {
    if (!this.db) throw new Error("Database not connected");
    return (await this.db.collection("offers").findOne({ offerId })) as any;
  }

  // Analytics and Statistics
  async getTransactionStats(): Promise<{
    totalTransactions: number;
    pendingTransactions: number;
    confirmedTransactions: number;
    failedTransactions: number;
    totalBrands: number;
    totalProductPassports: number;
    totalProvenanceEntries: number;
    totalOwnershipDeeds: number;
  }> {
    if (!this.db) throw new Error("Database not connected");

    const [
      totalTransactions,
      pendingTransactions,
      confirmedTransactions,
      failedTransactions,
      totalBrands,
      totalProductPassports,
      totalProvenanceEntries,
      totalOwnershipDeeds,
    ] = await Promise.all([
      this.db.collection("transactions").countDocuments(),
      this.db.collection("transactions").countDocuments({ status: "pending" }),
      this.db
        .collection("transactions")
        .countDocuments({ status: "confirmed" }),
      this.db.collection("transactions").countDocuments({ status: "failed" }),
      this.db.collection("brands").countDocuments(),
      this.db.collection("productPassports").countDocuments(),
      this.db.collection("provenance").countDocuments(),
      this.db.collection("ownershipDeeds").countDocuments(),
    ]);

    return {
      totalTransactions,
      pendingTransactions,
      confirmedTransactions,
      failedTransactions,
      totalBrands,
      totalProductPassports,
      totalProvenanceEntries,
      totalOwnershipDeeds,
    };
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      if (!this.db) return false;
      await this.db.admin().ping();
      console.log("✅ MongoDB connection test successful");
      return true;
    } catch (error) {
      console.error("❌ MongoDB connection test failed:", error);
      return false;
    }
  }
}

export default new DatabaseService();
