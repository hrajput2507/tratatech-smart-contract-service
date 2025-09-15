const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Updating .env file with deployed contract addresses...");

  // Read the latest deployment file
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const files = fs.readdirSync(deploymentsDir)
    .filter(f => f.startsWith("deployment-upgradeable-polygonAmoy-"))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    console.error("❌ No deployment file found. Please deploy contracts first.");
    process.exit(1);
  }

  const latestDeployment = JSON.parse(fs.readFileSync(path.join(deploymentsDir, files[0]), 'utf8'));
  console.log(`📄 Using deployment: ${files[0]}`);

  const contracts = latestDeployment.contracts;
  
  // Read current .env file
  const envPath = path.join(__dirname, "..", ".env");
  let envContent = "";
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Update or add contract addresses
  const updates = {
    "MINIMAL_FORWARDER_ADDRESS": contracts.minimalForwarder.address,
    "PRODUCT_PASSPORT_ADDRESS": contracts.productPassport.address,
    "PROVENANCE_ADDRESS": contracts.provenance.address,
    "OWNERSHIP_REGISTRY_ADDRESS": contracts.ownershipRegistry.address,
    "MAIN_CONTRACT_ADDRESS": contracts.main.address,
    "NETWORK": "polygon-amoy"
  };

  console.log("\n📝 Updating environment variables:");
  
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const newLine = `${key}=${value}`;
    
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, newLine);
      console.log(`   ✅ Updated ${key}=${value}`);
    } else {
      envContent += `\n${newLine}`;
      console.log(`   ➕ Added ${key}=${value}`);
    }
  }

  // Write updated .env file
  fs.writeFileSync(envPath, envContent);
  
  console.log(`\n🎉 Environment file updated successfully!`);
  console.log(`📄 Updated: ${envPath}`);
  
  console.log("\n📋 Contract Addresses:");
  console.log(`   Minimal Forwarder: ${contracts.minimalForwarder.address}`);
  console.log(`   Product Passport: ${contracts.productPassport.address}`);
  console.log(`   Provenance: ${contracts.provenance.address}`);
  console.log(`   Ownership Registry: ${contracts.ownershipRegistry.address}`);
  console.log(`   Main: ${contracts.main.address}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error("\n❌ Script failed:");
    console.error(e);
    process.exit(1);
  });
}

module.exports = main;
