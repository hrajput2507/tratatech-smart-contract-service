#!/usr/bin/env node

const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔒 SECURE CONTRACTS DEPLOYMENT - TrataTech Platform");
  console.log("=".repeat(60));
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
    transactions: {},
    gasUsed: {}
  };

  try {
    // Phase 1: Deploy MinimalForwarderSecure
    console.log("\n🏗️ PHASE 1: Deploy MinimalForwarderSecure");
    console.log("-".repeat(40));

    const MinimalForwarderSecure = await ethers.getContractFactory("MinimalForwarderSecure");
    const forwarderSecure = await MinimalForwarderSecure.deploy();
    await forwarderSecure.waitForDeployment();
    const forwarderSecureAddress = await forwarderSecure.getAddress();

    const forwarderTx = forwarderSecure.deploymentTransaction();
    const forwarderReceipt = await forwarderTx.wait();

    console.log(`✅ MinimalForwarderSecure: ${forwarderSecureAddress}`);
    console.log(`⛽ Gas Used: ${forwarderReceipt.gasUsed.toString()}`);

    deploymentResults.contracts.minimalForwarderSecure = forwarderSecureAddress;
    deploymentResults.transactions.minimalForwarderSecure = forwarderTx.hash;
    deploymentResults.gasUsed.minimalForwarderSecure = forwarderReceipt.gasUsed.toString();

    // Phase 2: Deploy TrataTechMainUpgradeableSecure
    console.log("\n🏗️ PHASE 2: Deploy TrataTechMainUpgradeableSecure");
    console.log("-".repeat(40));

    const MainSecure = await ethers.getContractFactory("TrataTechMainUpgradeableSecure");
    const mainSecure = await upgrades.deployProxy(
      MainSecure,
      [deployer.address, forwarderSecureAddress],
      {
        initializer: 'initialize',
        constructorArgs: [forwarderSecureAddress],
        kind: 'uups'
      }
    );
    await mainSecure.waitForDeployment();
    const mainSecureAddress = await mainSecure.getAddress();

    console.log(`✅ TrataTechMainUpgradeableSecure: ${mainSecureAddress}`);
    deploymentResults.contracts.mainSecure = mainSecureAddress;

    // Phase 3: Deploy TrataTechProductPassportUpgradeableSecure
    console.log("\n🏗️ PHASE 3: Deploy TrataTechProductPassportUpgradeableSecure");
    console.log("-".repeat(40));

    const ProductPassportSecure = await ethers.getContractFactory("TrataTechProductPassportUpgradeableSecure");
    const productPassportSecure = await upgrades.deployProxy(
      ProductPassportSecure,
      [deployer.address],
      {
        initializer: 'initialize',
        constructorArgs: [forwarderSecureAddress],
        kind: 'uups'
      }
    );
    await productPassportSecure.waitForDeployment();
    const productPassportSecureAddress = await productPassportSecure.getAddress();

    console.log(`✅ TrataTechProductPassportUpgradeableSecure: ${productPassportSecureAddress}`);
    deploymentResults.contracts.productPassportSecure = productPassportSecureAddress;

    // Phase 4: Deploy TrataTechProvenanceUpgradeableSecure
    console.log("\n🏗️ PHASE 4: Deploy TrataTechProvenanceUpgradeableSecure");
    console.log("-".repeat(40));

    const ProvenanceSecure = await ethers.getContractFactory("TrataTechProvenanceUpgradeableSecure");
    const provenanceSecure = await upgrades.deployProxy(
      ProvenanceSecure,
      [deployer.address, forwarderSecureAddress],
      {
        initializer: 'initialize',
        constructorArgs: [forwarderSecureAddress],
        kind: 'uups'
      }
    );
    await provenanceSecure.waitForDeployment();
    const provenanceSecureAddress = await provenanceSecure.getAddress();

    console.log(`✅ TrataTechProvenanceUpgradeableSecure: ${provenanceSecureAddress}`);
    deploymentResults.contracts.provenanceSecure = provenanceSecureAddress;

    // Phase 5: Deploy TrataTechOwnershipRegistryUpgradeableSecure
    console.log("\n🏗️ PHASE 5: Deploy TrataTechOwnershipRegistryUpgradeableSecure");
    console.log("-".repeat(40));

    const OwnershipSecure = await ethers.getContractFactory("TrataTechOwnershipRegistryUpgradeableSecure");
    const ownershipSecure = await upgrades.deployProxy(
      OwnershipSecure,
      [deployer.address, forwarderSecureAddress],
      {
        initializer: 'initialize',
        constructorArgs: [forwarderSecureAddress],
        kind: 'uups'
      }
    );
    await ownershipSecure.waitForDeployment();
    const ownershipSecureAddress = await ownershipSecure.getAddress();

    console.log(`✅ TrataTechOwnershipRegistryUpgradeableSecure: ${ownershipSecureAddress}`);
    deploymentResults.contracts.ownershipSecure = ownershipSecureAddress;

    // Phase 6: Update .env file with secure contract addresses
    console.log("\n📝 Updating .env file with secure contract addresses...");

    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Add secure contract addresses section
    const secureAddressesSection = `
# =============================================================================
# SECURE CONTRACT ADDRESSES (Deployment - ${new Date().toISOString()})
# =============================================================================
MINIMAL_FORWARDER_SECURE_ADDRESS=${forwarderSecureAddress}
MAIN_CONTRACT_SECURE_ADDRESS=${mainSecureAddress}
PRODUCT_PASSPORT_SECURE_ADDRESS=${productPassportSecureAddress}
PROVENANCE_SECURE_ADDRESS=${provenanceSecureAddress}
OWNERSHIP_REGISTRY_SECURE_ADDRESS=${ownershipSecureAddress}
`;

    // Append to existing .env file
    envContent += secureAddressesSection;
    fs.writeFileSync(envPath, envContent);

    console.log("✅ .env file updated with secure contract addresses");

    // Phase 7: Verify initial contract states
    console.log("\n🔍 PHASE 7: Verify Contract States");
    console.log("-".repeat(40));

    // Verify MinimalForwarderSecure
    const forwarderSecureContract = await ethers.getContractAt("MinimalForwarderSecure", forwarderSecureAddress);
    const nonce = await forwarderSecureContract.getNonce(deployer.address);
    console.log(`✅ MinimalForwarderSecure nonce for deployer: ${nonce}`);

    // Verify MainSecure ownership
    const mainSecureContract = await ethers.getContractAt("TrataTechMainUpgradeableSecure", mainSecureAddress);
    const mainOwner = await mainSecureContract.owner();
    console.log(`✅ TrataTechMainUpgradeableSecure owner: ${mainOwner}`);

    // Verify ProductPassportSecure ownership
    const productPassportSecureContract = await ethers.getContractAt("TrataTechProductPassportUpgradeableSecure", productPassportSecureAddress);
    const passportOwner = await productPassportSecureContract.owner();
    console.log(`✅ TrataTechProductPassportUpgradeableSecure owner: ${passportOwner}`);

    // Verify ProvenanceSecure ownership
    const provenanceSecureContract = await ethers.getContractAt("TrataTechProvenanceUpgradeableSecure", provenanceSecureAddress);
    const provenanceOwner = await provenanceSecureContract.owner();
    console.log(`✅ TrataTechProvenanceUpgradeableSecure owner: ${provenanceOwner}`);

    // Verify OwnershipSecure ownership
    const ownershipSecureContract = await ethers.getContractAt("TrataTechOwnershipRegistryUpgradeableSecure", ownershipSecureAddress);
    const ownershipOwner = await ownershipSecureContract.owner();
    console.log(`✅ TrataTechOwnershipRegistryUpgradeableSecure owner: ${ownershipOwner}`);

    console.log("\n🎉 SECURE CONTRACTS DEPLOYMENT SUCCESSFUL!");
    console.log("=".repeat(60));
    console.log("📋 Secure Contract Summary:");
    Object.entries(deploymentResults.contracts).forEach(([name, address]) => {
      console.log(`   ${name}: ${address}`);
    });

    // Save deployment results
    const reportFile = `secure-contracts-deployment-${Date.now()}.json`;
    const reportPath = path.join(__dirname, '..', reportFile);
    fs.writeFileSync(reportPath, JSON.stringify(deploymentResults, null, 2));
    console.log(`\n📄 Deployment report saved: ${reportFile}`);

    console.log("\n🔗 Next Steps:");
    console.log("1. Verify contracts on PolygonScan");
    console.log("2. Test contract functionality");
    console.log("3. Configure API endpoints to use secure contracts");
    console.log("4. Run comprehensive tests with Postman collection");

    return deploymentResults;

  } catch (error) {
    console.error("❌ Secure contracts deployment failed:", error);

    deploymentResults.error = {
      message: error.message,
      stack: error.stack
    };

    const errorFile = `secure-deployment-error-${Date.now()}.json`;
    const errorPath = path.join(__dirname, '..', errorFile);
    fs.writeFileSync(errorPath, JSON.stringify(deploymentResults, null, 2));
    console.log(`📄 Error report saved: ${errorFile}`);

    throw error;
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };