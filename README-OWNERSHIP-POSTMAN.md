# TrataTech Ownership API - Postman Collection

This document provides comprehensive instructions for using the TrataTech Ownership API Postman collection.

## 📁 Files Included

1. **`TrataTech_Ownership_Collection.postman_collection.json`** - Complete Postman collection
2. **`TrataTech_Ownership_Environment.postman_environment.json`** - Environment variables
3. **`README-OWNERSHIP-POSTMAN.md`** - This documentation

## 🚀 Quick Start

### 1. Import Collection and Environment

1. Open Postman
2. Click **Import** button
3. Import both files:
   - `TrataTech_Ownership_Collection.postman_collection.json`
   - `TrataTech_Ownership_Environment.postman_environment.json`
4. Select the **TrataTech Ownership Environment** from the environment dropdown

### 2. Start Your Server

Make sure your TrataTech server is running:

```bash
npm start
# or
node src/server.ts
```

## 🔑 API Keys & Authentication

The collection includes these pre-configured API keys:

| Role          | API Key                 | Wallet Address  | Permissions                         |
| ------------- | ----------------------- | --------------- | ----------------------------------- |
| **Admin**     | `admin-api-key-123`     | `0x1234...7890` | Full access to all endpoints        |
| **Operator**  | `operator-api-key-789`  | `0x9876...3210` | Can create deeds, transfer requests |
| **User**      | `user-api-key-456`      | `0xabcd...abcd` | Basic read access                   |
| **Certifier** | `certifier-api-key-123` | `0x1111...1111` | Can create certificates             |

### Changing API Keys

1. In Postman, go to the **TrataTech Ownership Environment**
2. Update the `admin_api_key`, `operator_api_key`, etc. variables
3. Or modify the collection-level auth settings

## 📋 API Endpoints Overview

### Ownership Deeds

| Method   | Endpoint                   | Description                   | Required Role                  |
| -------- | -------------------------- | ----------------------------- | ------------------------------ |
| `POST`   | `/deeds`                   | Create ownership deed         | admin, operator, transferAgent |
| `GET`    | `/deeds/{deedId}`          | Get deed details              | Any authenticated user         |
| `POST`   | `/deeds/{deedId}/transfer` | Transfer ownership            | Deed owner                     |
| `POST`   | `/deeds/{deedId}/lock`     | Lock deed (prevent transfers) | Deed owner                     |
| `POST`   | `/deeds/{deedId}/unlock`   | Unlock deed (allow transfers) | Deed owner                     |
| `POST`   | `/deeds/{deedId}/royalty`  | Set royalty information       | Deed owner                     |
| `DELETE` | `/deeds/{deedId}/royalty`  | Disable royalty               | Deed owner                     |

### Transfer Requests

| Method | Endpoint                                 | Description              | Required Role                  |
| ------ | ---------------------------------------- | ------------------------ | ------------------------------ |
| `POST` | `/transfer-requests`                     | Create transfer request  | admin, operator, transferAgent |
| `GET`  | `/transfer-requests/{requestId}`         | Get request details      | Any authenticated user         |
| `POST` | `/transfer-requests/{requestId}/approve` | Approve request          | Deed owner                     |
| `POST` | `/transfer-requests/{requestId}/reject`  | Reject request           | Deed owner                     |
| `POST` | `/transfer-requests/{requestId}/execute` | Execute approved request | Requester                      |

## 🧪 Testing Workflow

### Complete Ownership Lifecycle Test

1. **Create Ownership Deed**

   ```
   POST /deeds
   ```

   - Use admin API key
   - Creates deed for passport ID 1
   - Note the returned deed ID

2. **Get Deed Details**

   ```
   GET /deeds/{deedId}
   ```

   - Verify deed was created correctly

3. **Create Transfer Request**

   ```
   POST /transfer-requests
   ```

   - Use operator API key
   - Creates request for the deed
   - Note the returned request ID

4. **Approve Transfer Request**

   ```
   POST /transfer-requests/{requestId}/approve
   ```

   - Use deed owner's API key
   - Approves the transfer request

5. **Execute Transfer**

   ```
   POST /transfer-requests/{requestId}/execute
   ```

   - Use requester's API key
   - Executes the approved transfer

6. **Set Royalty**
   ```
   POST /deeds/{deedId}/royalty
   ```
   - Use new owner's API key
   - Sets 5% royalty

### Lock/Unlock Testing

1. **Lock Deed**

   ```
   POST /deeds/{deedId}/lock
   ```

   - Prevents any transfers

2. **Unlock Deed**
   ```
   POST /deeds/{deedId}/unlock
   ```
   - Allows transfers again

## 🔧 Environment Variables

| Variable             | Default Value                            | Description                    |
| -------------------- | ---------------------------------------- | ------------------------------ |
| `base_url`           | `http://localhost:3005/api/v1/ownership` | API base URL                   |
| `deed_id`            | `1`                                      | Default deed ID for testing    |
| `request_id`         | `1`                                      | Default request ID for testing |
| `passport_id`        | `1`                                      | Default passport ID            |
| `owner_address`      | `0x1234...7890`                          | Default owner address          |
| `new_owner_address`  | `0xabcd...abcd`                          | Default new owner address      |
| `purchase_price`     | `1000000000000000000`                    | 1 ETH in wei                   |
| `proposed_price`     | `1200000000000000000`                    | 1.2 ETH in wei                 |
| `royalty_percentage` | `5.0`                                    | 5% royalty                     |

## 📝 Sample Request Bodies

### Create Ownership Deed

```json
{
  "passportId": 1,
  "ownerAddress": "0x1234567890123456789012345678901234567890",
  "purchaseDate": 1640995200,
  "purchasePrice": "1000000000000000000",
  "ipfsData": {
    "metadata": {
      "name": "Premium Watch Ownership Deed",
      "description": "Official ownership deed for Premium Watch #PWC001234567",
      "image": "https://example.com/ownership-deed.jpg",
      "attributes": [
        {
          "trait_type": "Deed Type",
          "value": "Ownership Certificate"
        },
        {
          "trait_type": "Product",
          "value": "Premium Chronograph"
        }
      ]
    }
  }
}
```

### Create Transfer Request

```json
{
  "deedId": 1,
  "requesterAddress": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  "proposedPrice": "1200000000000000000",
  "reason": "Purchase offer for luxury watch collection",
  "expirationDate": 1641081600
}
```

### Set Royalty

```json
{
  "receiver": "0x1111111111111111111111111111111111111111",
  "percentage": 5.0
}
```

## 🚨 Error Handling

The API returns structured error responses:

```json
{
  "success": false,
  "message": "Error description",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/ownership/deeds",
  "method": "POST"
}
```

Common error scenarios:

- **401 Unauthorized**: Invalid or missing API key
- **403 Forbidden**: Insufficient permissions
- **400 Bad Request**: Validation errors
- **404 Not Found**: Deed or request not found

## 🔍 Debugging Tips

1. **Check Server Logs**: Monitor your server console for detailed error messages
2. **Verify API Keys**: Ensure you're using the correct API key for the required role
3. **Validate Addresses**: Make sure Ethereum addresses are valid (42 characters, starts with 0x)
4. **Check Timestamps**: Ensure dates are Unix timestamps (seconds since epoch)
5. **Verify Deed Ownership**: Some operations require the caller to be the deed owner

## 📊 Response Examples

### Successful Deed Creation

```json
{
  "success": true,
  "message": "Ownership deed created successfully",
  "data": {
    "transactionHash": "0x...",
    "deedData": { ... },
    "ipfsCID": "bafkreig..."
  }
}
```

### Successful Transfer Request

```json
{
  "success": true,
  "message": "Transfer request created successfully",
  "data": {
    "transactionHash": "0x...",
    "requestData": { ... }
  }
}
```

## 🎯 Best Practices

1. **Use Environment Variables**: Always use environment variables for dynamic values
2. **Test in Order**: Follow the complete workflow for comprehensive testing
3. **Verify Responses**: Check that responses contain expected data
4. **Handle Errors**: Implement proper error handling in your tests
5. **Clean Up**: Consider adding cleanup requests to remove test data

## 🔗 Related Collections

- **TrataTech Product Passport Collection**: For managing product passports
- **TrataTech Admin Collection**: For administrative operations
- **TrataTech Business Collection**: For business operations

## 📞 Support

If you encounter issues:

1. Check the server logs for detailed error messages
2. Verify your environment variables are set correctly
3. Ensure the server is running and accessible
4. Check that you have the required permissions for the operations you're trying to perform

---

**Happy Testing! 🚀**
