#!/usr/bin/env node

const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 TESTING SECURE CONTRACTS DEPLOYMENT");
  console.log("=".repeat(60));
  console.log(`⏰ Started: ${new Date().toISOString()}`);

  const [deployer] = await ethers.getSigners();
  console.log("📍 Tester:", deployer.address);

  const secureAddresses = {
    minimalForwarderSecure: "0x197267Cdcd1032710B27EcaddE2f82814cEE23CD",
    mainSecure: "0x1D4D7590d9a448533316730C567A8Ec43710C5ae",
    productPassportSecure: "0x16C75E6E43c621a38DE358d37146e1146d9fBFaC",
    provenanceSecure: "0xcc5A04641E4c76CF6e67c68E6BcF759De6C0Fc11",
    ownershipSecure: "0xCceCE9Ddd070a0cADa8Db549601E6E3437969abD"
  };

  const testResults = {
    contracts: {},
    overall: true
  };

  try {
    // Test 1: MinimalForwarderSecure
    console.log("\n🔒 Testing MinimalForwarderSecure...");
    const forwarderSecure = await ethers.getContractAt("MinimalForwarderSecure", secureAddresses.minimalForwarderSecure);

    try {
      const nonce = await forwarderSecure.getNonce(deployer.address);
      console.log(`✅ MinimalForwarderSecure - Nonce for ${deployer.address}: ${nonce}`);
      testResults.contracts.minimalForwarderSecure = true;
    } catch (error) {
      console.log(`❌ MinimalForwarderSecure test failed: ${error.message}`);
      testResults.contracts.minimalForwarderSecure = false;
      testResults.overall = false;
    }

    // Test 2: TrataTechMainUpgradeableSecure
    console.log("\n📱 Testing TrataTechMainUpgradeableSecure...");
    const mainSecure = await ethers.getContractAt("TrataTechMainUpgradeableSecure", secureAddresses.mainSecure);

    try {
      const owner = await mainSecure.owner();
      const paused = await mainSecure.paused();
      console.log(`✅ TrataTechMainUpgradeableSecure - Owner: ${owner}, Paused: ${paused}`);
      testResults.contracts.mainSecure = true;
    } catch (error) {
      console.log(`❌ TrataTechMainUpgradeableSecure test failed: ${error.message}`);
      testResults.contracts.mainSecure = false;
      testResults.overall = false;
    }

    // Test 3: TrataTechProductPassportUpgradeableSecure
    console.log("\n📄 Testing TrataTechProductPassportUpgradeableSecure...");
    const productPassportSecure = await ethers.getContractAt("TrataTechProductPassportUpgradeableSecure", secureAddresses.productPassportSecure);

    try {
      const owner = await productPassportSecure.owner();
      const paused = await productPassportSecure.paused();
      console.log(`✅ TrataTechProductPassportUpgradeableSecure - Owner: ${owner}, Paused: ${paused}`);
      testResults.contracts.productPassportSecure = true;
    } catch (error) {
      console.log(`❌ TrataTechProductPassportUpgradeableSecure test failed: ${error.message}`);
      testResults.contracts.productPassportSecure = false;
      testResults.overall = false;
    }

    // Test 4: TrataTechProvenanceUpgradeableSecure
    console.log("\n📋 Testing TrataTechProvenanceUpgradeableSecure...");
    const provenanceSecure = await ethers.getContractAt("TrataTechProvenanceUpgradeableSecure", secureAddresses.provenanceSecure);

    try {
      const owner = await provenanceSecure.owner();
      const paused = await provenanceSecure.paused();
      console.log(`✅ TrataTechProvenanceUpgradeableSecure - Owner: ${owner}, Paused: ${paused}`);
      testResults.contracts.provenanceSecure = true;
    } catch (error) {
      console.log(`❌ TrataTechProvenanceUpgradeableSecure test failed: ${error.message}`);
      testResults.contracts.provenanceSecure = false;
      testResults.overall = false;
    }

    // Test 5: TrataTechOwnershipRegistryUpgradeableSecure
    console.log("\n🏠 Testing TrataTechOwnershipRegistryUpgradeableSecure...");
    const ownershipSecure = await ethers.getContractAt("TrataTechOwnershipRegistryUpgradeableSecure", secureAddresses.ownershipSecure);

    try {
      const owner = await ownershipSecure.owner();
      const paused = await ownershipSecure.paused();
      console.log(`✅ TrataTechOwnershipRegistryUpgradeableSecure - Owner: ${owner}, Paused: ${paused}`);
      testResults.contracts.ownershipSecure = true;
    } catch (error) {
      console.log(`❌ TrataTechOwnershipRegistryUpgradeableSecure test failed: ${error.message}`);
      testResults.contracts.ownershipSecure = false;
      testResults.overall = false;
    }

    // Summary
    console.log("\n📊 SECURE CONTRACTS TEST SUMMARY");
    console.log("=".repeat(60));
    console.log("Contract Test Results:");
    Object.entries(testResults.contracts).forEach(([name, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${name}: ${passed ? 'PASSED' : 'FAILED'}`);
    });

    const passedCount = Object.values(testResults.contracts).filter(Boolean).length;
    const totalCount = Object.keys(testResults.contracts).length;

    console.log(`\n🎯 Overall: ${passedCount}/${totalCount} contracts passed`);

    if (testResults.overall) {
      console.log('🎉 All secure contracts are working correctly!');
      console.log('✅ Ready for API testing with Postman collection');
    } else {
      console.log('⚠️  Some contracts failed tests. Check the logs above for details.');
    }

    console.log("\n🔗 Next Steps:");
    console.log("1. Import the Postman collection: TrataTech_Secure_Contracts_API_Collection.postman_collection.json");
    console.log("2. Import the environment file: TrataTech_Secure_Contracts_Environment.postman_environment.json");
    console.log("3. Start your API server: npm start or node server.js");
    console.log("4. Run the comprehensive API tests");

    return testResults;

  } catch (error) {
    console.error("❌ Secure contracts test failed:", error);
    testResults.overall = false;
    testResults.error = error.message;
    return testResults;
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };