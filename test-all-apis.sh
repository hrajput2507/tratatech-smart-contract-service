#!/bin/bash

# TrataTech API Testing Script
# Tests all API endpoints and verifies transaction logging

BASE_URL="http://localhost:3000/api"
API_KEY="tratatech_client_2024_secure_key_12345"

echo "🚀 TrataTech API Testing Script"
echo "================================"
echo ""

# Function to make API calls
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo "📡 Testing: $description"
    echo "   $method $endpoint"
    
    if [ -n "$data" ]; then
        response=$(curl -s -X $method \
            -H "Content-Type: application/json" \
            -H "x-api-key: $API_KEY" \
            -d "$data" \
            "$BASE_URL$endpoint")
    else
        response=$(curl -s -X $method \
            -H "x-api-key: $API_KEY" \
            "$BASE_URL$endpoint")
    fi
    
    # Extract success status
    success=$(echo "$response" | grep -o '"success":[^,]*' | cut -d':' -f2 | tr -d ' ')
    
    if [ "$success" = "true" ]; then
        echo "   ✅ SUCCESS"
    else
        echo "   ❌ FAILED"
        echo "   Response: $response"
    fi
    echo ""
}

# Test Health Check
echo "🏥 HEALTH CHECK ENDPOINTS"
echo "-------------------------"
make_request "GET" "/health" "" "Basic Health Check"
make_request "GET" "/health/detailed" "" "Detailed Health Check"

# Test Main Contract APIs
echo "🏢 MAIN CONTRACT ENDPOINTS"
echo "-------------------------"
make_request "POST" "/main/events" '{
  "eventName": "Test Event for Logging",
  "eventDescription": "Testing transaction logging for main contract",
  "eventDate": 2000000000,
  "maxAttendees": 100,
  "ipfsData": {
    "name": "Test Event '$(date +%s)'",
    "description": "Testing transaction logging for main contract - '$(date +%s)'"
  }
}' "Create Event"

make_request "POST" "/main/product-launches" '{
  "productName": "Test Product Launch",
  "productDescription": "Testing transaction logging for product launch",
  "launchDate": 2000000000,
  "earlyAccessEndDate": 1999999999,
  "maxEarlyAccess": 50,
  "ipfsData": {
    "name": "Test Product Launch '$(date +%s)'",
    "description": "Testing transaction logging for product launch - '$(date +%s)'"
  }
}' "Create Product Launch"

make_request "GET" "/main/platform-fee" "" "Get Platform Fee"
make_request "GET" "/main/blockchain-activity" "" "Get Blockchain Activity"

# Test Product Passport APIs
echo "📋 PRODUCT PASSPORT ENDPOINTS"
echo "----------------------------"
make_request "POST" "/passport/brands" '{
  "brandId": "TEST_BRAND_'$(date +%s)'",
  "brandName": "Test Brand for Logging",
  "brandDescription": "Testing transaction logging for passport contract",
  "authorizedCountries": ["US", "CA"],
  "ipfsData": {
    "name": "Test Brand '$(date +%s)'",
    "description": "Testing transaction logging for passport contract - '$(date +%s)'"
  }
}' "Register Brand"

make_request "POST" "/passport/passports" '{
  "serialNumber": "SN'$(date +%s)'",
  "brandId": "TEST_BRAND_001",
  "productName": "Test Product",
  "productDescription": "Testing transaction logging for product passport",
  "materials": "Cotton, Polyester",
  "manufacturingLocation": "USA",
  "manufacturingDate": 2000000000,
  "ipfsData": {
    "name": "Test Product '$(date +%s)'",
    "description": "Testing transaction logging for product passport - '$(date +%s)'"
  }
}' "Create Product Passport"

make_request "GET" "/passport/brands/TEST_BRAND_001" "" "Get Brand Details"

# Test Ownership Registry APIs
echo "🏠 OWNERSHIP REGISTRY ENDPOINTS"
echo "-------------------------------"
make_request "POST" "/ownership/deeds" '{
  "passportId": 1,
  "owner": "0xE3240ff264BEf46e9E87E056f4c8098A4Aec5927",
  "acquisitionPrice": 100.5,
  "acquisitionMethod": "Purchase",
  "ipfsData": {
    "name": "Ownership Deed '$(date +%s)'",
    "description": "Testing transaction logging for ownership deed - '$(date +%s)'"
  }
}' "Create Ownership Deed"

make_request "POST" "/ownership/deeds/1/transfer" '{
  "to": "0xE3240ff264BEf46e9E87E056f4c8098A4Aec5927",
  "transferPrice": 150.0,
  "transferType": 0,
  "ipfsData": {
    "name": "Transfer Record '$(date +%s)'",
    "description": "Testing transaction logging for transfer - '$(date +%s)'"
  }
}' "Transfer Ownership Deed"

# Test Provenance APIs
echo "🔍 PROVENANCE ENDPOINTS"
echo "----------------------"
make_request "POST" "/provenance/entries" '{
  "passportId": 1,
  "entryType": 0,
  "from": "0xE3240ff264BEf46e9E87E056f4c8098A4Aec5927",
  "to": "0xE3240ff264BEf46e9E87E056f4c8098A4Aec5927",
  "location": "New York, USA",
  "description": "Product manufactured - testing transaction logging",
  "ipfsData": {
    "name": "Provenance Entry '$(date +%s)'",
    "description": "Testing transaction logging for provenance - '$(date +%s)'"
  }
}' "Create Provenance Entry"

make_request "POST" "/provenance/service-records" '{
  "passportId": 1,
  "serviceType": "Maintenance",
  "serviceProvider": "Service Co.",
  "serviceDescription": "Regular maintenance service - testing transaction logging",
  "serviceDate": 2000000000,
  "nextServiceDate": 2000000001,
  "certificateNumber": "CERT'$(date +%s)'",
  "ipfsData": {
    "name": "Service Record '$(date +%s)'",
    "description": "Testing transaction logging for service record - '$(date +%s)'"
  }
}' "Create Service Record"

# Test Forwarder APIs
echo "🔄 FORWARDER ENDPOINTS"
echo "---------------------"
make_request "POST" "/forwarder/execute" '{
  "userAddress": "0xE3240ff264BEf46e9E87E056f4c8098A4Aec5927",
  "functionSignature": "0x12345678",
  "sigR": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "sigS": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "sigV": 27,
  "value": "0"
}' "Execute Meta Transaction"

make_request "GET" "/forwarder/nonce/0xE3240ff264BEf46e9E87E056f4c8098A4Aec5927" "" "Get Nonce"

# Final blockchain activity check
echo "📊 FINAL BLOCKCHAIN ACTIVITY CHECK"
echo "----------------------------------"
make_request "GET" "/main/blockchain-activity" "" "Check All Logged Transactions"

echo "🎉 API Testing Complete!"
echo "========================"
echo ""
echo "📝 Note: Some transactions may fail due to contract issues,"
echo "   but they should all be logged in the blockchain activity collection."
echo ""
echo "🔍 Check the blockchain activity endpoint to verify all transactions"
echo "   (both successful and failed) are being logged to MongoDB."
