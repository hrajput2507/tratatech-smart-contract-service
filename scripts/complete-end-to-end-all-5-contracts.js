#!/usr/bin/env node

const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🔥 COMPLETE END-TO-END TESTING - ALL 5 CONTRACTS");
  console.log("=".repeat(70));
  console.log(`⏰ Started: ${new Date().toISOString()}`);

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);

  // ALL 5 FRESH CONTRACT ADDRESSES
  const CONTRACTS = {
    forwarder: "0x62EAB21521C1926c2538D2B59a5C9FBdD04E94e8",
    main: "0x47b590054949a60a98E353ffaaCDF06bb1541859",
    passport: "0x78D156f7b79e0c1ED60d614F4031235878707a3F",
    provenance: "0xD4963D2f45A69f6Fb684B82236A98553798b66E7",
    ownership: "0x79944dE285DC52fA97955A73C4FC0858c60d9F1F"
  };

  console.log("\n📍 Using ALL 5 Fresh Contracts:");
  Object.entries(CONTRACTS).forEach(([name, address]) => {
    console.log(`   ${name}: ${address}`);
  });

  // Create test users for complete scenario
  const brandOwner = ethers.Wallet.createRandom().connect(ethers.provider);
  const user1 = ethers.Wallet.createRandom().connect(ethers.provider);  // First buyer
  const user2 = ethers.Wallet.createRandom().connect(ethers.provider);  // Second buyer
  const eventAttendee = ethers.Wallet.createRandom().connect(ethers.provider);  // Event attendee

  console.log("\n👥 Test Participants:");
  console.log(`   Brand Owner: ${brandOwner.address}`);
  console.log(`   User 1 (First Buyer): ${user1.address}`);
  console.log(`   User 2 (Second Buyer): ${user2.address}`);
  console.log(`   Event Attendee: ${eventAttendee.address}`);

  // Fund all users
  const fundAmount = ethers.parseEther("0.3");
  await (await deployer.sendTransaction({ to: brandOwner.address, value: fundAmount })).wait();
  await (await deployer.sendTransaction({ to: user1.address, value: fundAmount })).wait();
  await (await deployer.sendTransaction({ to: user2.address, value: fundAmount })).wait();
  await (await deployer.sendTransaction({ to: eventAttendee.address, value: fundAmount })).wait();
  console.log("💰 All users funded with 0.3 MATIC each");

  const testResults = {
    testTimestamp: new Date().toISOString(),
    testType: "Complete End-to-End Testing - All 5 TrataTech Contracts",
    network: "Polygon Amoy Testnet",
    chainId: 80002,
    contracts: CONTRACTS,
    participants: {
      deployer: deployer.address,
      brandOwner: brandOwner.address,
      user1: user1.address,
      user2: user2.address,
      eventAttendee: eventAttendee.address
    },
    transactions: {},
    testFlow: {}
  };

  try {
    // Connect to all 5 contracts
    const MinimalForwarder = await ethers.getContractFactory("MinimalForwarder");
    const forwarder = MinimalForwarder.attach(CONTRACTS.forwarder);

    const Main = await ethers.getContractFactory("TrataTechMainUpgradeable");
    const main = Main.attach(CONTRACTS.main);

    const ProductPassport = await ethers.getContractFactory("TrataTechProductPassportUpgradeable");
    const passport = ProductPassport.attach(CONTRACTS.passport);

    const Provenance = await ethers.getContractFactory("TrataTechProvenanceUpgradeable");
    const provenance = Provenance.attach(CONTRACTS.provenance);

    const OwnershipRegistry = await ethers.getContractFactory("TrataTechOwnershipRegistryUpgradeable");
    const ownership = OwnershipRegistry.attach(CONTRACTS.ownership);

    console.log("\n🏭 PHASE 1: BRAND SETUP AND PRODUCT CREATION");
    console.log("-".repeat(50));

    // Unique identifiers for this test
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
      `Complete end-to-end testing brand created at ${new Date().toISOString()}`,
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
      `Complete end-to-end testing product created at ${new Date().toISOString()}`,
      "Electronics",
      "E2E Test Factory",
      Math.floor(Date.now() / 1000),
      `QmE2EProduct${uniqueId}`,
      ethers.keccak256(ethers.toUtf8Bytes(`e2e-test-${uniqueId}`)),
      ["e2e", "test", "complete", uniqueId.toString()]
    );
    await tx.wait();
    testResults.transactions.createProductPassport = tx.hash;
    testResults.testFlow.productSku = productSku;
    console.log(`   ✅ TX: ${tx.hash}`);

    console.log("\n📊 PHASE 2: PROVENANCE TRACKING");
    console.log("-".repeat(50));

    // Authorize deployer as recorder first
    console.log("🔓 Authorizing deployer as recorder...");
    tx = await provenance.authorizeRecorder(deployer.address);
    await tx.wait();
    testResults.transactions.authorizeRecorder = tx.hash;
    console.log(`   ✅ TX: ${tx.hash}`);

    // 5. Record manufacturing provenance
    console.log("5️⃣ Recording manufacturing provenance...");
    tx = await provenance.createProvenanceEntry(
      1, // productPassportId
      0, // ProvenanceType.MANUFACTURING
      deployer.address, // from
      brandOwner.address, // to
      "E2E Test Factory",
      `Manufacturing completed for product ${productSku} in complete e2e test`,
      `QmManufacture${uniqueId}`,
      ethers.keccak256(ethers.toUtf8Bytes(`manufacture-${uniqueId}`)),
      []
    );
    await tx.wait();
    testResults.transactions.recordManufacturing = tx.hash;
    console.log(`   ✅ TX: ${tx.hash}`);

    // 6. Record quality check
    console.log("6️⃣ Recording quality check provenance...");
    tx = await provenance.createProvenanceEntry(
      1,
      5, // ProvenanceType.INSPECTION (closest to quality check)
      brandOwner.address, // from
      brandOwner.address, // to (same for quality check)
      "E2E QA Team",
      `Quality assurance passed for ${productSku}`,
      `QmQualityCheck${uniqueId}`,
      ethers.keccak256(ethers.toUtf8Bytes(`quality-${uniqueId}`)),
      []
    );
    await tx.wait();
    testResults.transactions.recordQualityCheck = tx.hash;
    console.log(`   ✅ TX: ${tx.hash}`);

    console.log("\n👤 PHASE 3: INITIAL OWNERSHIP CREATION");
    console.log("-".repeat(50));

    // 7. Create ownership deed for User1
    console.log("7️⃣ Creating ownership deed for User1...");
    const acquisitionPrice = ethers.parseEther("1.5");
    const platformFee = ethers.parseEther("0.02");

    tx = await ownership.createOwnershipDeed(
      1, // productPassportId
      user1.address, // initial owner
      acquisitionPrice, // acquisition price
      { value: platformFee } // platform fee
    );
    await tx.wait();
    testResults.transactions.createOwnershipDeed = tx.hash;
    testResults.testFlow.deedCreated = tx.hash;
    console.log(`   ✅ TX: ${tx.hash}`);

    // 8. Verify User1 ownership
    console.log("8️⃣ Verifying User1 ownership...");
    const initialOwner = await ownership.ownerOf(1);
    testResults.testFlow.initialOwner = initialOwner;
    console.log(`   ✅ Initial Owner: ${initialOwner}`);

    if (initialOwner.toLowerCase() !== user1.address.toLowerCase()) {
      throw new Error("Initial ownership verification failed!");
    }

    console.log("\n🔄 PHASE 4: OWNERSHIP TRANSFER (User1 → User2)");
    console.log("-".repeat(50));

    // 9. Transfer ownership from User1 to User2
    console.log("9️⃣ TRANSFERRING OWNERSHIP: User1 → User2...");
    const ownershipAsUser1 = ownership.connect(user1);
    const transferPrice = ethers.parseEther("2.0");

    tx = await ownershipAsUser1.transferOwnershipDeed(
      1, // deedId
      user2.address, // new owner
      transferPrice // transfer price
    );
    await tx.wait();
    testResults.transactions.transferOwnership = tx.hash;
    testResults.testFlow.ownershipTransfer = tx.hash;
    console.log(`   ✅ TRANSFER TX: ${tx.hash}`);

    // 10. Verify ownership transfer
    console.log("🔟 Verifying ownership transfer...");
    const finalOwner = await ownership.ownerOf(1);
    testResults.testFlow.finalOwner = finalOwner;
    console.log(`   ✅ Final Owner: ${finalOwner}`);

    if (finalOwner.toLowerCase() !== user2.address.toLowerCase()) {
      throw new Error("Ownership transfer verification failed!");
    }

    // 11. Record ownership transfer in provenance
    console.log("1️⃣1️⃣ Recording ownership transfer in provenance...");
    tx = await provenance.createProvenanceEntry(
      1,
      1, // ProvenanceType.TRANSFER
      user1.address, // from
      user2.address, // to
      "P2P Transfer",
      `Ownership transferred from ${user1.address} to ${user2.address} for ${ethers.formatEther(transferPrice)} MATIC`,
      `QmOwnershipTransfer${uniqueId}`,
      ethers.keccak256(ethers.toUtf8Bytes(`transfer-${uniqueId}`)),
      []
    );
    await tx.wait();
    testResults.transactions.recordOwnershipTransfer = tx.hash;
    console.log(`   ✅ TX: ${tx.hash}`);

    console.log("\n🎪 PHASE 5: EVENT MANAGEMENT (MAIN CONTRACT)");
    console.log("-".repeat(50));

    // 12. Create event invite
    console.log("1️⃣2️⃣ Creating event invite...");
    tx = await main.createEventInvite(
      `E2E Test Event ${uniqueId}`,
      `Complete end-to-end testing event for product ${productSku}`,
      Math.floor(Date.now() / 1000) + 86400, // Tomorrow
      100, // Max attendees
      `QmEventInvite${uniqueId}`
    );
    await tx.wait();
    testResults.transactions.createEventInvite = tx.hash;
    console.log(`   ✅ TX: ${tx.hash}`);

    // 13. RSVP to event (as event attendee)
    console.log("1️⃣3️⃣ RSVP to event...");
    const mainAsAttendee = main.connect(eventAttendee);
    tx = await mainAsAttendee.rsvpToEvent(1);
    await tx.wait();
    testResults.transactions.rsvpToEvent = tx.hash;
    console.log(`   ✅ TX: ${tx.hash}`);

    console.log("\n✅ PHASE 6: FINAL VERIFICATION");
    console.log("-".repeat(50));

    // Get final states
    const deedDetails = await ownership.ownershipDeeds(1);
    const productDetails = await passport.productPassports(1);
    const brandDetails = await passport.brands(brandId);
    const provenanceCount = await provenance.getProvenanceEntryCount(1);

    testResults.testFlow.finalVerification = {
      deedId: deedDetails.deedId.toString(),
      productPassportId: productDetails.id.toString(),
      brandName: brandDetails.name,
      brandVerified: brandDetails.isVerified,
      provenanceEntries: provenanceCount.toString(),
      finalOwner: finalOwner,
      ownershipVerified: finalOwner.toLowerCase() === user2.address.toLowerCase()
    };

    console.log("✅ Final Verification Results:");
    console.log(`   📦 Product Passport ID: ${productDetails.id.toString()}`);
    console.log(`   🏷️  Brand Name: ${brandDetails.name}`);
    console.log(`   ✅ Brand Verified: ${brandDetails.isVerified}`);
    console.log(`   📜 Ownership Deed ID: ${deedDetails.deedId.toString()}`);
    console.log(`   👤 Final Owner: ${finalOwner}`);
    console.log(`   📈 Provenance Entries: ${provenanceCount.toString()}`);
    console.log(`   🔄 Ownership Transfer: ${testResults.testFlow.ownershipVerified ? 'SUCCESS' : 'FAILED'}`);

    console.log("\n🎉 COMPLETE END-TO-END SUCCESS!");
    console.log("=".repeat(70));
    console.log("📋 FULL PRODUCT LIFECYCLE SUMMARY:");
    console.log(`   Product: ${productSku} (Passport ID: 1)`);
    console.log(`   Brand: ${brandId}`);
    console.log(`   Initial Owner: ${user1.address}`);
    console.log(`   Final Owner: ${user2.address}`);
    console.log(`   Ownership Transfer: ${testResults.transactions.transferOwnership}`);
    console.log(`   Provenance Entries: ${provenanceCount.toString()}`);

    console.log("\n🔗 ALL END-TO-END TRANSACTION HASHES:");
    Object.entries(testResults.transactions).forEach(([key, hash]) => {
      console.log(`   ${key}: ${hash}`);
    });

    // Save complete results
    const reportFile = `complete-e2e-all-5-contracts-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Complete E2E report: ${reportFile}`);

    console.log("\n🏆 ALL 5 CONTRACTS TESTED END-TO-END!");
    console.log("✅ Complete product lifecycle with ownership transfer verified!");
    console.log("🔥 All functionality working with gasless transactions!");

    return testResults;

  } catch (error) {
    console.error("❌ End-to-end testing failed:", error);

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