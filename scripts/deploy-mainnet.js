#!/usr/bin/env node

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting TrataTech Smart Contract Deployment on Polygon Mainnet");
  console.log("=" .repeat(70));
  console.log("⚠️  WARNING: This will deploy to POLYGON MAINNET!");
  console.log("⚠️  Make sure you have sufficient MATIC for gas fees!");
  console.log("⚠️  This action cannot be undone!");
  console.log("=" .repeat(70));

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📋 Deployment Configuration:");
  console.log(`   Network: Polygon Mainnet`);
  console.log(`   Deployer: ${deployer.address}`);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`   Balance: ${ethers.formatEther(balance)} MATIC`);
  
  if (balance < ethers.parseEther("10")) {
    console.log("⚠️  WARNING: Low balance! You may need more MATIC for deployment.");
    console.log("   Recommended: At least 10 MATIC for mainnet deployment");
  }
  
  console.log("\n🔨 Deploying Contracts...");

  const deploymentResults = {
    network: "polygonMainnet",
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    upgradeable: true,
    pattern: "UUPS",
    gasless: true,
    status: "deploying",
    contracts: {}
  };

  try {
    // 1. Deploy Minimal Forwarder
    console.log("\n1️⃣  Deploying Minimal Forwarder...");
    const MinimalForwarder = await ethers.getContractFactory("MinimalForwarder");
    const minimalForwarder = await MinimalForwarder.deploy();
    await minimalForwarder.waitForDeployment();
    const minimalForwarderAddress = await minimalForwarder.getAddress();
    console.log(`   ✅ Minimal Forwarder deployed to: ${minimalForwarderAddress}`);
    deploymentResults.contracts.forwarders = {
      minimal: minimalForwarderAddress
    };

    // 2. Deploy TrataTech Forwarder
    console.log("\n2️⃣  Deploying TrataTech Forwarder...");
    const TrataTechForwarder = await ethers.getContractFactory("TrataTechForwarder");
    const tratatechForwarder = await TrataTechForwarder.deploy(minimalForwarderAddress);
    await tratatechForwarder.waitForDeployment();
    const tratatechForwarderAddress = await tratatechForwarder.getAddress();
    console.log(`   ✅ TrataTech Forwarder deployed to: ${tratatechForwarderAddress}`);
    deploymentResults.contracts.forwarders.tratatech = tratatechForwarderAddress;

    // 3. Deploy Product Passport Contract (Implementation)
    console.log("\n3️⃣  Deploying Product Passport Implementation...");
    const ProductPassportImpl = await ethers.getContractFactory("TrataTechProductPassportUpgradeable");
    const productPassportImpl = await ProductPassportImpl.deploy();
    await productPassportImpl.waitForDeployment();
    const productPassportImplAddress = await productPassportImpl.getAddress();
    console.log(`   ✅ Product Passport Implementation deployed to: ${productPassportImplAddress}`);

    // 4. Deploy Product Passport Proxy
    console.log("\n4️⃣  Deploying Product Passport Proxy...");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = await ProxyAdmin.deploy();
    await proxyAdmin.waitForDeployment();
    const proxyAdminAddress = await proxyAdmin.getAddress();
    console.log(`   ✅ Proxy Admin deployed to: ${proxyAdminAddress}`);

    const TransparentUpgradeableProxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const productPassportProxy = await TransparentUpgradeableProxy.deploy(
      productPassportImplAddress,
      proxyAdminAddress,
      "0x" // Empty initialization data
    );
    await productPassportProxy.waitForDeployment();
    const productPassportProxyAddress = await productPassportProxy.getAddress();
    console.log(`   ✅ Product Passport Proxy deployed to: ${productPassportProxyAddress}`);

    // Initialize Product Passport
    const productPassport = ProductPassportImpl.attach(productPassportProxyAddress);
    const initTx = await productPassport.initialize();
    await initTx.wait();
    console.log(`   ✅ Product Passport initialized`);
    deploymentResults.contracts.productPassport = {
      implementation: productPassportImplAddress,
      proxy: productPassportProxyAddress,
      admin: proxyAdminAddress
    };

    // 5. Deploy Provenance Contract
    console.log("\n5️⃣  Deploying Provenance Implementation...");
    const ProvenanceImpl = await ethers.getContractFactory("TrataTechProvenanceUpgradeable");
    const provenanceImpl = await ProvenanceImpl.deploy();
    await provenanceImpl.waitForDeployment();
    const provenanceImplAddress = await provenanceImpl.getAddress();
    console.log(`   ✅ Provenance Implementation deployed to: ${provenanceImplAddress}`);

    // Deploy Provenance Proxy
    console.log("\n6️⃣  Deploying Provenance Proxy...");
    const provenanceProxy = await TransparentUpgradeableProxy.deploy(
      provenanceImplAddress,
      proxyAdminAddress,
      "0x" // Empty initialization data
    );
    await provenanceProxy.waitForDeployment();
    const provenanceProxyAddress = await provenanceProxy.getAddress();
    console.log(`   ✅ Provenance Proxy deployed to: ${provenanceProxyAddress}`);

    // Initialize Provenance
    const provenance = ProvenanceImpl.attach(provenanceProxyAddress);
    const provenanceInitTx = await provenance.initialize();
    await provenanceInitTx.wait();
    console.log(`   ✅ Provenance initialized`);
    deploymentResults.contracts.provenance = {
      implementation: provenanceImplAddress,
      proxy: provenanceProxyAddress
    };

    // 7. Deploy Ownership Registry Contract
    console.log("\n7️⃣  Deploying Ownership Registry Implementation...");
    const OwnershipImpl = await ethers.getContractFactory("TrataTechOwnershipRegistryUpgradeable");
    const ownershipImpl = await OwnershipImpl.deploy();
    await ownershipImpl.waitForDeployment();
    const ownershipImplAddress = await ownershipImpl.getAddress();
    console.log(`   ✅ Ownership Registry Implementation deployed to: ${ownershipImplAddress}`);

    // Deploy Ownership Registry Proxy
    console.log("\n8️⃣  Deploying Ownership Registry Proxy...");
    const ownershipProxy = await TransparentUpgradeableProxy.deploy(
      ownershipImplAddress,
      proxyAdminAddress,
      "0x" // Empty initialization data
    );
    await ownershipProxy.waitForDeployment();
    const ownershipProxyAddress = await ownershipProxy.getAddress();
    console.log(`   ✅ Ownership Registry Proxy deployed to: ${ownershipProxyAddress}`);

    // Initialize Ownership Registry
    const ownership = OwnershipImpl.attach(ownershipProxyAddress);
    const ownershipInitTx = await ownership.initialize();
    await ownershipInitTx.wait();
    console.log(`   ✅ Ownership Registry initialized`);
    deploymentResults.contracts.ownershipRegistry = {
      implementation: ownershipImplAddress,
      proxy: ownershipProxyAddress
    };

    // 8. Deploy Main Contract
    console.log("\n9️⃣  Deploying Main Contract Implementation...");
    const MainImpl = await ethers.getContractFactory("TrataTechMainUpgradeable");
    const mainImpl = await MainImpl.deploy();
    await mainImpl.waitForDeployment();
    const mainImplAddress = await mainImpl.getAddress();
    console.log(`   ✅ Main Contract Implementation deployed to: ${mainImplAddress}`);

    // Deploy Main Contract Proxy
    console.log("\n🔟 Deploying Main Contract Proxy...");
    const mainProxy = await TransparentUpgradeableProxy.deploy(
      mainImplAddress,
      proxyAdminAddress,
      "0x" // Empty initialization data
    );
    await mainProxy.waitForDeployment();
    const mainProxyAddress = await mainProxy.getAddress();
    console.log(`   ✅ Main Contract Proxy deployed to: ${mainProxyAddress}`);

    // Initialize Main Contract
    const main = MainImpl.attach(mainProxyAddress);
    const mainInitTx = await main.initialize();
    await mainInitTx.wait();
    console.log(`   ✅ Main Contract initialized`);
    deploymentResults.contracts.mainContract = {
      implementation: mainImplAddress,
      proxy: mainProxyAddress
    };

    // Update deployment status
    deploymentResults.status = "deployed";

    // Save deployment results
    const deploymentFile = `deployment-upgradeable-polygonMainnet-${Date.now()}.json`;
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentResults, null, 2));

    console.log("\n🎉 Deployment Completed Successfully!");
    console.log("=" .repeat(70));
    console.log("📋 Contract Addresses:");
    console.log(`   Minimal Forwarder: ${minimalForwarderAddress}`);
    console.log(`   TrataTech Forwarder: ${tratatechForwarderAddress}`);
    console.log(`   Product Passport Proxy: ${productPassportProxyAddress}`);
    console.log(`   Provenance Proxy: ${provenanceProxyAddress}`);
    console.log(`   Ownership Registry Proxy: ${ownershipProxyAddress}`);
    console.log(`   Main Contract Proxy: ${mainProxyAddress}`);
    console.log(`   Proxy Admin: ${proxyAdminAddress}`);
    
    console.log("\n📄 Deployment results saved to:", deploymentFile);
    
    console.log("\n🔧 Next Steps:");
    console.log("1. Update your .env file with the new contract addresses");
    console.log("2. Run the setup script to update environment variables");
    console.log("3. Test the contracts with your API");
    console.log("4. Consider contract verification on Polygonscan");
    
    console.log("\n💡 Environment Variables to Update:");
    console.log(`   PRODUCT_PASSPORT_ADDRESS=${productPassportProxyAddress}`);
    console.log(`   PROVENANCE_ADDRESS=${provenanceProxyAddress}`);
    console.log(`   OWNERSHIP_REGISTRY_ADDRESS=${ownershipProxyAddress}`);
    console.log(`   MAIN_CONTRACT_ADDRESS=${mainProxyAddress}`);
    console.log(`   MINIMAL_FORWARDER_POLYGON=${minimalForwarderAddress}`);
    console.log(`   TRATATECH_FORWARDER_POLYGON=${tratatechForwarderAddress}`);

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    deploymentResults.status = "failed";
    deploymentResults.error = error.message;
    
    const deploymentFile = `deployment-upgradeable-polygonMainnet-failed-${Date.now()}.json`;
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentResults, null, 2));
    console.log("📄 Error details saved to:", deploymentFile);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
