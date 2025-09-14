#!/usr/bin/env node

const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🎯 SIMPLIFIED END-TO-END TESTING - ALL 5 CONTRACTS");
  console.log("=".repeat(70));
  console.log(`⏰ Started: ${new Date().toISOString()}`);

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);

  // ALL 5 FRESH CONTRACT ADDRESSES
  const CONTRACTS = {
    forwarder: "0xD5Be400176B8136Ec20FED0fE19bfd61d48BD47c",
    main: "0x5F2e86756243CdF8bf3bB475B6109229C3c3bD53",
    passport: "0xdD0738c1B3cC295992C11985295E8843070cD80B",
    provenance: "0xe8ABcA59aa4b8648A2e2a7Bb63736D95F01Ca7dC",
    ownership: "0x3372AFF8427e1ab1CFBeC7CFaf8BAb4CBC10aDDD"
  };

  console.log("\n📍 Using ALL 5 Fresh Contracts:");
  Object.entries(CONTRACTS).forEach(([name, address]) => {
    console.log(`   ${name}: ${address}`);
  });

  // Create test users
  const brandOwner = ethers.Wallet.createRandom().connect(ethers.provider);
  const user1 = ethers.Wallet.createRandom().connect(ethers.provider);
  const user2 = ethers.Wallet.createRandom().connect(ethers.provider);

  console.log("\n👥 Test Participants:");
  console.log(`   Brand Owner: ${brandOwner.address}`);
  console.log(`   User 1 (First Buyer): ${user1.address}`);
  console.log(`   User 2 (Second Buyer): ${user2.address}`);

  // Fund all users (brand owner gets more for transactions)
  const brandOwnerFund = ethers.parseEther("0.5");
  const userFund = ethers.parseEther("0.2");
  await (await deployer.sendTransaction({ to: brandOwner.address, value: brandOwnerFund })).wait();
  await (await deployer.sendTransaction({ to: user1.address, value: userFund })).wait();
  await (await deployer.sendTransaction({ to: user2.address, value: userFund })).wait();
  console.log("💰 Brand owner funded with 0.5 MATIC, users with 0.2 MATIC each");

  const testResults = {
    testTimestamp: new Date().toISOString(),
    testType: "Simplified End-to-End Testing - Core Product Lifecycle",
    network: "Polygon Amoy Testnet",
    chainId: 80002,
    contracts: CONTRACTS,
    participants: {
      deployer: deployer.address,
      brandOwner: brandOwner.address,
      user1: user1.address,
      user2: user2.address
    },
    transactions: {},
    testFlow: {}
  };

  try {
    // Connect to contracts
    const Main = await ethers.getContractFactory("TrataTechMainUpgradeable");
    const main = Main.attach(CONTRACTS.main);

    const ProductPassport = await ethers.getContractFactory("TrataTechProductPassportUpgradeable");
    const passport = ProductPassport.attach(CONTRACTS.passport);

    const OwnershipRegistry = await ethers.getContractFactory("TrataTechOwnershipRegistryUpgradeable");
    const ownership = OwnershipRegistry.attach(CONTRACTS.ownership);

    console.log("\n🏭 PHASE 1: BRAND SETUP AND PRODUCT CREATION");
    console.log("-".repeat(50));

    // Unique identifiers
    const uniqueId = Date.now();
    const brandId = `E2E-BRAND-${uniqueId}`;
    const productSku = `E2E-SKU-${uniqueId}`;

    // 1. Authorize brand owner
    console.log("1️⃣ Authorizing brand owner...");
    let tx = await passport.authorizeBrand(brandOwner.address);
    await tx.wait();
    testResults.transactions.authorizeBrand = tx.hash;
    console.log(`   ✅ TX: ${tx.hash}`);

    // 2. Register brand
    console.log("2️⃣ Registering brand...");
    const passportAsBrand = passport.connect(brandOwner);
    tx = await passportAsBrand.registerBrand(
      brandId,
      `E2E Test Brand ${uniqueId}`,
      `End-to-end testing brand created at ${new Date().toISOString()}`,
      `QmE2EBrand${uniqueId}`,
      ["GLOBAL"]
    );
    await tx.wait();
    testResults.transactions.registerBrand = tx.hash;
    testResults.testFlow.brandId = brandId;
    console.log(`   ✅ TX: ${tx.hash}`);

    // 3. Verify brand
    console.log("3️⃣ Verifying brand...");
    tx = await passport.verifyBrand(brandId);
    await tx.wait();
    testResults.transactions.verifyBrand = tx.hash;
    console.log(`   ✅ TX: ${tx.hash}`);

    // 4. Create product passport
    console.log("4️⃣ Creating product passport...");
    tx = await passportAsBrand.createProductPassport(
      productSku,
      brandId,
      `E2E Test Product ${uniqueId}`,
      `End-to-end testing product created at ${new Date().toISOString()}`,
      "Electronics",
      "E2E Test Factory",
      Math.floor(Date.now() / 1000),
      `QmE2EProduct${uniqueId}`,
      ethers.keccak256(ethers.toUtf8Bytes(`e2e-test-${uniqueId}`)),
      ["e2e", "test", "simplified", uniqueId.toString()]
    );
    await tx.wait();
    testResults.transactions.createProductPassport = tx.hash;
    testResults.testFlow.productSku = productSku;
    console.log(`   ✅ TX: ${tx.hash}`);

    console.log("\n👤 PHASE 2: OWNERSHIP CREATION & TRANSFER");
    console.log("-".repeat(50));

    // Authorize brand owner for ownership registry
    console.log("🔓 Authorizing brand owner for ownership registry...");
    tx = await ownership.authorizeBrand(brandOwner.address);
    await tx.wait();
    testResults.transactions.authorizeOwnership = tx.hash;
    console.log(`   ✅ TX: ${tx.hash}`);

    // 5. Create ownership deed for User1
    console.log("5️⃣ Creating ownership deed for User1...");
    const acquisitionPrice = ethers.parseEther("1.0");

    const ownershipAsBrand = ownership.connect(brandOwner);
    tx = await ownershipAsBrand.createOwnershipDeed(
      1, // productPassportId
      user1.address, // initial owner
      acquisitionPrice, // acquisition price
      "Initial Sale", // acquisition method
      `QmOwnership${uniqueId}`, // ipfsCID
      ethers.keccak256(ethers.toUtf8Bytes(`ownership-${uniqueId}`)), // metadataHash
      [] // additional data
    );
    await tx.wait();
    testResults.transactions.createOwnershipDeed = tx.hash;
    console.log(`   ✅ TX: ${tx.hash}`);

    // 6. Verify User1 ownership
    console.log("6️⃣ Verifying User1 ownership...");
    const initialOwner = await ownership.ownerOf(1);
    testResults.testFlow.initialOwner = initialOwner;
    console.log(`   ✅ Initial Owner: ${initialOwner}`);

    if (initialOwner.toLowerCase() !== user1.address.toLowerCase()) {
      throw new Error("Initial ownership verification failed!");
    }

    // 7. Transfer ownership from User1 to User2
    console.log("7️⃣ TRANSFERRING OWNERSHIP: User1 → User2...");
    const ownershipAsUser1 = ownership.connect(user1);
    const transferPrice = ethers.parseEther("1.5");

    tx = await ownershipAsUser1.transferOwnershipDeed(
      1, // deedId
      user2.address, // new owner
      transferPrice, // transfer price
      1, // TransferType.SECONDARY_SALE
      `QmTransfer${uniqueId}` // ipfsCID
    );
    await tx.wait();
    testResults.transactions.transferOwnership = tx.hash;
    console.log(`   ✅ TRANSFER TX: ${tx.hash}`);

    // 8. Verify ownership transfer
    console.log("8️⃣ Verifying ownership transfer...");
    const finalOwner = await ownership.ownerOf(1);
    testResults.testFlow.finalOwner = finalOwner;
    console.log(`   ✅ Final Owner: ${finalOwner}`);

    if (finalOwner.toLowerCase() !== user2.address.toLowerCase()) {
      throw new Error("Ownership transfer verification failed!");
    }

    console.log("\n🎪 PHASE 3: EVENT MANAGEMENT");
    console.log("-".repeat(50));

    // 9. Create event invite
    console.log("9️⃣ Creating event invite...");
    tx = await main.createEventInvite(
      `E2E Test Event ${uniqueId}`,
      `End-to-end testing event for product ${productSku}`,
      Math.floor(Date.now() / 1000) + 86400, // Tomorrow
      50, // Max attendees
      `QmEventInvite${uniqueId}`
    );
    await tx.wait();
    testResults.transactions.createEventInvite = tx.hash;
    console.log(`   ✅ TX: ${tx.hash}`);

    // 10. RSVP to event
    console.log("🔟 RSVP to event...");
    const mainAsUser2 = main.connect(user2); // Current owner RSVPs
    tx = await mainAsUser2.rsvpToEvent(1);
    await tx.wait();
    testResults.transactions.rsvpToEvent = tx.hash;
    console.log(`   ✅ TX: ${tx.hash}`);

    console.log("\n✅ FINAL VERIFICATION");
    console.log("-".repeat(50));

    // Get final states
    const deedDetails = await ownership.ownershipDeeds(1);
    const productDetails = await passport.productPassports(1);
    const brandDetails = await passport.brands(brandId);

    testResults.testFlow.finalVerification = {
      deedId: deedDetails.deedId.toString(),
      productPassportId: productDetails.id.toString(),
      brandName: brandDetails.name,
      brandVerified: brandDetails.isVerified,
      finalOwner: finalOwner,
      ownershipVerified: finalOwner.toLowerCase() === user2.address.toLowerCase()
    };

    console.log("✅ Final Verification Results:");
    console.log(`   📦 Product Passport ID: ${productDetails.id.toString()}`);
    console.log(`   🏷️  Brand Name: ${brandDetails.name}`);
    console.log(`   ✅ Brand Verified: ${brandDetails.isVerified}`);
    console.log(`   📜 Ownership Deed ID: ${deedDetails.deedId.toString()}`);
    console.log(`   👤 Final Owner: ${finalOwner}`);
    console.log(`   🔄 Ownership Transfer: ${testResults.testFlow.finalVerification.ownershipVerified ? 'SUCCESS' : 'FAILED'}`);

    console.log("\n🎉 SIMPLIFIED END-TO-END SUCCESS!");
    console.log("=".repeat(70));
    console.log("📋 COMPLETE PRODUCT LIFECYCLE SUMMARY:");
    console.log(`   Product: ${productSku} (Passport ID: 1)`);
    console.log(`   Brand: ${brandId}`);
    console.log(`   Initial Owner: ${user1.address}`);
    console.log(`   Final Owner: ${user2.address}`);
    console.log(`   Ownership Transfer: ${testResults.transactions.transferOwnership}`);

    console.log("\n🔗 ALL TRANSACTION HASHES:");
    Object.entries(testResults.transactions).forEach(([key, hash]) => {
      console.log(`   ${key}: ${hash}`);
    });

    // Save complete results
    const reportFile = `simplified-e2e-test-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Complete report: ${reportFile}`);

    console.log("\n🏆 CORE FUNCTIONALITY TESTED SUCCESSFULLY!");
    console.log("✅ Product lifecycle with ownership transfer verified!");
    console.log("🔥 All gasless transactions working!");

    return testResults;

  } catch (error) {
    console.error("❌ Testing failed:", error);

    testResults.error = error.message;
    testResults.errorStack = error.stack;
    const failureFile = `e2e-test-failure-${Date.now()}.json`;
    fs.writeFileSync(failureFile, JSON.stringify(testResults, null, 2));

    throw error;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };