# TrataTech Smart Contract Deployment Guide

This guide will help you deploy the TrataTech smart contracts to either Polygon Amoy Testnet or Polygon Mainnet.

## Prerequisites

1. **Node.js and npm** installed
2. **Hardhat** configured
3. **Private Key** with sufficient MATIC for gas fees
4. **Environment Variables** properly configured

## Quick Start

### For Polygon Amoy Testnet (Recommended for Testing)

```bash
# 1. Deploy contracts to Amoy testnet
npx hardhat run scripts/deploy-amoy.js --network polygonAmoy

# 2. Update environment variables (replace with your deployment file)
node scripts/setup-env-from-deployment.js deployment-upgradeable-polygonAmoy-1234567890.json

# 3. Restart your API server
npm run dev
```

### For Polygon Mainnet (Production)

```bash
# 1. Deploy contracts to Polygon mainnet
npx hardhat run scripts/deploy-mainnet.js --network polygon

# 2. Update environment variables (replace with your deployment file)
node scripts/setup-env-from-deployment.js deployment-upgradeable-polygonMainnet-1234567890.json

# 3. Restart your API server
npm run dev
```

## Detailed Steps

### Step 1: Prepare Your Environment

1. **Update your `.env` file** with your private key:

   ```bash
   PRIVATE_KEY="your_actual_private_key_here"
   ```

2. **Get testnet MATIC** (for Amoy testnet):

   - Visit: https://faucet.polygon.technology/
   - Select "Amoy Testnet"
   - Enter your wallet address
   - Request testnet MATIC tokens

3. **Ensure sufficient mainnet MATIC** (for mainnet):
   - Recommended: At least 10 MATIC for deployment
   - More may be needed depending on gas prices

### Step 2: Deploy Contracts

#### Option A: Deploy to Amoy Testnet

```bash
npx hardhat run scripts/deploy-amoy.js --network polygonAmoy
```

#### Option B: Deploy to Polygon Mainnet

```bash
npx hardhat run scripts/deploy-mainnet.js --network polygon
```

### Step 3: Update Environment Variables

After successful deployment, you'll get a deployment file like:

- `deployment-upgradeable-polygonAmoy-1234567890.json`
- `deployment-upgradeable-polygonMainnet-1234567890.json`

Run the setup script to automatically update your `.env` file:

```bash
node scripts/setup-env-from-deployment.js deployment-upgradeable-polygonAmoy-1234567890.json
```

### Step 4: Test Your Deployment

1. **Restart your API server**:

   ```bash
   npm run dev
   ```

2. **Test the API endpoints**:

   ```bash
   # Test health check
   curl http://localhost:3005/health

   # Test brand registration
   curl -X POST http://localhost:3005/api/v1/product-passport/brands \
     -H "Content-Type: application/json" \
     -H "x-api-key: admin-api-key-123" \
     -d '{
       "name": "Test Brand",
       "description": "Test brand description",
       "website": "https://test.com",
       "authorizedCountries": ["US", "CA"],
       "ipfsData": {
         "metadata": {
           "name": "Test Brand Registration",
           "description": "Test brand registration metadata",
           "attributes": [
             {
               "trait_type": "Type",
               "value": "Test Brand"
             }
           ]
         }
       }
     }'
   ```

## Contract Architecture

The deployment creates the following contracts:

### Core Contracts

- **TrataTechProductPassportUpgradeable**: Manages brands and product passports
- **TrataTechProvenanceUpgradeable**: Tracks product provenance and service records
- **TrataTechOwnershipRegistryUpgradeable**: Manages ownership deeds and transfers
- **TrataTechMainUpgradeable**: Handles business operations (events, launches, art drops, offers)

### Infrastructure Contracts

- **MinimalForwarder**: Enables gasless transactions
- **TrataTechForwarder**: Enhanced forwarder with additional features
- **ProxyAdmin**: Manages proxy upgrades
- **TransparentUpgradeableProxy**: Upgradeable proxy pattern

## Environment Variables

After deployment, your `.env` file will be updated with:

```bash
# Contract Addresses
PRODUCT_PASSPORT_ADDRESS=0x...
PROVENANCE_ADDRESS=0x...
OWNERSHIP_REGISTRY_ADDRESS=0x...
MAIN_CONTRACT_ADDRESS=0x...

# Forwarder Addresses (for gasless transactions)
MINIMAL_FORWARDER_AMOY=0x...  # For Amoy testnet
TRATATECH_FORWARDER_AMOY=0x...  # For Amoy testnet
MINIMAL_FORWARDER_POLYGON=0x...  # For mainnet
TRATATECH_FORWARDER_POLYGON=0x...  # For mainnet
```

## Gasless Transactions

The deployed contracts support gasless transactions through:

1. **TrataTech Forwarders**: Custom forwarders for meta-transactions
2. **Biconomy Integration**: Third-party gasless transaction service
3. **Gelato Relay**: Alternative gasless transaction service

Configure in your `.env`:

```bash
USE_TRATATECH_FORWARDER=true
USE_BICONOMY=false
USE_GELATO=false
```

## Troubleshooting

### Common Issues

1. **"Insufficient funds" error**:

   - Get more testnet MATIC from faucet
   - Ensure sufficient mainnet MATIC for gas fees

2. **"Contract already exists" error**:

   - Use different contract names or deploy to different network
   - Check if contracts are already deployed

3. **"Private key invalid" error**:

   - Ensure private key is correct format (without 0x prefix)
   - Check if private key has sufficient funds

4. **"Network not found" error**:
   - Ensure hardhat.config.js is properly configured
   - Check network configuration in hardhat.config.js

### Getting Help

1. Check the deployment logs for specific error messages
2. Verify your environment variables are correct
3. Ensure you have sufficient MATIC for gas fees
4. Check network connectivity and RPC endpoints

## Security Considerations

### For Testnet

- Use testnet MATIC only
- Test thoroughly before mainnet deployment
- Keep testnet private keys secure

### For Mainnet

- Use hardware wallets for production deployments
- Verify contracts on Polygonscan
- Test all functionality before production use
- Keep mainnet private keys extremely secure
- Consider multi-signature wallets for contract ownership

## Next Steps

After successful deployment:

1. **Verify contracts** on Polygonscan (optional but recommended)
2. **Test all API endpoints** thoroughly
3. **Set up monitoring** for contract events
4. **Configure gasless transactions** if needed
5. **Update your frontend** with new contract addresses
6. **Document the deployment** for your team

## Support

If you encounter issues:

1. Check the deployment logs
2. Verify your environment configuration
3. Ensure sufficient funds for gas fees
4. Test with a simple transaction first
5. Check network connectivity

For additional help, refer to the Hardhat documentation or Polygon network documentation.
