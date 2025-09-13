#!/usr/bin/env node

const https = require('https');
const http = require('http');

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
      }
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

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test data
const testData = {
  brand: {
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
  },
  passport: {
    brandId: "test-brand",
    productName: "Test Product " + Date.now(),
    productDescription: "Test product description",
    serialNumber: "TEST" + Date.now(),
    manufacturingDate: Math.floor(Date.now() / 1000),
    expiryDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year from now
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
  },
  provenance: {
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
  },
  ownership: {
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
  },
  event: {
    eventName: "Test Event " + Date.now(),
    eventDescription: "Test event description",
    eventDate: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 1 week from now
    maxAttendees: 100,
    ipfsData: {
      metadata: {
        name: "Test Event",
        description: "Test event metadata",
        attributes: [
          {
            trait_type: "Event Type",
            value: "Test Event"
          }
        ]
      }
    }
  }
};

// Test functions
async function testHealth() {
  console.log('\n🏥 Testing Health Check...');
  try {
    const response = await makeRequest('GET', '/health');
    console.log(`✅ Health Check: ${response.status} - ${response.data.status || 'OK'}`);
    return true;
  } catch (error) {
    console.log(`❌ Health Check failed: ${error.message}`);
    return false;
  }
}

async function testBrandRegistration() {
  console.log('\n🏷️ Testing Brand Registration...');
  try {
    const response = await makeRequest('POST', '/api/v1/product-passport/brands', testData.brand);
    if (response.status === 201 || response.status === 200) {
      console.log(`✅ Brand Registration: ${response.status} - ${response.data.message || 'Success'}`);
      if (response.data.data && response.data.data.transactionHash) {
        console.log(`   Transaction Hash: ${response.data.data.transactionHash}`);
      }
      return true;
    } else {
      console.log(`❌ Brand Registration failed: ${response.status} - ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Brand Registration failed: ${error.message}`);
    return false;
  }
}

async function testProductPassportCreation() {
  console.log('\n📄 Testing Product Passport Creation...');
  try {
    const response = await makeRequest('POST', '/api/v1/product-passport/passports', testData.passport);
    if (response.status === 201 || response.status === 200) {
      console.log(`✅ Product Passport Creation: ${response.status} - ${response.data.message || 'Success'}`);
      if (response.data.data && response.data.data.transactionHash) {
        console.log(`   Transaction Hash: ${response.data.data.transactionHash}`);
      }
      return true;
    } else {
      console.log(`❌ Product Passport Creation failed: ${response.status} - ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Product Passport Creation failed: ${error.message}`);
    return false;
  }
}

async function testProvenanceEntry() {
  console.log('\n📋 Testing Provenance Entry Creation...');
  try {
    const response = await makeRequest('POST', '/api/v1/provenance/entries', testData.provenance);
    if (response.status === 201 || response.status === 200) {
      console.log(`✅ Provenance Entry Creation: ${response.status} - ${response.data.message || 'Success'}`);
      if (response.data.data && response.data.data.transactionHash) {
        console.log(`   Transaction Hash: ${response.data.data.transactionHash}`);
      }
      return true;
    } else {
      console.log(`❌ Provenance Entry Creation failed: ${response.status} - ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Provenance Entry Creation failed: ${error.message}`);
    return false;
  }
}

async function testOwnershipDeed() {
  console.log('\n🏠 Testing Ownership Deed Creation...');
  try {
    const response = await makeRequest('POST', '/api/v1/ownership/deeds', testData.ownership);
    if (response.status === 201 || response.status === 200) {
      console.log(`✅ Ownership Deed Creation: ${response.status} - ${response.data.message || 'Success'}`);
      if (response.data.data && response.data.data.transactionHash) {
        console.log(`   Transaction Hash: ${response.data.data.transactionHash}`);
      }
      return true;
    } else {
      console.log(`❌ Ownership Deed Creation failed: ${response.status} - ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Ownership Deed Creation failed: ${error.message}`);
    return false;
  }
}

async function testEventCreation() {
  console.log('\n🎉 Testing Event Creation...');
  try {
    const response = await makeRequest('POST', '/api/v1/business/events', testData.event);
    if (response.status === 201 || response.status === 200) {
      console.log(`✅ Event Creation: ${response.status} - ${response.data.message || 'Success'}`);
      if (response.data.data && response.data.data.transactionHash) {
        console.log(`   Transaction Hash: ${response.data.data.transactionHash}`);
      }
      return true;
    } else {
      console.log(`❌ Event Creation failed: ${response.status} - ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Event Creation failed: ${error.message}`);
    return false;
  }
}

// Main test function
async function runAllTests() {
  console.log('🚀 Starting TrataTech API Route Tests...');
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log(`🔑 Using API Key: ${API_KEY}`);
  
  const results = {
    health: await testHealth(),
    brand: await testBrandRegistration(),
    passport: await testProductPassportCreation(),
    provenance: await testProvenanceEntry(),
    ownership: await testOwnershipDeed(),
    event: await testEventCreation()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test.toUpperCase()}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const passedCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  
  console.log(`\n🎯 Overall: ${passedCount}/${totalCount} tests passed`);
  
  if (passedCount === totalCount) {
    console.log('🎉 All tests passed! Your API is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the logs above for details.');
  }
}

// Run the tests
runAllTests().catch(console.error);
