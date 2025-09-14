#!/usr/bin/env node

const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 FRESH DEPLOYMENT - All TrataTech Contracts");
  console.log("=".repeat(50));
  console.log(`⏰ Started: ${new Date().toISOString()}`);

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} MATIC`);

  const deploymentResults = {
    network: "Polygon Amoy Testnet",
    chainId: 80002,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {},
    transactions: {}
  };

  try {
    console.log("\n🏗️ PHASE 1: Deploy MinimalForwarder");
    console.log("-".repeat(30));

    const MinimalForwarder = await ethers.getContractFactory("MinimalForwarder");
    const forwarder = await MinimalForwarder.deploy();
    await forwarder.waitForDeployment();
    const forwarderAddress = await forwarder.getAddress();

    console.log(`✅ MinimalForwarder: ${forwarderAddress}`);
    deploymentResults.contracts.forwarder = forwarderAddress;
    deploymentResults.transactions.forwarder = forwarder.deploymentTransaction().hash;

    console.log("\n🏗️ PHASE 2: Deploy Main Contract");
    console.log("-".repeat(30));

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

    console.log(`✅ Main Contract: ${mainAddress}`);
    deploymentResults.contracts.main = mainAddress;

    console.log("\n🏗️ PHASE 3: Deploy Product Passport");
    console.log("-".repeat(30));

    const ProductPassport = await ethers.getContractFactory("TrataTechProductPassportUpgradeable");
    const productPassport = await upgrades.deployProxy(
      ProductPassport,
      [forwarderAddress],
      {
        initializer: 'initialize',
        constructorArgs: [forwarderAddress],
        kind: 'uups'
      }
    );
    await productPassport.waitForDeployment();
    const productPassportAddress = await productPassport.getAddress();

    console.log(`✅ Product Passport: ${productPassportAddress}`);
    deploymentResults.contracts.productPassport = productPassportAddress;

    console.log("\n🏗️ PHASE 4: Deploy Provenance");
    console.log("-".repeat(30));

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

    console.log(`✅ Provenance: ${provenanceAddress}`);
    deploymentResults.contracts.provenance = provenanceAddress;

    console.log("\n🏗️ PHASE 5: Deploy Ownership Registry");
    console.log("-".repeat(30));

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

    console.log(`✅ Ownership Registry: ${ownershipAddress}`);
    deploymentResults.contracts.ownership = ownershipAddress;

    console.log("\n🏗️ PHASE 6: Deploy Business Events");
    console.log("-".repeat(30));

    const BusinessEvents = await ethers.getContractFactory("TrataTechBusinessEventsUpgradeable");
    const businessEvents = await upgrades.deployProxy(
      BusinessEvents,
      [deployer.address, forwarderAddress],
      {
        initializer: 'initialize',
        constructorArgs: [forwarderAddress],
        kind: 'uups'
      }
    );
    await businessEvents.waitForDeployment();
    const businessEventsAddress = await businessEvents.getAddress();

    console.log(`✅ Business Events: ${businessEventsAddress}`);
    deploymentResults.contracts.businessEvents = businessEventsAddress;

    console.log("\n📝 Updating .env file...");
    const envContent = `PRIVATE_KEY=${process.env.PRIVATE_KEY}
POLYGON_AMOY_RPC_URL=${process.env.POLYGON_AMOY_RPC_URL}
PINATA_JWT=${process.env.PINATA_JWT}

# Fresh Contract Addresses - ${new Date().toISOString()}
MINIMAL_FORWARDER_ADDRESS=${forwarderAddress}
MAIN_CONTRACT_ADDRESS=${mainAddress}
PRODUCT_PASSPORT_ADDRESS=${productPassportAddress}
PROVENANCE_ADDRESS=${provenanceAddress}
OWNERSHIP_REGISTRY_ADDRESS=${ownershipAddress}
BUSINESS_EVENTS_ADDRESS=${businessEventsAddress}
`;

    fs.writeFileSync('.env', envContent);
    console.log("✅ .env file updated");

    console.log("\n🎉 FRESH DEPLOYMENT SUCCESSFUL!");
    console.log("=".repeat(50));
    console.log("📋 Contract Summary:");
    Object.entries(deploymentResults.contracts).forEach(([name, address]) => {
      console.log(`   ${name}: ${address}`);
    });

    // Save deployment results
    const reportFile = `fresh-deployment-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(deploymentResults, null, 2));
    console.log(`\n📄 Deployment report: ${reportFile}`);

    return deploymentResults;

  } catch (error) {
    console.error("❌ Fresh deployment failed:", error);

    deploymentResults.error = error.message;
    const errorFile = `deployment-error-${Date.now()}.json`;
    fs.writeFileSync(errorFile, JSON.stringify(deploymentResults, null, 2));

    throw error;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };