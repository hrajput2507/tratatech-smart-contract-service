import hardhat from "hardhat";
const { ethers } = hardhat;

async function main() {
  console.log("🔐 Granting roles to deployer wallet...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);
  
  // Contract addresses from deployment
  const contractAddresses = {
    TrataTechMain: "0x23C71C82B812eb17d086437Ca5Cd9C9f466A3CAE",
    TrataTechProductPassport: "0xb8e5De9569f66765307E6ffA6F436F46c8Da347E",
    TrataTechOwnershipRegistry: "0xcf078eCb785d5aeAFf63fDb9AE13caa31ffD6e2C",
    TrataTechProvenance: "0x08e8DB6AA4213475159635bdbB6868BD31296124"
  };
  
  // Role hashes
  const BRAND_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BRAND_ROLE"));
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  
  try {
    // Grant BRAND_ROLE to deployer for TrataTechMain
    console.log("\n🏢 Granting BRAND_ROLE for TrataTechMain...");
    const mainContract = await ethers.getContractAt("TrataTechMain_Fixed", contractAddresses.TrataTechMain);
    const tx1 = await mainContract.grantRole(BRAND_ROLE, deployer.address);
    await tx1.wait();
    console.log("✅ BRAND_ROLE granted for TrataTechMain");
    
    // Grant BRAND_ROLE to deployer for TrataTechProductPassport
    console.log("\n📋 Granting BRAND_ROLE for TrataTechProductPassport...");
    const passportContract = await ethers.getContractAt("TrataTechProductPassport_Fixed", contractAddresses.TrataTechProductPassport);
    const tx2 = await passportContract.grantRole(BRAND_ROLE, deployer.address);
    await tx2.wait();
    console.log("✅ BRAND_ROLE granted for TrataTechProductPassport");
    
    // Grant BRAND_ROLE to deployer for TrataTechOwnershipRegistry
    console.log("\n🏠 Granting BRAND_ROLE for TrataTechOwnershipRegistry...");
    const ownershipContract = await ethers.getContractAt("TrataTechOwnershipRegistry_Fixed", contractAddresses.TrataTechOwnershipRegistry);
    const tx3 = await ownershipContract.grantRole(BRAND_ROLE, deployer.address);
    await tx3.wait();
    console.log("✅ BRAND_ROLE granted for TrataTechOwnershipRegistry");
    
    // Grant OPERATOR_ROLE to deployer for TrataTechProvenance
    console.log("\n🔍 Granting OPERATOR_ROLE for TrataTechProvenance...");
    const provenanceContract = await ethers.getContractAt("TrataTechProvenance_Fixed", contractAddresses.TrataTechProvenance);
    const tx4 = await provenanceContract.grantRole(OPERATOR_ROLE, deployer.address);
    await tx4.wait();
    console.log("✅ OPERATOR_ROLE granted for TrataTechProvenance");
    
    console.log("\n🎉 All roles granted successfully!");
    console.log("📝 Deployer address:", deployer.address);
    console.log("🔑 Granted roles:");
    console.log("  - BRAND_ROLE for TrataTechMain");
    console.log("  - BRAND_ROLE for TrataTechProductPassport");
    console.log("  - BRAND_ROLE for TrataTechOwnershipRegistry");
    console.log("  - OPERATOR_ROLE for TrataTechProvenance");
    
  } catch (error) {
    console.error("❌ Failed to grant roles:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
