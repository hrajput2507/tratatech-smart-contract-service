const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying TrataTech secure contracts to Polygon Mainnet (137)...");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const result = {
    network: "polygon",
    chainId: 137,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {}
  };

  // 1) MinimalForwarderSecure
  const MinimalForwarderSecure = await ethers.getContractFactory("MinimalForwarderSecure");
  const minimalForwarder = await MinimalForwarderSecure.deploy();
  await minimalForwarder.waitForDeployment();
  const minimalForwarderAddress = await minimalForwarder.getAddress();
  console.log(`MinimalForwarderSecure: ${minimalForwarderAddress}`);
  result.contracts.minimalForwarder = { address: minimalForwarderAddress };

  // 2) TrataTechProductPassportUpgradeableSecure (UUPS Proxy)
  const ProductPassport = await ethers.getContractFactory("TrataTechProductPassportUpgradeableSecure");
  const productPassport = await upgrades.deployProxy(ProductPassport, [deployer.address], { kind: "uups", initializer: "initialize" });
  await productPassport.waitForDeployment();
  const productPassportAddress = await productPassport.getAddress();
  console.log(`ProductPassport (proxy): ${productPassportAddress}`);
  result.contracts.productPassport = {
    address: productPassportAddress,
    implementation: await upgrades.erc1967.getImplementationAddress(productPassportAddress)
  };

  // 3) TrataTechProvenanceUpgradeableSecure (UUPS Proxy)
  const Provenance = await ethers.getContractFactory("TrataTechProvenanceUpgradeableSecure");
  const provenance = await upgrades.deployProxy(Provenance, [deployer.address, minimalForwarderAddress], { kind: "uups", initializer: "initialize" });
  await provenance.waitForDeployment();
  const provenanceAddress = await provenance.getAddress();
  console.log(`Provenance (proxy): ${provenanceAddress}`);
  result.contracts.provenance = {
    address: provenanceAddress,
    implementation: await upgrades.erc1967.getImplementationAddress(provenanceAddress)
  };

  // 4) TrataTechOwnershipRegistryUpgradeableSecure (UUPS Proxy)
  const OwnershipRegistry = await ethers.getContractFactory("TrataTechOwnershipRegistryUpgradeableSecure");
  const ownershipRegistry = await upgrades.deployProxy(OwnershipRegistry, [deployer.address, minimalForwarderAddress], { kind: "uups", initializer: "initialize" });
  await ownershipRegistry.waitForDeployment();
  const ownershipRegistryAddress = await ownershipRegistry.getAddress();
  console.log(`OwnershipRegistry (proxy): ${ownershipRegistryAddress}`);
  result.contracts.ownershipRegistry = {
    address: ownershipRegistryAddress,
    implementation: await upgrades.erc1967.getImplementationAddress(ownershipRegistryAddress)
  };

  // 5) TrataTechMainUpgradeableSecure (UUPS Proxy)
  const Main = await ethers.getContractFactory("TrataTechMainUpgradeableSecure");
  const main = await upgrades.deployProxy(Main, [deployer.address, minimalForwarderAddress], { kind: "uups", initializer: "initialize" });
  await main.waitForDeployment();
  const mainAddress = await main.getAddress();
  console.log(`Main (proxy): ${mainAddress}`);
  result.contracts.main = {
    address: mainAddress,
    implementation: await upgrades.erc1967.getImplementationAddress(mainAddress)
  };

  // Save deployment
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });
  const filename = `deployment-upgradeable-polygonMainnet-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(path.join(deploymentsDir, filename), JSON.stringify(result, null, 2));
  console.log(`Saved deployment: deployments/${filename}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = main;
