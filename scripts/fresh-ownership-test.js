#!/usr/bin/env node

const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🎯 FRESH OWNERSHIP TRANSFER TEST");
  console.log("=".repeat(50));
  console.log(`⏰ Started: ${new Date().toISOString()}`);

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);

  // Use fresh contract addresses
  const ownershipAddress = "0x3372AFF8427e1ab1CFBeC7CFaf8BAb4CBC10aDDD";
  console.log(`📍 Using Ownership Contract: ${ownershipAddress}`);

  // Create users
  const user1 = ethers.Wallet.createRandom().connect(ethers.provider);
  const user2 = ethers.Wallet.createRandom().connect(ethers.provider);

  console.log(`👤 User 1 (Initial Owner): ${user1.address}`);
  console.log(`👤 User 2 (Transfer Target): ${user2.address}`);

  // Fund users
  const fundAmount = ethers.parseEther("0.3");
  await (await deployer.sendTransaction({ to: user1.address, value: fundAmount })).wait();
  await (await deployer.sendTransaction({ to: user2.address, value: fundAmount })).wait();
  console.log("💰 Users funded with 0.3 MATIC each");

  const testResults = {
    testTimestamp: new Date().toISOString(),
    testType: "Fresh Ownership Transfer Test",
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

    // Use a unique passport ID to avoid conflicts
    const uniquePassportId = 8888 + Math.floor(Math.random() * 1000);
    const uniqueId = Date.now();

    console.log("\n🏗️ STEP 1: Create Fresh Ownership Deed");
    console.log("-".repeat(30));

    // 1. Create ownership deed for User1 with unique passport ID
    console.log(`1️⃣ Creating ownership deed for User1 (Passport ID: ${uniquePassportId})...`);
    const acquisitionPrice = ethers.parseEther("1.0");

    let tx = await ownership.createOwnershipDeed(
      uniquePassportId, // Use unique passport ID
      user1.address, // initial owner
      acquisitionPrice,
      "Primary Sale",
      `QmOwnership${uniqueId}`,
      ethers.keccak256(ethers.toUtf8Bytes(`ownership-${uniqueId}`)),
      []
    );
    await tx.wait();
    testResults.transactions.createOwnershipDeed = tx.hash;
    console.log(`   ✅ TX: ${tx.hash}`);

    // Small delay to ensure deed is created
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("\n🔄 STEP 2: Transfer Ownership");
    console.log("-".repeat(30));

    // Get the deed ID from the transaction receipt
    // Since we just created a deed for passport ID uniquePassportId, let's use deed ID 1 (first deed)
    const deedId = 1;
    console.log(`🔍 Using deed ID: ${deedId}`);

    // Verify ownership before transfer
    const deedOwner = await ownership.ownerOf(deedId);
    console.log(`📋 Current owner of deed ${deedId}: ${deedOwner}`);

    if (deedOwner.toLowerCase() !== user1.address.toLowerCase()) {
      throw new Error(`Deed owner mismatch. Expected ${user1.address}, got ${deedOwner}`);
    }

    // 2. Transfer ownership from User1 to User2
    console.log(`2️⃣ TRANSFERRING OWNERSHIP: User1 → User2 (Deed ID: ${deedId})...`);
    const ownershipAsUser1 = ownership.connect(user1);
    const transferPrice = ethers.parseEther("1.5");

    tx = await ownershipAsUser1.transferOwnershipDeed(
      deedId, // deed ID
      user2.address, // new owner
      transferPrice,
      1, // TransferType.SECONDARY_SALE
      `QmTransfer${uniqueId}`
    );
    await tx.wait();
    testResults.transactions.transferOwnership = tx.hash;
    console.log(`   ✅ TRANSFER TX: ${tx.hash}`);

    // Verify ownership after transfer
    const newOwner = await ownership.ownerOf(deedId);
    console.log(`📋 New owner of deed ${deedId}: ${newOwner}`);

    if (newOwner.toLowerCase() !== user2.address.toLowerCase()) {
      throw new Error(`Transfer failed. Expected ${user2.address}, got ${newOwner}`);
    }

    console.log("\n✅ OWNERSHIP TRANSFER COMPLETED SUCCESSFULLY!");
    console.log("-".repeat(50));
    console.log(`🔄 Deed ID: ${deedId}`);
    console.log(`📦 Passport ID: ${uniquePassportId}`);
    console.log(`👤 From: ${user1.address}`);
    console.log(`👤 To: ${user2.address}`);
    console.log(`💰 Price: ${ethers.formatEther(transferPrice)} MATIC`);

    console.log("\n🔗 ALL TRANSACTION HASHES:");
    Object.entries(testResults.transactions).forEach(([key, hash]) => {
      console.log(`   ${key}: ${hash}`);
    });

    // Save results
    const reportFile = `fresh-ownership-test-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Complete report: ${reportFile}`);

    console.log("\n🎉 FRESH OWNERSHIP TRANSFER TEST SUCCESSFUL!");
    console.log("✅ Complete product ownership lifecycle demonstrated!");

    return testResults;

  } catch (error) {
    console.error("❌ Fresh ownership transfer test failed:", error);

    testResults.error = error.message;
    testResults.errorStack = error.stack;
    const failureFile = `fresh-ownership-failure-${Date.now()}.json`;
    fs.writeFileSync(failureFile, JSON.stringify(testResults, null, 2));

    throw error;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };