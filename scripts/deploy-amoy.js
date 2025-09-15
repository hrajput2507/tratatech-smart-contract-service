const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying TrataTech secure contracts to Polygon Amoy (80002)...");

  const signers = await ethers.getSigners();
  if (!signers || signers.length === 0) {
    console.error(
      "❌ No deployer account configured. Set PRIVATE_KEY in your .env and re-run. Example: PRIVATE_KEY=0xYOUR_PRIVATE_KEY"
    );
    process.exit(1);
  }
  const deployer = signers[0];
  console.log(`Deployer: ${deployer.address}`);

  const result = {
    network: "polygonAmoy",
    chainId: 80002,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {}
  };

  // 1) MinimalForwarderSecure (no constructor args)
  console.log("Deploying MinimalForwarderSecure...");
  const MinimalForwarderSecure = await ethers.getContractFactory("MinimalForwarderSecure");
  const minimalForwarder = await MinimalForwarderSecure.deploy();
  await minimalForwarder.waitForDeployment();
  const minimalForwarderAddress = await minimalForwarder.getAddress();
  console.log(`✅ MinimalForwarderSecure: ${minimalForwarderAddress}`);
  result.contracts.minimalForwarder = { address: minimalForwarderAddress };

  // Helper to save proxy info
  async function saveProxy(name, proxyAddress) {
    result.contracts[name] = {
      address: proxyAddress,
      implementation: await upgrades.erc1967.getImplementationAddress(proxyAddress),
      admin: await upgrades.erc1967.getAdminAddress(proxyAddress)
    };
  }

  // 2) TrataTechProductPassportUpgradeableSecure (proxy)
  console.log("Deploying TrataTechProductPassportUpgradeableSecure (proxy)...");
  const ProductPassport = await ethers.getContractFactory("TrataTechProductPassportUpgradeableSecure");
  const productPassport = await upgrades.deployProxy(
    ProductPassport,
    [deployer.address], // initialize(initialOwner)
    {
      kind: "uups",
      initializer: "initialize",
      constructorArgs: [minimalForwarderAddress], // constructor(trustedForwarder)
      unsafeAllow: ["constructor"]
    }
  );
  await productPassport.waitForDeployment();
  const productPassportAddress = await productPassport.getAddress();
  console.log(`✅ ProductPassport (proxy): ${productPassportAddress}`);
  await saveProxy("productPassport", productPassportAddress);

  // 3) TrataTechProvenanceUpgradeableSecure (proxy)
  console.log("Deploying TrataTechProvenanceUpgradeableSecure (proxy)...");
  const Provenance = await ethers.getContractFactory("TrataTechProvenanceUpgradeableSecure");
  const provenance = await upgrades.deployProxy(
    Provenance,
    [deployer.address, minimalForwarderAddress], // initialize(owner, forwarder)
    {
      kind: "uups",
      initializer: "initialize",
      constructorArgs: [minimalForwarderAddress], // constructor(trustedForwarder)
      unsafeAllow: ["constructor"]
    }
  );
  await provenance.waitForDeployment();
  const provenanceAddress = await provenance.getAddress();
  console.log(`✅ Provenance (proxy): ${provenanceAddress}`);
  await saveProxy("provenance", provenanceAddress);

  // 4) TrataTechOwnershipRegistryUpgradeableSecure (proxy)
  console.log("Deploying TrataTechOwnershipRegistryUpgradeableSecure (proxy)...");
  const OwnershipRegistry = await ethers.getContractFactory("TrataTechOwnershipRegistryUpgradeableSecure");
  const ownershipRegistry = await upgrades.deployProxy(
    OwnershipRegistry,
    [deployer.address, minimalForwarderAddress], // initialize(owner, forwarder)
    {
      kind: "uups",
      initializer: "initialize",
      constructorArgs: [minimalForwarderAddress],
      unsafeAllow: ["constructor"]
    }
  );
  await ownershipRegistry.waitForDeployment();
  const ownershipRegistryAddress = await ownershipRegistry.getAddress();
  console.log(`✅ OwnershipRegistry (proxy): ${ownershipRegistryAddress}`);
  await saveProxy("ownershipRegistry", ownershipRegistryAddress);

  // 5) TrataTechMainUpgradeableSecure (proxy)
  console.log("Deploying TrataTechMainUpgradeableSecure (proxy)...");
  const Main = await ethers.getContractFactory("TrataTechMainUpgradeableSecure");
  const main = await upgrades.deployProxy(
    Main,
    [deployer.address, minimalForwarderAddress], // initialize(owner, forwarder)
    {
      kind: "uups",
      initializer: "initialize",
      constructorArgs: [minimalForwarderAddress],
      unsafeAllow: ["constructor"]
    }
  );
  await main.waitForDeployment();
  const mainAddress = await main.getAddress();
  console.log(`✅ Main (proxy): ${mainAddress}`);
  await saveProxy("main", mainAddress);

  // Save deployment
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });
  const filename = `deployment-upgradeable-polygonAmoy-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(path.join(deploymentsDir, filename), JSON.stringify(result, null, 2));
  
  console.log("\n🎉 Deployment completed successfully!");
  console.log(`📄 Saved deployment: deployments/${filename}`);
  console.log("\n📋 Contract Addresses:");
  Object.entries(result.contracts).forEach(([name, info]) => {
    console.log(`   ${name}: ${info.address}`);
  });
}

if (require.main === module) {
  main().catch((e) => {
    console.error("\n❌ Deployment failed:");
    console.error(e);
    process.exit(1);
  });
}

module.exports = main;