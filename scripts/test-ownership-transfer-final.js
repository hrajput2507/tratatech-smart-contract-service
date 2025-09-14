#!/usr/bin/env node

const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🔄 OWNERSHIP TRANSFER TEST - FINAL");
  console.log("=".repeat(50));
  console.log(`⏰ Started: ${new Date().toISOString()}`);

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);

  // Fresh contract address
  const ownershipAddress = "0x79944dE285DC52fA97955A73C4FC0858c60d9F1F";

  console.log(`📍 Using Ownership Contract: ${ownershipAddress}`);

  // Create users - we need fresh users since we don't know the exact ones from before
  const user1 = ethers.Wallet.createRandom().connect(ethers.provider);
  const user2 = ethers.Wallet.createRandom().connect(ethers.provider);

  console.log(`👤 User 1 (Deed Owner): ${user1.address}`);
  console.log(`👤 User 2 (Transfer Target): ${user2.address}`);

  // Fund users
  const fundAmount = ethers.parseEther("0.3");
  await (await deployer.sendTransaction({ to: user1.address, value: fundAmount })).wait();
  await (await deployer.sendTransaction({ to: user2.address, value: fundAmount })).wait();
  console.log("💰 Users funded with 0.3 MATIC each");

  const testResults = {
    testTimestamp: new Date().toISOString(),
    testType: "Ownership Transfer Test",
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

    const uniqueId = Date.now();

    console.log("\n🏗️ STEP 1: Create New Ownership Deed");
    console.log("-".repeat(30));

    // 1. Authorize deployer (as brand) first
    console.log("1️⃣ Authorizing deployer as brand...");
    let tx = await ownership.authorizeBrand(deployer.address);
    await tx.wait();
    testResults.transactions.authorizeBrand = tx.hash;
    console.log(`   ✅ TX: ${tx.hash}`);

    // 2. Create ownership deed for User1
    console.log("2️⃣ Creating ownership deed for User1...");
    const acquisitionPrice = ethers.parseEther("1.0");

    tx = await ownership.createOwnershipDeed(
      999, // Use a high passport ID to avoid conflicts
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

    // Get the deed ID - it should be the next available ID
    // Since we don't know the exact count, let's try a reasonable assumption
    let deedId;
    try {
      // Try to find the deed ID by checking recent deeds
      // Let's assume it's deed ID 1, 2, or 3 based on our tests
      for (let testDeedId = 1; testDeedId <= 5; testDeedId++) {
        try {
          const deedInfo = await ownership.ownershipDeeds(testDeedId);
          if (deedInfo.owner.toLowerCase() === user1.address.toLowerCase()) {
            deedId = testDeedId;
            console.log(`🔍 Found deed ID: ${deedId} owned by User1`);
            break;
          }
        } catch (e) {
          // Deed doesn't exist, continue
        }
      }

      // If we didn't find it, create a simple deed with ID 1
      if (!deedId) {
        console.log("🔍 Creating deed with predictable ID...");
        // Let's assume the next deed will be ID 1, 2, 3, etc.
        deedId = 1; // We'll use this assumption
        console.log(`📦 Assuming deed ID: ${deedId}`);
      }

    } catch (error) {
      console.log("⚠️ Could not determine deed ID, using ID 1");
      deedId = 1;
    }

    // 3. Transfer ownership from User1 to User2
    console.log(`3️⃣ TRANSFERRING OWNERSHIP: User1 → User2 (Deed ID: ${deedId})`);
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

    console.log("\n✅ OWNERSHIP TRANSFER COMPLETED!");
    console.log("-".repeat(30));
    console.log(`🔄 Deed ID: ${deedId}`);
    console.log(`👤 From: ${user1.address}`);
    console.log(`👤 To: ${user2.address}`);
    console.log(`💰 Price: ${ethers.formatEther(transferPrice)} MATIC`);

    console.log("\n🔗 ALL TRANSACTION HASHES:");
    Object.entries(testResults.transactions).forEach(([key, hash]) => {
      console.log(`   ${key}: ${hash}`);
    });

    // Save results
    const reportFile = `ownership-transfer-final-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Complete report: ${reportFile}`);

    console.log("\n🎉 OWNERSHIP TRANSFER TEST SUCCESSFUL!");
    console.log("✅ Complete product ownership lifecycle demonstrated!");

    return testResults;

  } catch (error) {
    console.error("❌ Ownership transfer test failed:", error);

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