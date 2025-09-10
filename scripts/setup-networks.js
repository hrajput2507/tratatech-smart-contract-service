import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createEnvFile() {
  const envContent = `# Server Configuration
PORT=3000
NODE_ENV=development
HOST=0.0.0.0

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/tratatech
MONGODB_TEST_URI=mongodb://localhost:27017/tratatech_test

# IPFS Configuration (Pinata V2)
PINATA_JWT=your_pinata_jwt_token_here
PINATA_GATEWAY=gateway.pinata.cloud
PINATA_GATEWAY_URL=https://gateway.pinata.cloud/ipfs/

# Blockchain Configuration (Polygon Networks)
# Your Alchemy RPC URLs
POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/hnix8ZkwMP2xxe1KxhvQIvc8CvDkjVu_
POLYGON_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/hnix8ZkwMP2xxe1KxhvQIvc8CvDkjVu_
# For mainnet, you'll need to get a mainnet Alchemy key
POLYGON_MAINNET_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_MAINNET_ALCHEMY_KEY

# Your wallet private key (64 characters, no 0x prefix)
PRIVATE_KEY=your_private_key_here
NETWORK=polygon-amoy

# Contract Addresses (Will be updated after deployment)
TRATATECH_MAIN_ADDRESS=0x0000000000000000000000000000000000000000
TRATATECH_PASSPORT_ADDRESS=0x0000000000000000000000000000000000000000
TRATATECH_OWNERSHIP_ADDRESS=0x0000000000000000000000000000000000000000
TRATATECH_PROVENANCE_ADDRESS=0x0000000000000000000000000000000000000000
TRATATECH_FORWARDER_ADDRESS=0x0000000000000000000000000000000000000000

# API Keys for Verification
POLYGONSCAN_API_KEY=your_polygonscan_api_key_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
CORS_ORIGIN=http://localhost:3000
HELMET_ENABLED=true

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=uploads/`;

  const envFile = path.join(__dirname, "..", ".env");
  
  if (fs.existsSync(envFile)) {
    console.log("⚠️  .env file already exists. Backing up to .env.backup");
    fs.copyFileSync(envFile, envFile + ".backup");
  }
  
  fs.writeFileSync(envFile, envContent);
  console.log("✅ Created .env file with your Polygon RPC URLs");
  console.log("📝 Please update the following in your .env file:");
  console.log("   - PINATA_JWT: Your Pinata JWT token");
  console.log("   - PRIVATE_KEY: Your wallet private key");
  console.log("   - POLYGONSCAN_API_KEY: Your Polygonscan API key");
  console.log("   - POLYGON_MAINNET_RPC_URL: Your mainnet Alchemy key (when ready)");
}

function showNetworkInfo() {
  console.log("\n🌐 Network Configuration:");
  console.log("=" .repeat(50));
  console.log("Polygon Amoy (Testnet):");
  console.log("  RPC URL: https://polygon-amoy.g.alchemy.com/v2/hnix8ZkwMP2xxe1KxhvQIvc8CvDkjVu_");
  console.log("  Chain ID: 80002");
  console.log("  Explorer: https://amoy.polygonscan.com/");
  console.log("  Faucet: https://faucet.polygon.technology/");
  console.log("");
  console.log("Polygon Mainnet:");
  console.log("  RPC URL: https://polygon-mainnet.g.alchemy.com/v2/YOUR_MAINNET_KEY");
  console.log("  Chain ID: 137");
  console.log("  Explorer: https://polygonscan.com/");
  console.log("");
  console.log("📋 Available Commands:");
  console.log("  npm run deploy:amoy     - Deploy to Polygon Amoy");
  console.log("  npm run deploy:mainnet  - Deploy to Polygon Mainnet");
  console.log("  npm run update-env      - Update .env with deployed addresses");
}

createEnvFile();
showNetworkInfo();
