# TrataTech Smart Contract - Gasless & Upgradeable Implementation

This implementation adds gasless transactions (meta-transactions) and upgradeability to the TrataTech smart contracts while preserving all existing functionality.

## Features Added

### 1. **Upgradeability (UUPS Pattern)**
- Uses OpenZeppelin's UUPS (Universal Upgradeable Proxy Standard)
- Allows contract logic updates without changing the contract address
- Preserves state and user interactions across upgrades
- More gas-efficient than transparent proxy pattern

### 2. **Gasless Transactions (ERC-2771)**
- Implements ERC-2771 for native meta-transaction support
- Users can interact with the contract without holding ETH
- Supports multiple relay providers (Biconomy, Gelato, Defender)
- Transaction fees can be sponsored by the platform

## Architecture

```
User → Relayer → Forwarder → Proxy → Implementation Contract
```

### Components:
- **Proxy Contract**: Holds the state and delegates calls to implementation
- **Implementation Contract**: Contains the business logic (upgradeable)
- **Forwarder Contract**: Verifies meta-transaction signatures
- **Relayer Service**: Submits transactions on behalf of users

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required configurations:
- `PRIVATE_KEY`: Deployer wallet private key
- `POLYGON_RPC_URL`: Polygon mainnet RPC
- `POLYGON_AMOY_RPC_URL`: Polygon testnet RPC
- Gasless provider credentials (Biconomy/Gelato/Defender)

### 3. Deploy Upgradeable Contract

```bash
# Deploy to Polygon Amoy (testnet)
npx hardhat run scripts/deploy-main-upgradeable.js --network polygonAmoy

# Deploy to Polygon mainnet
npx hardhat run scripts/deploy-main-upgradeable.js --network polygon
```

### 4. Upgrade Contract (When Needed)

```bash
# Upgrade on Polygon Amoy
npx hardhat run scripts/upgrade-main.js --network polygonAmoy

# Upgrade on Polygon mainnet
npx hardhat run scripts/upgrade-main.js --network polygon
```

## Gasless Transaction Setup

### Option 1: Biconomy

1. Create account at [Biconomy Dashboard](https://dashboard.biconomy.io)
2. Create a new DApp and get API Key
3. Register your contract and methods
4. Configure in `.env`:
   ```
   USE_BICONOMY=true
   BICONOMY_API_KEY=your_api_key
   BICONOMY_API_ID=your_api_id
   ```

### Option 2: Gelato Relay

1. Visit [Gelato Network](https://relay.gelato.network)
2. Create a sponsor account
3. Get sponsor API key
4. Configure in `.env`:
   ```
   USE_GELATO=true
   GELATO_SPONSOR_API_KEY=your_sponsor_key
   ```

### Option 3: OpenZeppelin Defender

1. Sign up at [OpenZeppelin Defender](https://defender.openzeppelin.com)
2. Create a Relayer
3. Get API credentials
4. Configure in `.env`:
   ```
   USE_DEFENDER=true
   DEFENDER_RELAYER_API_KEY=your_key
   DEFENDER_RELAYER_API_SECRET=your_secret
   ```

## Using Gasless Transactions

### Frontend Integration Example

```javascript
import { ethers } from 'ethers';
import GaslessRelayService from './services/gasless-relay';

// Initialize service
const gaslessService = new GaslessRelayService(
  'polygon',
  contractAddress,
  contractABI
);

// Execute gasless transaction
async function submitGaslessRSVP(eventId) {
  const signer = await provider.getSigner();
  const userAddress = await signer.getAddress();
  
  const result = await gaslessService.executeGasless(
    'submitRSVP',
    [eventId],
    userAddress,
    signer
  );
  
  if (result.success) {
    console.log('Transaction successful:', result.txHash);
  } else {
    console.error('Transaction failed:', result.error);
  }
}
```

## Supported Gasless Methods

The following methods support gasless transactions:
- `createEventInvite`
- `submitRSVP`
- `cancelRSVP`
- `createProductLaunch`
- `grantEarlyAccess`
- `createDPP`
- `createArtDrop`
- `airdropArtwork`
- `createOffer`
- `redeemOffer`

## Contract Addresses

### Forwarder Contracts
- **Polygon Mainnet**:
  - Biconomy: `0x86C80a8aa58e0A4fa09A69624c31Ab2a6CAD56b8`
  - Gelato: `0xd8253782c45a12053594b9deB72d8e8aB2Fca54c`

- **Polygon Amoy Testnet**:
  - Biconomy: `0x69015912AA33720b842dCD6aC059Ed623F28d9f7`
  - Gelato: `0xd8253782c45a12053594b9deB72d8e8aB2Fca54c`

## Security Considerations

1. **Upgrade Security**:
   - Only owner can authorize upgrades
   - UUPS pattern prevents proxy hijacking
   - Storage layout must be preserved across upgrades

2. **Meta-Transaction Security**:
   - EIP-712 signatures prevent replay attacks
   - Nonce management prevents double-spending
   - Trusted forwarder validates signatures

3. **Best Practices**:
   - Always test upgrades on testnet first
   - Audit new implementation before upgrading
   - Monitor relay service for unusual activity
   - Implement spending limits for sponsored gas

## Testing

```bash
# Run all tests
npx hardhat test

# Test upgradeability
npx hardhat test test/upgradeability.test.js

# Test gasless transactions
npx hardhat test test/gasless.test.js
```

## Gas Savings Example

Traditional transaction:
- User pays: ~0.005 MATIC per transaction

Gasless transaction:
- User pays: 0 MATIC
- Platform sponsors: ~0.005 MATIC per transaction

For 1000 users making 10 transactions each:
- Total savings for users: 50 MATIC
- Platform cost: 50 MATIC (can be offset by platform fees)

## Troubleshooting

### Common Issues

1. **"Not authorized brand" error**:
   - Ensure the sender is authorized using `authorizeBrand()`

2. **Upgrade fails**:
   - Check that storage layout is preserved
   - Verify owner account is correct

3. **Gasless transaction fails**:
   - Verify forwarder address is correct
   - Check relay service balance
   - Ensure method is in supported list

## Migration from Non-Upgradeable Contract

If you have an existing deployment:

1. Deploy new upgradeable contract
2. Migrate state (if needed):
   ```javascript
   // Example migration script
   const oldContract = await ethers.getContractAt("TrataTechMain", OLD_ADDRESS);
   const newContract = await ethers.getContractAt("TrataTechMainUpgradeable", NEW_ADDRESS);
   
   // Migrate authorized brands
   // Migrate events, launches, etc.
   ```
3. Update frontend to use new contract address
4. Announce migration to users

## Future Improvements

- [ ] Batch meta-transactions for efficiency
- [ ] Implement upgrade timelock for security
- [ ] Add governance for upgrade decisions
- [ ] Support cross-chain gasless transactions
- [ ] Implement dynamic gas sponsorship rules

## Support

For issues or questions:
- Open an issue on GitHub
- Contact the development team
- Check documentation at [docs.tratatech.com]

## License

MIT