#!/usr/bin/env node

const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🔄 COMPLETE OWNERSHIP TRANSFER TEST - USER1 → USER2");
  console.log("=".repeat(60));
  console.log(`⏰ Started: ${new Date().toISOString()}`);

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);

  // Use fresh contract addresses
  const ownershipAddress = "0x3372AFF8427e1ab1CFBeC7CFaf8BAb4CBC10aDDD";
  console.log(`📍 Using Ownership Contract: ${ownershipAddress}`);

  // Create users for the transfer
  const user1 = ethers.Wallet.createRandom().connect(ethers.provider);
  const user2 = ethers.Wallet.createRandom().connect(ethers.provider);

  console.log(`👤 User 1 (Initial Owner): ${user1.address}`);
  console.log(`👤 User 2 (Transfer Target): ${user2.address}`);

  // Fund users
  const fundAmount = ethers.parseEther("0.5");
  await (await deployer.sendTransaction({ to: user1.address, value: fundAmount })).wait();
  await (await deployer.sendTransaction({ to: user2.address, value: fundAmount })).wait();
  console.log("💰 Both users funded with 0.5 MATIC each");

  const testResults = {
    testTimestamp: new Date().toISOString(),
    testType: "Complete Ownership Transfer Test",
    network: "Polygon Amoy Testnet",
    chainId: 80002,
    ownershipContract: ownershipAddress,
    participants: {
      deployer: deployer.address,
      user1: user1.address,
      user2: user2.address
    },
    transactions: {}
  };

  try {
    // Connect to ownership contract
    const OwnershipRegistry = await ethers.getContractFactory("TrataTechOwnershipRegistryUpgradeable");
    const ownership = OwnershipRegistry.attach(ownershipAddress);

    // Use a unique passport ID
    const uniquePassportId = 7777 + Math.floor(Math.random() * 1000);
    const uniqueId = Date.now();

    console.log("\n🏗️ STEP 1: Create Initial Ownership Deed (User1 as Owner)");
    console.log("-".repeat(50));

    // 1. Create ownership deed for User1
    console.log(`1️⃣ Creating ownership deed for User1 (Passport ID: ${uniquePassportId})...`);
    const acquisitionPrice = ethers.parseEther("1.0");

    let tx = await ownership.createOwnershipDeed(
      uniquePassportId,
      user1.address, // User1 is the initial owner
      acquisitionPrice,
      "Primary Sale",
      `QmInitialOwnership${uniqueId}`,
      ethers.keccak256(ethers.toUtf8Bytes(`initial-ownership-${uniqueId}`)),
      []
    );
    await tx.wait();
    testResults.transactions.createInitialDeed = tx.hash;
    console.log(`   ✅ Initial deed created: ${tx.hash}`);

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Find the deed ID from events or use sequential numbering
    // For fresh contracts, this should be deed ID 1, 2, 3, etc.
    let deedId;
    try {
      // Try to find the deed by checking if User1 owns any tokens
      // Since this is a fresh contract, let's start with deed ID 1
      for (let testId = 1; testId <= 5; testId++) {
        try {
          const owner = await ownership.ownerOf(testId);
          if (owner.toLowerCase() === user1.address.toLowerCase()) {
            deedId = testId;
            console.log(`🔍 Found User1's deed: ID ${deedId}`);
            break;
          }
        } catch (e) {
          // Token doesn't exist, continue
        }
      }
    } catch (error) {
      // Fallback: assume it's deed ID 1
      deedId = 1;
    }

    if (!deedId) {
      deedId = 1; // Default assumption for fresh contract
    }

    console.log("\n✅ STEP 1 COMPLETE: Initial Ownership Established");
    console.log(`   📦 Deed ID: ${deedId}`);
    console.log(`   👤 Current Owner: ${user1.address}`);

    console.log("\n🔄 STEP 2: Transfer Ownership (User1 → User2)");
    console.log("-".repeat(50));

    // 2. Verify User1 owns the deed before transfer
    console.log(`2️⃣ Verifying User1 owns deed ${deedId}...`);
    const currentOwner = await ownership.ownerOf(deedId);
    console.log(`   📋 Current owner: ${currentOwner}`);

    if (currentOwner.toLowerCase() !== user1.address.toLowerCase()) {
      throw new Error(`Ownership verification failed. Expected ${user1.address}, got ${currentOwner}`);
    }
    console.log(`   ✅ Verified: User1 owns deed ${deedId}`);

    // 3. Execute the transfer from User1 to User2
    console.log(`3️⃣ EXECUTING TRANSFER: User1 → User2...`);
    const ownershipAsUser1 = ownership.connect(user1);
    const transferPrice = ethers.parseEther("1.5");

    tx = await ownershipAsUser1.transferOwnershipDeed(
      deedId,
      user2.address, // Transfer TO User2
      transferPrice,
      1, // TransferType.SECONDARY_SALE
      `QmTransferOwnership${uniqueId}`
    );
    await tx.wait();
    testResults.transactions.ownershipTransfer = tx.hash;
    console.log(`   ✅ TRANSFER EXECUTED: ${tx.hash}`);

    // 4. Verify the transfer was successful
    console.log(`4️⃣ Verifying transfer completion...`);
    const newOwner = await ownership.ownerOf(deedId);
    console.log(`   📋 New owner: ${newOwner}`);

    if (newOwner.toLowerCase() !== user2.address.toLowerCase()) {
      throw new Error(`Transfer verification failed. Expected ${user2.address}, got ${newOwner}`);
    }

    console.log("\n🎉 OWNERSHIP TRANSFER COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log(`📦 Deed ID: ${deedId}`);
    console.log(`🏷️ Passport ID: ${uniquePassportId}`);
    console.log(`💰 Transfer Price: ${ethers.formatEther(transferPrice)} MATIC`);
    console.log(`📈 Transfer Type: SECONDARY_SALE`);
    console.log();
    console.log("👥 OWNERSHIP CHAIN:");
    console.log(`   🔵 BEFORE: ${user1.address}`);
    console.log(`   🔄 TRANSFER EXECUTED`);
    console.log(`   🟢 AFTER:  ${user2.address}`);

    console.log("\n🔗 ALL TRANSACTION HASHES:");
    Object.entries(testResults.transactions).forEach(([key, hash]) => {
      console.log(`   ${key}: ${hash}`);
    });

    // Save results
    const reportFile = `complete-ownership-transfer-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Complete report: ${reportFile}`);

    console.log("\n✅ COMPLETE OWNERSHIP TRANSFER TEST SUCCESSFUL!");
    console.log("🎯 Demonstrated full product ownership lifecycle:");
    console.log("   1. Initial ownership deed creation");
    console.log("   2. Ownership verification");
    console.log("   3. Complete ownership transfer");
    console.log("   4. Transfer verification");

    return testResults;

  } catch (error) {
    console.error("❌ Complete ownership transfer test failed:", error);

    testResults.error = error.message;
    testResults.errorStack = error.stack;
    const failureFile = `ownership-transfer-failure-${Date.now()}.json`;
    fs.writeFileSync(failureFile, JSON.stringify(testResults, null, 2));

    throw error;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };