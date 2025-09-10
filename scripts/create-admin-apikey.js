#!/usr/bin/env node

import { config } from "dotenv";
import mongoose from "mongoose";
import { ApiKeyService } from "../src/services/apikey.service.ts";

// Load environment variables
config();

async function createAdminApiKey() {
  try {
    console.log("🔑 Creating admin API key...");
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/tratatech";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");
    
    // Create API key service instance
    const apiKeyService = ApiKeyService.getInstance();
    
    // Create admin API key with all permissions
    const { apiKey, keyDoc } = await apiKeyService.createApiKey({
      name: "Admin API Key",
      description: "Full access API key for testing and administration",
      permissions: [
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
        "admin:all"
      ],
      createdBy: "system"
    });
    
    console.log("\n🎉 Admin API key created successfully!");
    console.log("=====================================");
    console.log(`API Key: ${apiKey}`);
    console.log(`Name: ${keyDoc.name}`);
    console.log(`ID: ${keyDoc._id}`);
    console.log(`Permissions: ${keyDoc.permissions.join(", ")}`);
    console.log("\n💡 Use this API key in the x-api-key header for all requests");
    console.log("Example: curl -H 'x-api-key: YOUR_API_KEY' http://localhost:3000/api/health");
    
    // Also create a read-only key for testing
    const { apiKey: readOnlyKey, keyDoc: readOnlyDoc } = await apiKeyService.createApiKey({
      name: "Read-Only API Key",
      description: "Read-only access for testing",
      permissions: [
        "main:read",
        "passport:read", 
        "ownership:read",
        "provenance:read",
        "forwarder:read"
      ],
      createdBy: "system"
    });
    
    console.log("\n📖 Read-only API key created:");
    console.log(`API Key: ${readOnlyKey}`);
    console.log(`Name: ${readOnlyDoc.name}`);
    console.log(`Permissions: ${readOnlyDoc.permissions.join(", ")}`);
    
  } catch (error) {
    console.error("❌ Error creating API key:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

createAdminApiKey();
