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

async function testContractEndpoints() {
  console.log('🔍 Testing Contract Endpoints...');
  
  // Test 1: Brand Registration (working)
  console.log('\n1. Testing Brand Registration...');
  try {
    const brandResponse = await makeRequest('POST', '/api/v1/product-passport/brands', {
      name: "Test Brand " + Date.now(),
      description: "Test brand description",
      website: "https://test.com",
      authorizedCountries: ["US", "CA"],
      ipfsData: {
        metadata: {
          name: "Test Brand Registration",
          description: "Test brand registration metadata",
          attributes: [{ trait_type: "Type", value: "Test Brand" }]
        }
      }
    });
    console.log(`   Brand Registration: ${brandResponse.status} - ${brandResponse.data.message || 'Success'}`);
    
    if (brandResponse.status === 201) {
      // Test 2: Product Passport Creation (failing)
      console.log('\n2. Testing Product Passport Creation...');
      try {
        const passportResponse = await makeRequest('POST', '/api/v1/product-passport/passports', {
          brandId: "test-brand",
          productName: "Test Product " + Date.now(),
          productDescription: "Test product description",
          serialNumber: "TEST" + Date.now(),
          manufacturingDate: Math.floor(Date.now() / 1000),
          expiryDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
          ipfsData: {
            metadata: {
              name: "Test Product Passport",
              description: "Test product passport metadata",
              attributes: [{ trait_type: "Product Type", value: "Test Product" }]
            }
          }
        });
        console.log(`   Product Passport: ${passportResponse.status} - ${JSON.stringify(passportResponse.data)}`);
      } catch (error) {
        console.log(`   Product Passport Error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.log(`   Brand Registration Error: ${error.message}`);
  }
}

testContractEndpoints().catch(console.error);
