#!/usr/bin/env node

const http = require('http');
const fs = require('fs');

const BASE_URL = 'http://localhost:3005';
const API_KEY = 'admin-api-key-123';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      timeout: 30000 // 30 second timeout
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({
            status: res.statusCode,
            data: jsonBody
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Wait for server to be ready
async function waitForServer() {
  const maxAttempts = 10;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      console.log(`🔄 Waiting for server... (${attempts + 1}/${maxAttempts})`);
      const response = await makeRequest('GET', '/');
      if (response.status === 200) {
        console.log('✅ Server is ready!');
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Server did not start within expected time');
}

async function main() {
  console.log("🚀 COMPREHENSIVE API ENDPOINT TESTING WITH GASLESS TRANSACTIONS");
  console.log("=".repeat(80));
  console.log(`⏰ Started: ${new Date().toISOString()}`);

  const testResults = {
    testTimestamp: new Date().toISOString(),
    testType: "Complete API Endpoint Testing",
    network: "Polygon Amoy Testnet",
    chainId: 80002,
    baseUrl: BASE_URL,
    allEndpoints: {},
    transactionHashes: {},
    successfulEndpoints: [],
    failedEndpoints: [],
    gaslessTransactions: []
  };

  try {
    // Wait for server to be ready
    await waitForServer();

    console.log("\n🏭 PHASE 1: PRODUCT PASSPORT API ENDPOINTS");
    console.log("-".repeat(60));

    // Test brand authorization endpoint
    console.log("1️⃣ Testing Brand Authorization...");
    try {
      const brandAuthResponse = await makeRequest('POST', '/api/productpassport/authorize-brand', {
        brandAddress: "0xE3240ff264BEf46e9E87E056f4c8098A4Aec5927"
      });
      testResults.allEndpoints.authorizeBrand = brandAuthResponse;
      if (brandAuthResponse.status === 200 && brandAuthResponse.data.transactionHash) {
        testResults.transactionHashes.authorizeBrand = brandAuthResponse.data.transactionHash;
        testResults.gaslessTransactions.push({
          endpoint: 'authorizeBrand',
          hash: brandAuthResponse.data.transactionHash
        });
        testResults.successfulEndpoints.push('authorizeBrand');
        console.log(`   ✅ SUCCESS - TX: ${brandAuthResponse.data.transactionHash}`);
      } else {
        testResults.failedEndpoints.push('authorizeBrand');
        console.log(`   ❌ FAILED - Status: ${brandAuthResponse.status}`);
      }
    } catch (error) {
      testResults.failedEndpoints.push('authorizeBrand');
      console.log(`   ❌ ERROR: ${error.message}`);
    }

    // Test brand registration endpoint
    console.log("2️⃣ Testing Brand Registration...");
    try {
      const brandRegResponse = await makeRequest('POST', '/api/productpassport/register-brand', {
        brandId: `BRAND-${Date.now()}`,
        brandName: "TechTest Brand",
        brandDescription: "API Test Brand",
        ipfsCID: `QmBrand${Date.now()}`,
        authorizedCountries: ["US", "CA", "UK"]
      });
      testResults.allEndpoints.registerBrand = brandRegResponse;
      if (brandRegResponse.status === 200 && brandRegResponse.data.transactionHash) {
        testResults.transactionHashes.registerBrand = brandRegResponse.data.transactionHash;
        testResults.gaslessTransactions.push({
          endpoint: 'registerBrand',
          hash: brandRegResponse.data.transactionHash
        });
        testResults.successfulEndpoints.push('registerBrand');
        console.log(`   ✅ SUCCESS - TX: ${brandRegResponse.data.transactionHash}`);
      } else {
        testResults.failedEndpoints.push('registerBrand');
        console.log(`   ❌ FAILED - Status: ${brandRegResponse.status}`);
      }
    } catch (error) {
      testResults.failedEndpoints.push('registerBrand');
      console.log(`   ❌ ERROR: ${error.message}`);
    }

    // Test brand verification endpoint
    console.log("3️⃣ Testing Brand Verification...");
    try {
      const brandVerifyResponse = await makeRequest('POST', '/api/productpassport/verify-brand', {
        brandId: `BRAND-${Date.now()}`
      });
      testResults.allEndpoints.verifyBrand = brandVerifyResponse;
      if (brandVerifyResponse.status === 200 && brandVerifyResponse.data.transactionHash) {
        testResults.transactionHashes.verifyBrand = brandVerifyResponse.data.transactionHash;
        testResults.gaslessTransactions.push({
          endpoint: 'verifyBrand',
          hash: brandVerifyResponse.data.transactionHash
        });
        testResults.successfulEndpoints.push('verifyBrand');
        console.log(`   ✅ SUCCESS - TX: ${brandVerifyResponse.data.transactionHash}`);
      } else {
        testResults.failedEndpoints.push('verifyBrand');
        console.log(`   ❌ FAILED - Status: ${brandVerifyResponse.status}`);
      }
    } catch (error) {
      testResults.failedEndpoints.push('verifyBrand');
      console.log(`   ❌ ERROR: ${error.message}`);
    }

    // Test product passport creation endpoint
    console.log("4️⃣ Testing Product Passport Creation...");
    try {
      const passportResponse = await makeRequest('POST', '/api/productpassport/create-passport', {
        serialNumber: `SN-${Date.now()}`,
        brandId: `BRAND-${Date.now()}`,
        productName: "API Test Product",
        productDescription: "Product created via API",
        materials: "Steel, Aluminum",
        manufacturingLocation: "Factory A",
        ipfsCID: `QmProduct${Date.now()}`,
        metadataHash: "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        additionalAttributes: ["Color: Blue", "Size: Large"]
      });
      testResults.allEndpoints.createPassport = passportResponse;
      if (passportResponse.status === 200 && passportResponse.data.transactionHash) {
        testResults.transactionHashes.createPassport = passportResponse.data.transactionHash;
        testResults.gaslessTransactions.push({
          endpoint: 'createPassport',
          hash: passportResponse.data.transactionHash
        });
        testResults.successfulEndpoints.push('createPassport');
        console.log(`   ✅ SUCCESS - TX: ${passportResponse.data.transactionHash}`);
      } else {
        testResults.failedEndpoints.push('createPassport');
        console.log(`   ❌ FAILED - Status: ${passportResponse.status}`);
      }
    } catch (error) {
      testResults.failedEndpoints.push('createPassport');
      console.log(`   ❌ ERROR: ${error.message}`);
    }

    console.log("\n👥 PHASE 2: OWNERSHIP REGISTRY API ENDPOINTS");
    console.log("-".repeat(60));

    // Test ownership authorization endpoint
    console.log("5️⃣ Testing Ownership Authorization...");
    try {
      const ownerAuthResponse = await makeRequest('POST', '/api/ownership/authorize-brand', {
        brandAddress: "0xE3240ff264BEf46e9E87E056f4c8098A4Aec5927"
      });
      testResults.allEndpoints.authorizeOwnership = ownerAuthResponse;
      if (ownerAuthResponse.status === 200 && ownerAuthResponse.data.transactionHash) {
        testResults.transactionHashes.authorizeOwnership = ownerAuthResponse.data.transactionHash;
        testResults.gaslessTransactions.push({
          endpoint: 'authorizeOwnership',
          hash: ownerAuthResponse.data.transactionHash
        });
        testResults.successfulEndpoints.push('authorizeOwnership');
        console.log(`   ✅ SUCCESS - TX: ${ownerAuthResponse.data.transactionHash}`);
      } else {
        testResults.failedEndpoints.push('authorizeOwnership');
        console.log(`   ❌ FAILED - Status: ${ownerAuthResponse.status}`);
      }
    } catch (error) {
      testResults.failedEndpoints.push('authorizeOwnership');
      console.log(`   ❌ ERROR: ${error.message}`);
    }

    // Test ownership deed creation endpoint
    console.log("6️⃣ Testing Ownership Deed Creation...");
    try {
      const passportId = 5555 + Math.floor(Math.random() * 1000);
      const ownerDeedResponse = await makeRequest('POST', '/api/ownership/create-deed', {
        passportId: passportId,
        initialOwner: "0xE3240ff264BEf46e9E87E056f4c8098A4Aec5927",
        acquisitionPrice: "1000000000000000000", // 1 ETH in wei
        acquisitionType: "Primary Sale",
        ipfsCID: `QmOwnership${Date.now()}`,
        ownershipHash: "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        additionalData: []
      });
      testResults.allEndpoints.createOwnershipDeed = ownerDeedResponse;
      if (ownerDeedResponse.status === 200 && ownerDeedResponse.data.transactionHash) {
        testResults.transactionHashes.createOwnershipDeed = ownerDeedResponse.data.transactionHash;
        testResults.gaslessTransactions.push({
          endpoint: 'createOwnershipDeed',
          hash: ownerDeedResponse.data.transactionHash
        });
        testResults.successfulEndpoints.push('createOwnershipDeed');
        console.log(`   ✅ SUCCESS - TX: ${ownerDeedResponse.data.transactionHash}`);
      } else {
        testResults.failedEndpoints.push('createOwnershipDeed');
        console.log(`   ❌ FAILED - Status: ${ownerDeedResponse.status}`);
      }
    } catch (error) {
      testResults.failedEndpoints.push('createOwnershipDeed');
      console.log(`   ❌ ERROR: ${error.message}`);
    }

    console.log("\n📊 PHASE 3: PROVENANCE API ENDPOINTS");
    console.log("-".repeat(60));

    // Test provenance authorization endpoint
    console.log("7️⃣ Testing Provenance Authorization...");
    try {
      const provAuthResponse = await makeRequest('POST', '/api/provenance/authorize-recorder', {
        recorderAddress: "0xE3240ff264BEf46e9E87E056f4c8098A4Aec5927"
      });
      testResults.allEndpoints.authorizeProvenance = provAuthResponse;
      if (provAuthResponse.status === 200 && provAuthResponse.data.transactionHash) {
        testResults.transactionHashes.authorizeProvenance = provAuthResponse.data.transactionHash;
        testResults.gaslessTransactions.push({
          endpoint: 'authorizeProvenance',
          hash: provAuthResponse.data.transactionHash
        });
        testResults.successfulEndpoints.push('authorizeProvenance');
        console.log(`   ✅ SUCCESS - TX: ${provAuthResponse.data.transactionHash}`);
      } else {
        testResults.failedEndpoints.push('authorizeProvenance');
        console.log(`   ❌ FAILED - Status: ${provAuthResponse.status}`);
      }
    } catch (error) {
      testResults.failedEndpoints.push('authorizeProvenance');
      console.log(`   ❌ ERROR: ${error.message}`);
    }

    // Test provenance entry creation endpoint
    console.log("8️⃣ Testing Provenance Entry Creation...");
    try {
      const provEntryResponse = await makeRequest('POST', '/api/provenance/create-entry', {
        passportId: 1,
        eventType: "Manufacturing",
        location: "Factory A",
        timestamp: Math.floor(Date.now() / 1000),
        description: "API Test Manufacturing Event",
        ipfsCID: `QmProvenance${Date.now()}`,
        eventHash: "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        additionalData: ["Temperature: 25°C", "Humidity: 60%"]
      });
      testResults.allEndpoints.createProvenanceEntry = provEntryResponse;
      if (provEntryResponse.status === 200 && provEntryResponse.data.transactionHash) {
        testResults.transactionHashes.createProvenanceEntry = provEntryResponse.data.transactionHash;
        testResults.gaslessTransactions.push({
          endpoint: 'createProvenanceEntry',
          hash: provEntryResponse.data.transactionHash
        });
        testResults.successfulEndpoints.push('createProvenanceEntry');
        console.log(`   ✅ SUCCESS - TX: ${provEntryResponse.data.transactionHash}`);
      } else {
        testResults.failedEndpoints.push('createProvenanceEntry');
        console.log(`   ❌ FAILED - Status: ${provEntryResponse.status}`);
      }
    } catch (error) {
      testResults.failedEndpoints.push('createProvenanceEntry');
      console.log(`   ❌ ERROR: ${error.message}`);
    }

    // Summary
    console.log("\n🎉 API ENDPOINT TESTING COMPLETED!");
    console.log("=".repeat(80));
    console.log(`✅ Successful Endpoints: ${testResults.successfulEndpoints.length}`);
    console.log(`❌ Failed Endpoints: ${testResults.failedEndpoints.length}`);
    console.log(`⛽ Gasless Transactions: ${testResults.gaslessTransactions.length}`);

    console.log("\n🔗 ALL TRANSACTION HASHES FROM API ENDPOINTS:");
    Object.entries(testResults.transactionHashes).forEach(([endpoint, hash]) => {
      console.log(`   ${endpoint}: ${hash}`);
    });

    console.log("\n✅ SUCCESSFUL ENDPOINTS:");
    testResults.successfulEndpoints.forEach(endpoint => {
      console.log(`   ✅ ${endpoint}`);
    });

    if (testResults.failedEndpoints.length > 0) {
      console.log("\n❌ FAILED ENDPOINTS:");
      testResults.failedEndpoints.forEach(endpoint => {
        console.log(`   ❌ ${endpoint}`);
      });
    }

    // Save results
    const reportFile = `api-endpoint-test-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Complete API test report: ${reportFile}`);

    // Generate Postman Collection
    const postmanCollection = generatePostmanCollection(testResults);
    const postmanFile = `TrataTech_Complete_API_Collection_${Date.now()}.postman_collection.json`;
    fs.writeFileSync(postmanFile, JSON.stringify(postmanCollection, null, 2));
    console.log(`📦 Generated Postman collection: ${postmanFile}`);

    return testResults;

  } catch (error) {
    console.error("❌ API endpoint testing failed:", error);
    testResults.error = error.message;
    const failureFile = `api-test-failure-${Date.now()}.json`;
    fs.writeFileSync(failureFile, JSON.stringify(testResults, null, 2));
    throw error;
  }
}

function generatePostmanCollection(testResults) {
  return {
    "info": {
      "name": "TrataTech Complete API Collection - Fresh Contracts",
      "description": "Complete API testing for all TrataTech contract functions with gasless transactions",
      "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    "variable": [
      {
        "key": "base_url",
        "value": "http://localhost:3005"
      },
      {
        "key": "api_key",
        "value": "admin-api-key-123"
      }
    ],
    "item": [
      {
        "name": "Product Passport",
        "item": [
          {
            "name": "Authorize Brand",
            "request": {
              "method": "POST",
              "header": [
                {"key": "x-api-key", "value": "{{api_key}}"},
                {"key": "Content-Type", "value": "application/json"}
              ],
              "body": {
                "mode": "raw",
                "raw": JSON.stringify({
                  "brandAddress": "0xE3240ff264BEf46e9E87E056f4c8098A4Aec5927"
                })
              },
              "url": "{{base_url}}/api/productpassport/authorize-brand"
            }
          },
          {
            "name": "Register Brand",
            "request": {
              "method": "POST",
              "header": [
                {"key": "x-api-key", "value": "{{api_key}}"},
                {"key": "Content-Type", "value": "application/json"}
              ],
              "body": {
                "mode": "raw",
                "raw": JSON.stringify({
                  "brandId": "TEST-BRAND-{{$timestamp}}",
                  "brandName": "TechTest Brand",
                  "brandDescription": "API Test Brand",
                  "ipfsCID": "QmBrand{{$timestamp}}",
                  "authorizedCountries": ["US", "CA", "UK"]
                })
              },
              "url": "{{base_url}}/api/productpassport/register-brand"
            }
          },
          {
            "name": "Create Product Passport",
            "request": {
              "method": "POST",
              "header": [
                {"key": "x-api-key", "value": "{{api_key}}"},
                {"key": "Content-Type", "value": "application/json"}
              ],
              "body": {
                "mode": "raw",
                "raw": JSON.stringify({
                  "serialNumber": "SN-{{$timestamp}}",
                  "brandId": "TEST-BRAND",
                  "productName": "API Test Product",
                  "productDescription": "Product created via API",
                  "materials": "Steel, Aluminum",
                  "manufacturingLocation": "Factory A",
                  "ipfsCID": "QmProduct{{$timestamp}}",
                  "metadataHash": "0x1234567890abcdef",
                  "additionalAttributes": ["Color: Blue", "Size: Large"]
                })
              },
              "url": "{{base_url}}/api/productpassport/create-passport"
            }
          }
        ]
      },
      {
        "name": "Ownership",
        "item": [
          {
            "name": "Authorize Brand for Ownership",
            "request": {
              "method": "POST",
              "header": [
                {"key": "x-api-key", "value": "{{api_key}}"},
                {"key": "Content-Type", "value": "application/json"}
              ],
              "body": {
                "mode": "raw",
                "raw": JSON.stringify({
                  "brandAddress": "0xE3240ff264BEf46e9E87E056f4c8098A4Aec5927"
                })
              },
              "url": "{{base_url}}/api/ownership/authorize-brand"
            }
          },
          {
            "name": "Create Ownership Deed",
            "request": {
              "method": "POST",
              "header": [
                {"key": "x-api-key", "value": "{{api_key}}"},
                {"key": "Content-Type", "value": "application/json"}
              ],
              "body": {
                "mode": "raw",
                "raw": JSON.stringify({
                  "passportId": 1,
                  "initialOwner": "0xE3240ff264BEf46e9E87E056f4c8098A4Aec5927",
                  "acquisitionPrice": "1000000000000000000",
                  "acquisitionType": "Primary Sale",
                  "ipfsCID": "QmOwnership{{$timestamp}}",
                  "ownershipHash": "0x1234567890abcdef",
                  "additionalData": []
                })
              },
              "url": "{{base_url}}/api/ownership/create-deed"
            }
          }
        ]
      },
      {
        "name": "Provenance",
        "item": [
          {
            "name": "Authorize Recorder",
            "request": {
              "method": "POST",
              "header": [
                {"key": "x-api-key", "value": "{{api_key}}"},
                {"key": "Content-Type", "value": "application/json"}
              ],
              "body": {
                "mode": "raw",
                "raw": JSON.stringify({
                  "recorderAddress": "0xE3240ff264BEf46e9E87E056f4c8098A4Aec5927"
                })
              },
              "url": "{{base_url}}/api/provenance/authorize-recorder"
            }
          },
          {
            "name": "Create Provenance Entry",
            "request": {
              "method": "POST",
              "header": [
                {"key": "x-api-key", "value": "{{api_key}}"},
                {"key": "Content-Type", "value": "application/json"}
              ],
              "body": {
                "mode": "raw",
                "raw": JSON.stringify({
                  "passportId": 1,
                  "eventType": "Manufacturing",
                  "location": "Factory A",
                  "timestamp": "{{$timestamp}}",
                  "description": "API Test Manufacturing Event",
                  "ipfsCID": "QmProvenance{{$timestamp}}",
                  "eventHash": "0x1234567890abcdef",
                  "additionalData": ["Temperature: 25°C", "Humidity: 60%"]
                })
              },
              "url": "{{base_url}}/api/provenance/create-entry"
            }
          }
        ]
      }
    ]
  };
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };