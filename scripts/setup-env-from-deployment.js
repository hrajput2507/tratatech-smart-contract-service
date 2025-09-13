#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function updateEnvFile(deploymentFile) {
  console.log("🔧 Setting up environment variables from deployment...");
  
  if (!fs.existsSync(deploymentFile)) {
    console.error(`❌ Deployment file not found: ${deploymentFile}`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  
  if (deployment.status !== "deployed") {
    console.error("❌ Deployment was not successful. Cannot update environment variables.");
    process.exit(1);
  }

  console.log(`📋 Updating .env file for network: ${deployment.network}`);
  
  // Read current .env file
  const envPath = path.join(__dirname, "..", ".env");
  let envContent = "";
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  } else {
    console.log("📄 Creating new .env file...");
    envContent = `# =============================================================================
# NETWORK CONFIGURATION
# =============================================================================
NETWORK=${deployment.network === "polygonMainnet" ? "polygon" : "polygon-amoy"}

# Network RPC URLs
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology

# =============================================================================
# BLOCKCHAIN CONFIGURATION
# =============================================================================
# Private Key (without 0x prefix) - REQUIRED for contract deployment and transactions
PRIVATE_KEY="your_private_key_here"

# API Keys for contract verification
POLYGONSCAN_API_KEY=your_polygonscan_api_key_here

# Gas Reporter
REPORT_GAS=true

# =============================================================================
# DEPLOYED CONTRACT ADDRESSES
# =============================================================================
PRODUCT_PASSPORT_ADDRESS=
PROVENANCE_ADDRESS=
OWNERSHIP_REGISTRY_ADDRESS=
MAIN_CONTRACT_ADDRESS=

# =============================================================================
# FORWARDER CONTRACT ADDRESSES (For Gasless Transactions)
# =============================================================================
MINIMAL_FORWARDER_AMOY=
TRATATECH_FORWARDER_AMOY=
MINIMAL_FORWARDER_POLYGON=
TRATATECH_FORWARDER_POLYGON=

# =============================================================================
# GASLESS TRANSACTION CONFIGURATION
# =============================================================================
# Enable gasless transactions
USE_TRATATECH_FORWARDER=true
USE_BICONOMY=false
USE_GELATO=false
USE_DEFENDER=false

# =============================================================================
# SERVER CONFIGURATION
# =============================================================================
PORT=3005
NODE_ENV=development

# =============================================================================
# API AUTHENTICATION
# =============================================================================
DEFAULT_ADMIN_API_KEY=admin-api-key-123
DEFAULT_USER_API_KEY=user-api-key-456
DEFAULT_OPERATOR_API_KEY=operator-api-key-789

# =============================================================================
# IPFS CONFIGURATION (Pinata)
# =============================================================================
PINATA_JWT=your_pinata_jwt_here
PINATA_GATEWAY=your_pinata_gateway_here
PINATA_GATEWAY_URL=https://your_pinata_gateway_here/ipfs/

# =============================================================================
# DATABASE CONFIGURATION (MongoDB)
# =============================================================================
MONGODB_URI=mongodb://localhost:27017/tratatech

# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
`;
  }

  // Update contract addresses
  const updates = {
    PRODUCT_PASSPORT_ADDRESS: deployment.contracts.productPassport.proxy,
    PROVENANCE_ADDRESS: deployment.contracts.provenance.proxy,
    OWNERSHIP_REGISTRY_ADDRESS: deployment.contracts.ownershipRegistry.proxy,
    MAIN_CONTRACT_ADDRESS: deployment.contracts.mainContract.proxy,
  };

  // Update forwarder addresses based on network
  if (deployment.network === "polygonMainnet") {
    updates.MINIMAL_FORWARDER_POLYGON = deployment.contracts.forwarders.minimal;
    updates.TRATATECH_FORWARDER_POLYGON = deployment.contracts.forwarders.tratatech;
  } else {
    updates.MINIMAL_FORWARDER_AMOY = deployment.contracts.forwarders.minimal;
    updates.TRATATECH_FORWARDER_AMOY = deployment.contracts.forwarders.tratatech;
  }

  // Apply updates to env content
  Object.entries(updates).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      // Add new entry if it doesn't exist
      envContent += `\n${key}=${value}`;
    }
  });

  // Write updated .env file
  fs.writeFileSync(envPath, envContent);
  
  console.log("✅ Environment variables updated successfully!");
  console.log("\n📋 Updated Contract Addresses:");
  Object.entries(updates).forEach(([key, value]) => {
    console.log(`   ${key}=${value}`);
  });
  
  console.log("\n🔧 Next Steps:");
  console.log("1. Update your PRIVATE_KEY in the .env file");
  console.log("2. Update your PINATA_JWT and PINATA_GATEWAY if needed");
  console.log("3. Update your MONGODB_URI if needed");
  console.log("4. Restart your API server");
  console.log("5. Test the contracts with your API");
  
  if (deployment.network === "polygonMainnet") {
    console.log("\n⚠️  MAINNET DEPLOYMENT:");
    console.log("   - Make sure you have sufficient MATIC for transactions");
    console.log("   - Consider verifying contracts on Polygonscan");
    console.log("   - Test thoroughly before production use");
  } else {
    console.log("\n🧪 TESTNET DEPLOYMENT:");
    console.log("   - Get testnet MATIC from: https://faucet.polygon.technology/");
    console.log("   - Test all functionality before mainnet deployment");
  }
}

// Main execution
const deploymentFile = process.argv[2];

if (!deploymentFile) {
  console.log("Usage: node setup-env-from-deployment.js <deployment-file.json>");
  console.log("\nExample:");
  console.log("  node setup-env-from-deployment.js deployment-upgradeable-polygonAmoy-1234567890.json");
  process.exit(1);
}

updateEnvFile(deploymentFile);
