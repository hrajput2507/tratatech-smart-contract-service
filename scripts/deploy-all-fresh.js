#!/usr/bin/env node

const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 FRESH DEPLOYMENT - ALL 5 TRATATECH CONTRACTS");
  console.log("=".repeat(60));
  console.log(`⏰ Started: ${new Date().toISOString()}`);

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "MATIC");

  const deploymentResults = {
    timestamp: new Date().toISOString(),
    network: "Polygon Amoy Testnet",
    chainId: 80002,
    deployer: deployer.address,
    contracts: {},
    transactions: {}
  };

  try {
    // 1. Deploy MinimalForwarder
    console.log("\n1️⃣  Deploying MinimalForwarder...");
    const MinimalForwarder = await ethers.getContractFactory("MinimalForwarder");
    const forwarder = await MinimalForwarder.deploy();
    await forwarder.waitForDeployment();
    const forwarderAddress = await forwarder.getAddress();
    console.log(`   ✅ MinimalForwarder: ${forwarderAddress}`);
    deploymentResults.contracts.forwarder = forwarderAddress;

    // 2. Deploy Main Contract (gasless)
    console.log("\n2️⃣  Deploying Main Contract...");
    const Main = await ethers.getContractFactory("TrataTechMainUpgradeable");
    const main = await upgrades.deployProxy(
      Main,
      [deployer.address, forwarderAddress],
      {
        initializer: 'initialize',
        constructorArgs: [forwarderAddress],
        kind: 'uups'
      }
    );
    await main.waitForDeployment();
    const mainAddress = await main.getAddress();
    console.log(`   ✅ Main Contract: ${mainAddress}`);
    deploymentResults.contracts.main = mainAddress;

    // 3. Deploy Product Passport (gasless)
    console.log("\n3️⃣  Deploying Product Passport...");
    const ProductPassport = await ethers.getContractFactory("TrataTechProductPassportUpgradeable");
    const passport = await upgrades.deployProxy(
      ProductPassport,
      [deployer.address],
      {
        initializer: 'initialize',
        constructorArgs: [forwarderAddress],
        kind: 'uups'
      }
    );
    await passport.waitForDeployment();
    const passportAddress = await passport.getAddress();
    console.log(`   ✅ Product Passport: ${passportAddress}`);
    deploymentResults.contracts.passport = passportAddress;

    // 4. Deploy Provenance (gasless)
    console.log("\n4️⃣  Deploying Provenance...");
    const Provenance = await ethers.getContractFactory("TrataTechProvenanceUpgradeable");
    const provenance = await upgrades.deployProxy(
      Provenance,
      [deployer.address, forwarderAddress],
      {
        initializer: 'initialize',
        constructorArgs: [forwarderAddress],
        kind: 'uups'
      }
    );
    await provenance.waitForDeployment();
    const provenanceAddress = await provenance.getAddress();
    console.log(`   ✅ Provenance: ${provenanceAddress}`);
    deploymentResults.contracts.provenance = provenanceAddress;

    // 5. Deploy Ownership Registry (gasless)
    console.log("\n5️⃣  Deploying Ownership Registry...");
    const Ownership = await ethers.getContractFactory("TrataTechOwnershipRegistryUpgradeable");
    const ownership = await upgrades.deployProxy(
      Ownership,
      [deployer.address, forwarderAddress],
      {
        initializer: 'initialize',
        constructorArgs: [forwarderAddress],
        kind: 'uups'
      }
    );
    await ownership.waitForDeployment();
    const ownershipAddress = await ownership.getAddress();
    console.log(`   ✅ Ownership Registry: ${ownershipAddress}`);
    deploymentResults.contracts.ownership = ownershipAddress;

    console.log("\n🎉 ALL CONTRACTS DEPLOYED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log("📍 CONTRACT ADDRESSES:");
    console.log(`MinimalForwarder:     ${forwarderAddress}`);
    console.log(`Main Contract:        ${mainAddress}`);
    console.log(`Product Passport:     ${passportAddress}`);
    console.log(`Provenance:          ${provenanceAddress}`);
    console.log(`Ownership Registry:  ${ownershipAddress}`);

    // Save deployment results
    const reportFile = `deployment-fresh-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(deploymentResults, null, 2));
    console.log(`\n📄 Deployment report: ${reportFile}`);

    return deploymentResults;

  } catch (error) {
    console.error("❌ Deployment failed:", error);

    deploymentResults.error = error.message;
    deploymentResults.errorStack = error.stack;
    const failureFile = `deployment-fresh-failure-${Date.now()}.json`;
    fs.writeFileSync(failureFile, JSON.stringify(deploymentResults, null, 2));

    throw error;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };