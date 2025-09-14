#!/usr/bin/env node

const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 COMPREHENSIVE CONTRACT TESTING WITH POSTMAN COLLECTION");
  console.log("=".repeat(70));
  console.log(`⏰ Started: ${new Date().toISOString()}`);

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} MATIC`);

  // Contract addresses from fresh deployment
  const contractAddresses = {
    forwarder: "0x32A9b73A5Aa8EB7282D726d1897a55Bd88A688c5",
    main: "0xB12550533aBADe4F7fd31b0a4481A3731Cfa4FE6",
    productPassport: "0x125CE8B8d34A85a05bd22a1865cdfC10307f7979",
    provenance: "0x4Fc6a8d28A6B60f85BC359691AdBEc0b441D4371",
    ownership: "0xe6ee071ADc22302C87AcbC4491d3e6b5F0e13C63"
  };

  // Test results storage
  const testResults = {
    network: "Polygon Amoy Testnet",
    chainId: 80002,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contractAddresses,
    transactions: {},
    functionTests: [],
    totalTransactions: 0,
    successfulTests: 0,
    failedTests: 0
  };

  // Create test users
  const user1 = ethers.Wallet.createRandom().connect(ethers.provider);
  const user2 = ethers.Wallet.createRandom().connect(ethers.provider);

  console.log(`👤 User 1: ${user1.address}`);
  console.log(`👤 User 2: ${user2.address}`);

  // Fund users
  console.log("\n💰 Funding test users...");
  const fundAmount = ethers.parseEther("0.2");
  await (await deployer.sendTransaction({ to: user1.address, value: fundAmount })).wait();
  await (await deployer.sendTransaction({ to: user2.address, value: fundAmount })).wait();
  console.log("✅ Users funded with 0.2 MATIC each");

  try {
    // Get contract instances
    const ProductPassport = await ethers.getContractFactory("TrataTechProductPassportUpgradeable");
    const productPassport = ProductPassport.attach(contractAddresses.productPassport);

    const Ownership = await ethers.getContractFactory("TrataTechOwnershipRegistryUpgradeable");
    const ownership = Ownership.attach(contractAddresses.ownership);

    const Provenance = await ethers.getContractFactory("TrataTechProvenanceUpgradeable");
    const provenance = Provenance.attach(contractAddresses.provenance);

    const Main = await ethers.getContractFactory("TrataTechMainUpgradeable");
    const main = Main.attach(contractAddresses.main);

    console.log("\n🏗️ PHASE 1: PRODUCT PASSPORT TESTING");
    console.log("-".repeat(50));

    // Test 1: Register Brand
    console.log("1️⃣ Testing registerBrand...");
    try {
      const brandData = {
        name: `Test Brand ${Date.now()}`,
        website: "https://test.com",
        description: "Test brand description",
        logo: "QmTestLogo",
        contactInfo: "test@test.com",
        authorizedCountries: ["US", "CA"]
      };

      const tx1 = await productPassport.registerBrand(
        brandData.name,
        brandData.website,
        brandData.description,
        brandData.logo,
        brandData.contactInfo,
        brandData.authorizedCountries,
        "QmBrandMetadata",
        ethers.keccak256(ethers.toUtf8Bytes("brand-hash")),
        []
      );
      await tx1.wait();

      testResults.transactions.registerBrand = tx1.hash;
      testResults.functionTests.push({
        function: "registerBrand",
        contract: "ProductPassport",
        status: "success",
        txHash: tx1.hash,
        gasUsed: (await tx1.wait()).gasUsed.toString()
      });
      testResults.successfulTests++;
      testResults.totalTransactions++;
      console.log(`   ✅ Success: ${tx1.hash}`);
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      testResults.functionTests.push({
        function: "registerBrand",
        contract: "ProductPassport",
        status: "failed",
        error: error.message
      });
      testResults.failedTests++;
    }

    // Test 2: Create Product Passport
    console.log("2️⃣ Testing createProductPassport...");
    try {
      const passportData = {
        brandId: 1,
        productName: `Test Product ${Date.now()}`,
        productDescription: "Test product description",
        serialNumber: `SN${Date.now()}`,
        manufacturingDate: Math.floor(Date.now() / 1000),
        expiryDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
      };

      const tx2 = await productPassport.createProductPassport(
        passportData.brandId,
        passportData.productName,
        passportData.productDescription,
        passportData.serialNumber,
        passportData.manufacturingDate,
        passportData.expiryDate,
        "QmPassportMetadata",
        ethers.keccak256(ethers.toUtf8Bytes("passport-hash")),
        []
      );
      await tx2.wait();

      testResults.transactions.createProductPassport = tx2.hash;
      testResults.functionTests.push({
        function: "createProductPassport",
        contract: "ProductPassport",
        status: "success",
        txHash: tx2.hash,
        gasUsed: (await tx2.wait()).gasUsed.toString()
      });
      testResults.successfulTests++;
      testResults.totalTransactions++;
      console.log(`   ✅ Success: ${tx2.hash}`);
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      testResults.functionTests.push({
        function: "createProductPassport",
        contract: "ProductPassport",
        status: "failed",
        error: error.message
      });
      testResults.failedTests++;
    }

    console.log("\n🏗️ PHASE 2: OWNERSHIP TESTING");
    console.log("-".repeat(50));

    // Test 3: Create Ownership Deed
    console.log("3️⃣ Testing createOwnershipDeed...");
    try {
      const uniquePassportId = 1001 + Math.floor(Math.random() * 1000);

      const tx3 = await ownership.createOwnershipDeed(
        uniquePassportId,
        user1.address,
        ethers.parseEther("1.0"),
        "Primary Sale",
        "QmOwnershipMetadata",
        ethers.keccak256(ethers.toUtf8Bytes("ownership-hash")),
        []
      );
      await tx3.wait();

      testResults.transactions.createOwnershipDeed = tx3.hash;
      testResults.functionTests.push({
        function: "createOwnershipDeed",
        contract: "Ownership",
        status: "success",
        txHash: tx3.hash,
        gasUsed: (await tx3.wait()).gasUsed.toString()
      });
      testResults.successfulTests++;
      testResults.totalTransactions++;
      console.log(`   ✅ Success: ${tx3.hash}`);

      // Test 4: Transfer Ownership
      console.log("4️⃣ Testing transferOwnershipDeed...");
      try {
        // Wait a bit and then transfer
        await new Promise(resolve => setTimeout(resolve, 2000));

        const deedId = 1; // First deed created
        const ownershipAsUser1 = ownership.connect(user1);

        const tx4 = await ownershipAsUser1.transferOwnershipDeed(
          deedId,
          user2.address,
          ethers.parseEther("1.5"),
          1, // SECONDARY_SALE
          "QmTransferMetadata"
        );
        await tx4.wait();

        testResults.transactions.transferOwnershipDeed = tx4.hash;
        testResults.functionTests.push({
          function: "transferOwnershipDeed",
          contract: "Ownership",
          status: "success",
          txHash: tx4.hash,
          gasUsed: (await tx4.wait()).gasUsed.toString()
        });
        testResults.successfulTests++;
        testResults.totalTransactions++;
        console.log(`   ✅ Success: ${tx4.hash}`);
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        testResults.functionTests.push({
          function: "transferOwnershipDeed",
          contract: "Ownership",
          status: "failed",
          error: error.message
        });
        testResults.failedTests++;
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      testResults.functionTests.push({
        function: "createOwnershipDeed",
        contract: "Ownership",
        status: "failed",
        error: error.message
      });
      testResults.failedTests++;
    }

    console.log("\n🏗️ PHASE 3: PROVENANCE TESTING");
    console.log("-".repeat(50));

    // Test 5: Create Provenance Entry
    console.log("5️⃣ Testing createProvenanceEntry...");
    try {
      const tx5 = await provenance.createProvenanceEntry(
        1, // passport ID
        "TRANSFER",
        "Test Location",
        "Test provenance entry",
        "QmProvenanceMetadata",
        ethers.keccak256(ethers.toUtf8Bytes("provenance-hash")),
        []
      );
      await tx5.wait();

      testResults.transactions.createProvenanceEntry = tx5.hash;
      testResults.functionTests.push({
        function: "createProvenanceEntry",
        contract: "Provenance",
        status: "success",
        txHash: tx5.hash,
        gasUsed: (await tx5.wait()).gasUsed.toString()
      });
      testResults.successfulTests++;
      testResults.totalTransactions++;
      console.log(`   ✅ Success: ${tx5.hash}`);
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      testResults.functionTests.push({
        function: "createProvenanceEntry",
        contract: "Provenance",
        status: "failed",
        error: error.message
      });
      testResults.failedTests++;
    }

    console.log("\n🎉 CONTRACT TESTING COMPLETED!");
    console.log("=".repeat(70));
    console.log(`📊 Total Tests: ${testResults.successfulTests + testResults.failedTests}`);
    console.log(`✅ Successful: ${testResults.successfulTests}`);
    console.log(`❌ Failed: ${testResults.failedTests}`);
    console.log(`🔗 Total Transactions: ${testResults.totalTransactions}`);

    console.log("\n🔗 ALL TRANSACTION HASHES:");
    Object.entries(testResults.transactions).forEach(([key, hash]) => {
      console.log(`   ${key}: ${hash}`);
    });

    // Generate Postman Collection
    console.log("\n📦 GENERATING POSTMAN COLLECTION...");
    const postmanCollection = generatePostmanCollection(contractAddresses, testResults);

    const postmanFile = `TrataTech-API-Collection-${Date.now()}.json`;
    fs.writeFileSync(postmanFile, JSON.stringify(postmanCollection, null, 2));
    console.log(`✅ Postman Collection: ${postmanFile}`);

    // Save comprehensive test results
    const resultsFile = `comprehensive-test-results-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
    console.log(`📄 Test Results: ${resultsFile}`);

    return testResults;

  } catch (error) {
    console.error("❌ Comprehensive testing failed:", error);

    testResults.error = error.message;
    testResults.errorStack = error.stack;
    const errorFile = `comprehensive-test-error-${Date.now()}.json`;
    fs.writeFileSync(errorFile, JSON.stringify(testResults, null, 2));

    throw error;
  }
}

function generatePostmanCollection(contractAddresses, testResults) {
  const collection = {
    info: {
      _postman_id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: "TrataTech Smart Contract API",
      description: "Comprehensive API testing collection for TrataTech smart contracts with gasless transactions",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      _exporter_id: "12345678"
    },
    variable: [
      {
        key: "baseUrl",
        value: "http://localhost:3005",
        type: "string"
      },
      {
        key: "apiKey",
        value: "admin-api-key-123",
        type: "string"
      }
    ],
    item: [
      {
        name: "Health Check",
        request: {
          method: "GET",
          header: [],
          url: {
            raw: "{{baseUrl}}/health",
            host: ["{{baseUrl}}"],
            path: ["health"]
          }
        }
      },
      {
        name: "Product Passport",
        item: [
          {
            name: "Register Brand",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json"
                },
                {
                  key: "x-api-key",
                  value: "{{apiKey}}"
                }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  name: "Test Brand " + Date.now(),
                  description: "Test brand description",
                  website: "https://test.com",
                  authorizedCountries: ["US", "CA"],
                  ipfsData: {
                    metadata: {
                      name: "Test Brand Registration",
                      description: "Test brand registration metadata",
                      attributes: [
                        {
                          trait_type: "Type",
                          value: "Test Brand"
                        }
                      ]
                    }
                  }
                }, null, 2)
              },
              url: {
                raw: "{{baseUrl}}/api/v1/product-passport/brands",
                host: ["{{baseUrl}}"],
                path: ["api", "v1", "product-passport", "brands"]
              }
            }
          },
          {
            name: "Create Product Passport",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json"
                },
                {
                  key: "x-api-key",
                  value: "{{apiKey}}"
                }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  brandId: "1",
                  productName: "Test Product " + Date.now(),
                  productDescription: "Test product description",
                  serialNumber: "TEST" + Date.now(),
                  manufacturingDate: Math.floor(Date.now() / 1000),
                  expiryDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
                  ipfsData: {
                    metadata: {
                      name: "Test Product Passport",
                      description: "Test product passport metadata",
                      attributes: [
                        {
                          trait_type: "Product Type",
                          value: "Test Product"
                        }
                      ]
                    }
                  }
                }, null, 2)
              },
              url: {
                raw: "{{baseUrl}}/api/v1/product-passport/passports",
                host: ["{{baseUrl}}"],
                path: ["api", "v1", "product-passport", "passports"]
              }
            }
          }
        ]
      },
      {
        name: "Ownership Registry",
        item: [
          {
            name: "Create Ownership Deed",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json"
                },
                {
                  key: "x-api-key",
                  value: "{{apiKey}}"
                }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  passportId: 1,
                  ownerAddress: "0x1234567890123456789012345678901234567890",
                  purchaseDate: Math.floor(Date.now() / 1000),
                  purchasePrice: "1000",
                  ipfsData: {
                    metadata: {
                      name: "Test Ownership Deed",
                      description: "Test ownership deed metadata",
                      attributes: [
                        {
                          trait_type: "Ownership Type",
                          value: "Full Ownership"
                        }
                      ]
                    }
                  }
                }, null, 2)
              },
              url: {
                raw: "{{baseUrl}}/api/v1/ownership/deeds",
                host: ["{{baseUrl}}"],
                path: ["api", "v1", "ownership", "deeds"]
              }
            }
          }
        ]
      },
      {
        name: "Provenance",
        item: [
          {
            name: "Create Provenance Entry",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json"
                },
                {
                  key: "x-api-key",
                  value: "{{apiKey}}"
                }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  passportId: 1,
                  entryType: "TRANSFER",
                  location: "Test Location",
                  description: "Test provenance entry",
                  ipfsData: {
                    metadata: {
                      name: "Test Provenance Entry",
                      description: "Test provenance entry metadata",
                      attributes: [
                        {
                          trait_type: "Entry Type",
                          value: "Transfer"
                        }
                      ]
                    }
                  }
                }, null, 2)
              },
              url: {
                raw: "{{baseUrl}}/api/v1/provenance/entries",
                host: ["{{baseUrl}}"],
                path: ["api", "v1", "provenance", "entries"]
              }
            }
          }
        ]
      }
    ]
  };

  return collection;
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };