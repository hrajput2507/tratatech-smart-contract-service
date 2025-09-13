#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Contract addresses from deployment
const contractAddresses = {
  PRODUCT_PASSPORT_ADDRESS: "0x34cc1828eE50334DF316D952FA1a4b43C1EC143e",
  PROVENANCE_ADDRESS: "0xdD435877bF2465AaEe4CDb5710Ae4850eaEBbF7f",
  OWNERSHIP_REGISTRY_ADDRESS: "0xae3583d4256C2c01d1451126356aE19e2d065614",
  MAIN_CONTRACT_ADDRESS: "0x2e0C1A2d91EEd498b8B94Ee54bD07F700E28906F"
};

// Environment template
const envTemplate = `# =============================================================================
# NETWORK CONFIGURATION
# =============================================================================
NETWORK=polygon-amoy

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
# DEPLOYED CONTRACT ADDRESSES (Updated with actual deployed addresses)
# =============================================================================
PRODUCT_PASSPORT_ADDRESS=${contractAddresses.PRODUCT_PASSPORT_ADDRESS}
PROVENANCE_ADDRESS=${contractAddresses.PROVENANCE_ADDRESS}
OWNERSHIP_REGISTRY_ADDRESS=${contractAddresses.OWNERSHIP_REGISTRY_ADDRESS}
MAIN_CONTRACT_ADDRESS=${contractAddresses.MAIN_CONTRACT_ADDRESS}

# =============================================================================
# SERVER CONFIGURATION
# =============================================================================
PORT=3005
NODE_ENV=production

# =============================================================================
# API AUTHENTICATION
# =============================================================================
# API Key Configuration (for testing - in production, use a database)
# These are default API keys for testing purposes
DEFAULT_ADMIN_API_KEY=admin-api-key-123
DEFAULT_USER_API_KEY=user-api-key-456
DEFAULT_OPERATOR_API_KEY=operator-api-key-789

# =============================================================================
# PRODUCTION & CORS CONFIGURATION
# =============================================================================
PRODUCTION_URL=https://api.tratatech.com
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# =============================================================================
# DATABASE CONFIGURATION (Optional - for production)
# =============================================================================
# DATABASE_URL=postgresql://username:password@localhost:5432/tratatech
# REDIS_URL=redis://localhost:6379

# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true

# =============================================================================
# IPFS CONFIGURATION (Pinata)
# =============================================================================
PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjNThiNWEwNy01YzAwLTQyZTgtOWExOC1hZTU3MGJjNTU2MTkiLCJlbWFpbCI6ImhyYWpwdXQyNTA3QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiJlYThhOWQyM2I2NmVkNzFlMmJjYSIsInNjb3BlZEtleVNlY3JldCI6ImZhMWQ0NmU4ZmY3MWNhZjRlZmQ1OTNkMTEyMjMwYjRjNDk3OTZkN2YzNmNmNmFjZWNkZmY0NTZiYmEyMmRhMjgiLCJleHAiOjE3ODg4NTM2ODZ9.M2C8uv4EyccZnZCAHeoZRtdBMHx8xWOohBpdHEjio1U
PINATA_GATEWAY=purple-actual-skink-755.mypinata.cloud
PINATA_GATEWAY_URL=https://purple-actual-skink-755.mypinata.cloud/ipfs/

# =============================================================================
# MONGODB CONFIGURATION
# =============================================================================
MONGODB_URI=mongodb://localhost:27017/tratatech
`;

// Write the .env file
const envPath = path.join(__dirname, '.env');
fs.writeFileSync(envPath, envTemplate);

console.log('✅ Environment file created successfully!');
console.log('📝 Please update the following in your .env file:');
console.log('   - PRIVATE_KEY: Add your wallet private key');
console.log('   - POLYGONSCAN_API_KEY: Add your Polygonscan API key (optional)');
console.log('');
console.log('🔗 Contract addresses have been set:');
console.log(`   - Product Passport: ${contractAddresses.PRODUCT_PASSPORT_ADDRESS}`);
console.log(`   - Provenance: ${contractAddresses.PROVENANCE_ADDRESS}`);
console.log(`   - Ownership Registry: ${contractAddresses.OWNERSHIP_REGISTRY_ADDRESS}`);
console.log(`   - Main Contract: ${contractAddresses.MAIN_CONTRACT_ADDRESS}`);
console.log('');
console.log('🌐 IPFS (Pinata) configuration:');
console.log('   - PINATA_JWT: Already configured');
console.log('   - PINATA_GATEWAY: Already configured');
console.log('   - PINATA_GATEWAY_URL: Already configured');
console.log('');
console.log('🗄️  MongoDB configuration:');
console.log('   - MONGODB_URI: Already configured');
console.log('   - Make sure MongoDB is running on localhost:27017');
console.log('');
console.log('🚀 You can now start the server with: npm start');
