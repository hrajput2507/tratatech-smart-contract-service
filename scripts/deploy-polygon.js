import hardhat from "hardhat";
const { ethers } = hardhat;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Get network from command line arguments or environment variable
  const args = process.argv.slice(2);
  const networkArg = args.find(arg => arg.startsWith('--network='));
  const hardhatNetwork = networkArg ? networkArg.split('=')[1] : (process.env.NETWORK || "polygon-amoy");
  
  console.log(`🚀 Deploying TrataTech contracts to ${hardhatNetwork}...`);
  console.log(`🔗 Using Hardhat network: ${hardhatNetwork}`);

  // Validate network
  if (!["polygon-amoy", "polygon-mainnet"].includes(hardhatNetwork)) {
    throw new Error(`❌ Unsupported network: ${hardhatNetwork}. Use 'polygon-amoy' or 'polygon-mainnet'`);
  }

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("❌ Insufficient balance for deployment");
  }

  const contractAddresses = {};

  try {
    // 1. Deploy TrataTechSecurityEnhanced (Library)
    console.log("\n📚 Deploying TrataTechSecurityEnhanced library...");
    const TrataTechSecurityEnhanced = await ethers.getContractFactory("TrataTechSecurityEnhanced");
    const securityEnhanced = await TrataTechSecurityEnhanced.deploy();
    await securityEnhanced.waitForDeployment();
    const securityEnhancedAddress = await securityEnhanced.getAddress();
    contractAddresses.TrataTechSecurityEnhanced = securityEnhancedAddress;
    console.log("✅ TrataTechSecurityEnhanced deployed to:", securityEnhancedAddress);

    // 2. Deploy ERC2771Forwarder
    console.log("\n🔄 Deploying ERC2771Forwarder...");
    const ERC2771Forwarder = await ethers.getContractFactory("ERC2771Forwarder");
    // OpenZeppelin ERC2771Forwarder constructor expects only the name; version is fixed to "1" internally
    const forwarder = await ERC2771Forwarder.deploy("TrataTechForwarder");
    await forwarder.waitForDeployment();
    const forwarderAddress = await forwarder.getAddress();
    contractAddresses.ERC2771Forwarder = forwarderAddress;
    console.log("✅ ERC2771Forwarder deployed to:", forwarderAddress);

    // 3. Deploy TrataTechMain
    console.log("\n🏢 Deploying TrataTechMain...");
    const TrataTechMain = await ethers.getContractFactory("TrataTechMain_Fixed");
    const main = await TrataTechMain.deploy(forwarderAddress);
    await main.waitForDeployment();
    const mainAddress = await main.getAddress();
    contractAddresses.TrataTechMain = mainAddress;
    console.log("✅ TrataTechMain deployed to:", mainAddress);

    // 4. Deploy TrataTechProductPassport
    console.log("\n📋 Deploying TrataTechProductPassport...");
    const TrataTechProductPassport = await ethers.getContractFactory("TrataTechProductPassport_Fixed");
    const passport = await TrataTechProductPassport.deploy(deployer.address, deployer.address, forwarderAddress);
    await passport.waitForDeployment();
    const passportAddress = await passport.getAddress();
    contractAddresses.TrataTechProductPassport = passportAddress;
    console.log("✅ TrataTechProductPassport deployed to:", passportAddress);

    // 5. Deploy TrataTechOwnershipRegistry
    console.log("\n🏠 Deploying TrataTechOwnershipRegistry...");
    const TrataTechOwnershipRegistry = await ethers.getContractFactory("TrataTechOwnershipRegistry_Fixed");
    const ownership = await TrataTechOwnershipRegistry.deploy(forwarderAddress);
    await ownership.waitForDeployment();
    const ownershipAddress = await ownership.getAddress();
    contractAddresses.TrataTechOwnershipRegistry = ownershipAddress;
    console.log("✅ TrataTechOwnershipRegistry deployed to:", ownershipAddress);

    // 6. Deploy TrataTechProvenance
    console.log("\n🔍 Deploying TrataTechProvenance...");
    const TrataTechProvenance = await ethers.getContractFactory("TrataTechProvenance_Fixed");
    const provenance = await TrataTechProvenance.deploy(forwarderAddress);
    await provenance.waitForDeployment();
    const provenanceAddress = await provenance.getAddress();
    contractAddresses.TrataTechProvenance = provenanceAddress;
    console.log("✅ TrataTechProvenance deployed to:", provenanceAddress);

    // Save deployment addresses
    const deploymentData = {
      network: hardhatNetwork,
      chainId: (await ethers.provider.getNetwork()).chainId.toString(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: contractAddresses,
    };

    const deploymentFile = path.join(__dirname, "..", "deployment-addresses.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));

    console.log("\n🎉 Deployment Summary:");
    console.log("=" .repeat(50));
    console.log(`Network: ${hardhatNetwork}`);
    console.log(`Chain ID: ${deploymentData.chainId}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Timestamp: ${deploymentData.timestamp}`);
    console.log("\n📋 Contract Addresses:");
    Object.entries(contractAddresses).forEach(([name, address]) => {
      console.log(`${name}: ${address}`);
    });

    console.log(`\n💾 Deployment data saved to: ${deploymentFile}`);

    // Generate .env update
    console.log("\n🔧 Update your .env file with these addresses:");
    console.log("=" .repeat(50));
    Object.entries(contractAddresses).forEach(([name, address]) => {
      const envVar = name.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '') + '_ADDRESS';
      console.log(`${envVar}=${address}`);
    });

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
