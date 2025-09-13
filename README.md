# TrataTech Smart Contract

A comprehensive smart contract for the TrataTech platform that handles all application flows including event invites, product launches, digital product passports, digital art drops, and offers/coupons.

## 🚀 Features

### 1. Event Invites Flow
- **Create Events**: Brands can create event invites with metadata stored on IPFS
- **RSVP System**: Users can RSVP and receive NFT tickets
- **Attendance Tracking**: On-chain verification of event attendance
- **Event Management**: Cancel events and manage attendee limits

### 2. Product Launch Flow
- **Early Access**: Grant early access tokens to users
- **Pre-orders**: Accept pre-orders with ETH payments
- **Launch Management**: Control launch dates and access periods
- **Metadata Storage**: Store product information on IPFS

### 3. Digital Product Passport (DPP) Flow
- **DPP Creation**: Create digital product passports with integrity verification
- **Metadata Storage**: Store DPP data on IPFS with CID tracking
- **Validation**: Invalidate DPPs when needed
- **Provenance**: Track creation timestamps and creators

### 4. Digital Art Drop Flow
- **Art Drops**: Create limited or unlimited edition art drops
- **Airdrops**: Distribute NFTs to eligible users
- **Edition Control**: Manage maximum editions and distribution
- **Metadata**: Store artwork information on IPFS

### 5. Offers Flow
- **Offer Creation**: Create discount offers and coupons
- **Merkle Trees**: Support for whitelisted offers using Merkle proofs
- **Redemption Tracking**: Track offer redemptions and limits
- **Expiration**: Automatic offer expiration handling

## 🔧 Technical Features

### Security
- **Reentrancy Protection**: All external calls protected
- **Access Control**: Role-based permissions for brands and operators
- **Emergency Stop**: Circuit breaker pattern for emergency situations
- **Pausable**: Ability to pause contract operations
- **Input Validation**: Comprehensive parameter validation

### Gas Optimization
- **Efficient Storage**: Optimized data structures
- **Batch Operations**: Support for batch airdrops
- **Gas Estimation**: Built-in gas optimization settings

### Advanced Features
- **Merkle Proofs**: For efficient whitelist verification
- **IPFS Integration**: All metadata stored on IPFS
- **NFT Standards**: Full ERC721 compliance with extensions
- **Event Logging**: Comprehensive event emission for tracking

## 📁 Project Structure

```
tratatech-smart-contract/
├── contracts/
│   └── TrataTechMain.sol          # Main smart contract
├── scripts/
│   └── deploy.js                  # Deployment script
├── hardhat.config.js              # Hardhat configuration
├── package.json                   # Dependencies
├── env.example                    # Environment variables template
└── README.md                      # This file
```

## 🛠 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Hardhat

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tratatech-smart-contract
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Compile contracts**
   ```bash
   npm run compile
   ```

## 🚀 Deployment

### Environment Setup
1. Copy `.env.example` to `.env`
2. Set your `PRIVATE_KEY` (without 0x prefix)
3. Set your `POLYGONSCAN_API_KEY`
4. Configure RPC URLs if needed

### Polygon Amoy Testnet (Recommended for Testing)
```bash
# Set network in .env
NETWORK=polygon-amoy

# Deploy basic contracts
npm run deploy:amoy

# Deploy advanced contracts
npm run deploy:advanced:amoy

# Deploy upgradeable contracts
npm run deploy:upgradeable:amoy
```

### Polygon Mainnet (Production)
```bash
# Set network in .env
NETWORK=polygon

# Deploy basic contracts
npm run deploy:polygon

# Deploy advanced contracts
npm run deploy:advanced:polygon

# Deploy upgradeable contracts
npm run deploy:upgradeable:polygon
```

### Quick Setup Script (Amoy Testnet)
```bash
chmod +x scripts/setup-amoy.sh
./scripts/setup-amoy.sh
```

## 📋 Usage Examples

### Creating an Event
```javascript
const eventId = await contract.createEventInvite(
    "Tech Conference 2024",
    "Annual technology conference",
    Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
    100, // max attendees
    "QmX...", // IPFS CID
    { from: brandAddress }
);
```

### RSVP for Event
```javascript
await contract.submitRSVP(eventId, { from: userAddress });
```

### Creating a Product Launch
```javascript
const launchId = await contract.createProductLaunch(
    "New Product",
    "Product description",
    Math.floor(Date.now() / 1000) + 604800, // 7 days from now
    Math.floor(Date.now() / 1000) + 259200, // 3 days from now
    50, // max early access
    "QmY...", // IPFS CID
    { from: brandAddress }
);
```

### Granting Early Access
```javascript
await contract.grantEarlyAccess(launchId, userAddress, { from: brandAddress });
```

### Creating a Digital Product Passport
```javascript
const dppId = await contract.createDPP(
    "PROD-001",
    "BRAND-001",
    "QmZ...", // IPFS CID
    "0xabc...", // metadata hash
    { from: brandAddress }
);
```

### Creating an Art Drop
```javascript
const dropId = await contract.createArtDrop(
    "Artist Name",
    "Artwork Title",
    1, // edition
    100, // max editions
    "QmW...", // IPFS CID
    { from: brandAddress }
);
```

### Airdropping Art
```javascript
await contract.airdropArtwork(dropId, [user1, user2, user3], { from: operatorAddress });
```

### Creating an Offer
```javascript
const offerId = await contract.createOffer(
    "20% Off Sale",
    2000, // 20% discount in basis points
    Math.floor(Date.now() / 1000), // valid from now
    Math.floor(Date.now() / 1000) + 259200, // valid for 3 days
    "All Products",
    "Valid for first-time customers",
    "QmV...", // IPFS CID
    false, // not Merkle-based
    "0x000...", // empty Merkle root
    100, // max redemptions
    { from: brandAddress }
);
```

### Redeeming an Offer
```javascript
await contract.redeemOffer(offerId, [], { from: userAddress });
```

## 🔐 Access Control

### Roles
- **Owner**: Contract owner with full administrative privileges
- **Authorized Brands**: Can create events, launches, DPPs, art drops, and offers
- **Authorized Operators**: Can perform airdrops and other operational tasks

### Authorization Functions
```javascript
// Authorize a brand
await contract.authorizeBrand(brandAddress, { from: ownerAddress });

// Authorize an operator
await contract.authorizeOperator(operatorAddress, { from: ownerAddress });

// Revoke authorization
await contract.revokeBrand(brandAddress, { from: ownerAddress });
```

## 🛡 Security Features

### Emergency Controls
```javascript
// Activate emergency stop
await contract.activateEmergencyStop({ from: ownerAddress });

// Deactivate emergency stop
await contract.deactivateEmergencyStop({ from: ownerAddress });

// Pause contract
await contract.pause({ from: ownerAddress });

// Unpause contract
await contract.unpause({ from: ownerAddress });
```

### Fee Management
```javascript
// Set platform fee (in basis points)
await contract.setPlatformFee(250, { from: ownerAddress }); // 2.5%

// Withdraw fees
await contract.withdrawFees({ from: ownerAddress });
```

## 📊 View Functions

### Event Information
```javascript
const eventDetails = await contract.getEventDetails(eventId);
const isRSVPd = await contract.isUserRSVPd(eventId, userAddress);
const tokenId = await contract.getUserEventToken(eventId, userAddress);
```

### Launch Information
```javascript
const launchDetails = await contract.getLaunchDetails(launchId);
const hasAccess = await contract.hasEarlyAccess(launchId, userAddress);
const preOrderAmount = await contract.getUserPreOrder(launchId, userAddress);
```

### DPP Information
```javascript
const dppDetails = await contract.getDPPDetails(dppId);
```

### Art Drop Information
```javascript
const dropDetails = await contract.getDropDetails(dropId);
const hasAirdrop = await contract.hasReceivedAirdrop(dropId, userAddress);
```

### Offer Information
```javascript
const offerDetails = await contract.getOfferDetails(offerId);
const hasRedeemed = await contract.hasRedeemedOffer(offerId, userAddress);
const redemptionCount = await contract.getUserOfferRedemptions(offerId, userAddress);
```

## 🧪 Testing

```bash
npm run test
```

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For support and questions, please contact the development team.

---

**Note**: This smart contract is designed for production use on the Polygon network. Always test thoroughly on testnets before deploying to mainnet. 