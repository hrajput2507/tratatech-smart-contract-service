const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Initializing TrataTech contracts on Polygon Amoy...");

  const signers = await ethers.getSigners();
  if (!signers || signers.length === 0) {
    console.error("❌ No deployer account configured. Set PRIVATE_KEY in your .env file.");
    process.exit(1);
  }
  const deployer = signers[0];
  console.log(`Deployer: ${deployer.address}`);

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

  const minimalForwarderAddress = latestDeployment.contracts.minimalForwarder.address;
  const productPassportAddress = latestDeployment.contracts.productPassport.address;
  const provenanceAddress = latestDeployment.contracts.provenance.address;
  const ownershipRegistryAddress = latestDeployment.contracts.ownershipRegistry.address;
  const mainAddress = latestDeployment.contracts.main.address;

  console.log(`Minimal Forwarder: ${minimalForwarderAddress}`);
  console.log(`Product Passport: ${productPassportAddress}`);
  console.log(`Provenance: ${provenanceAddress}`);
  console.log(`Ownership Registry: ${ownershipRegistryAddress}`);
  console.log(`Main: ${mainAddress}`);

  try {
    // 1. Initialize Product Passport
    console.log("\n🔧 Initializing Product Passport...");
    const ProductPassport = await ethers.getContractFactory("TrataTechProductPassportUpgradeableSecure");
    const productPassport = ProductPassport.attach(productPassportAddress);
    
    // Check if already initialized by trying to call owner()
    try {
      const owner = await productPassport.owner();
      console.log(`✅ Product Passport already initialized. Owner: ${owner}`);
    } catch (error) {
      console.log("⚠️ Product Passport not initialized, initializing now...");
      const tx = await productPassport.initialize(deployer.address);
      await tx.wait();
      console.log("✅ Product Passport initialized");
    }

    // 2. Initialize Provenance
    console.log("\n🔧 Initializing Provenance...");
    const Provenance = await ethers.getContractFactory("TrataTechProvenanceUpgradeableSecure");
    const provenance = Provenance.attach(provenanceAddress);
    
    try {
      const owner = await provenance.owner();
      console.log(`✅ Provenance already initialized. Owner: ${owner}`);
    } catch (error) {
      console.log("⚠️ Provenance not initialized, initializing now...");
      const tx = await provenance.initialize(deployer.address, minimalForwarderAddress);
      await tx.wait();
      console.log("✅ Provenance initialized");
    }

    // 3. Initialize Ownership Registry
    console.log("\n🔧 Initializing Ownership Registry...");
    const OwnershipRegistry = await ethers.getContractFactory("TrataTechOwnershipRegistryUpgradeableSecure");
    const ownershipRegistry = OwnershipRegistry.attach(ownershipRegistryAddress);
    
    try {
      const owner = await ownershipRegistry.owner();
      console.log(`✅ Ownership Registry already initialized. Owner: ${owner}`);
    } catch (error) {
      console.log("⚠️ Ownership Registry not initialized, initializing now...");
      const tx = await ownershipRegistry.initialize(deployer.address, minimalForwarderAddress);
      await tx.wait();
      console.log("✅ Ownership Registry initialized");
    }

    // 4. Initialize Main
    console.log("\n🔧 Initializing Main...");
    const Main = await ethers.getContractFactory("TrataTechMainUpgradeableSecure");
    const main = Main.attach(mainAddress);
    
    try {
      const owner = await main.owner();
      console.log(`✅ Main already initialized. Owner: ${owner}`);
    } catch (error) {
      console.log("⚠️ Main not initialized, initializing now...");
      const tx = await main.initialize(deployer.address, minimalForwarderAddress);
      await tx.wait();
      console.log("✅ Main initialized");
    }

    console.log("\n🎉 All contracts initialized successfully!");
    console.log("\n📋 Contract Status:");
    console.log(`   Product Passport: ${productPassportAddress} - Ready`);
    console.log(`   Provenance: ${provenanceAddress} - Ready`);
    console.log(`   Ownership Registry: ${ownershipRegistryAddress} - Ready`);
    console.log(`   Main: ${mainAddress} - Ready`);

  } catch (error) {
    console.error("\n❌ Initialization failed:");
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error("\n❌ Script failed:");
    console.error(e);
    process.exit(1);
  });
}

module.exports = main;
