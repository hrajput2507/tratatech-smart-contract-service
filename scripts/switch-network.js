import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function switchNetwork(targetNetwork) {
  const envFile = path.join(__dirname, "..", ".env");
  
  if (!fs.existsSync(envFile)) {
    console.log("❌ .env file not found. Please run 'npm run setup' first.");
    return;
  }

  let envContent = fs.readFileSync(envFile, "utf8");
  
  // Update NETWORK variable
  const networkRegex = /^NETWORK=.*$/m;
  const newNetworkLine = `NETWORK=${targetNetwork}`;
  
  if (networkRegex.test(envContent)) {
    envContent = envContent.replace(networkRegex, newNetworkLine);
  } else {
    envContent += `\n${newNetworkLine}`;
  }
  
  fs.writeFileSync(envFile, envContent);
  
  console.log(`✅ Switched to ${targetNetwork} network`);
  console.log(`📝 Updated .env file with NETWORK=${targetNetwork}`);
  
  // Show network info
  if (targetNetwork === "polygon-amoy") {
    console.log("\n🌐 Polygon Amoy (Testnet) Configuration:");
    console.log("  RPC URL: https://polygon-amoy.g.alchemy.com/v2/hnix8ZkwMP2xxe1KxhvQIvc8CvDkjVu_");
    console.log("  Chain ID: 80002");
    console.log("  Explorer: https://amoy.polygonscan.com/");
  } else if (targetNetwork === "polygon-mainnet") {
    console.log("\n🌐 Polygon Mainnet Configuration:");
    console.log("  RPC URL: https://polygon-mainnet.g.alchemy.com/v2/YOUR_MAINNET_KEY");
    console.log("  Chain ID: 137");
    console.log("  Explorer: https://polygonscan.com/");
  }
}

// Get target network from command line arguments
const targetNetwork = process.argv[2];

if (!targetNetwork) {
  console.log("Usage: node scripts/switch-network.js <network>");
  console.log("Available networks:");
  console.log("  polygon-amoy     - Switch to Polygon Amoy testnet");
  console.log("  polygon-mainnet  - Switch to Polygon Mainnet");
  process.exit(1);
}

if (!["polygon-amoy", "polygon-mainnet"].includes(targetNetwork)) {
  console.log("❌ Invalid network. Available networks:");
  console.log("  polygon-amoy     - Polygon Amoy testnet");
  console.log("  polygon-mainnet  - Polygon Mainnet");
  process.exit(1);
}

switchNetwork(targetNetwork);
