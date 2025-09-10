# TrataTech API Server

Express TypeScript API server for TrataTech smart contracts with MongoDB and IPFS integration, supporting Polygon Amoy (testnet) and Polygon Mainnet.

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- MongoDB (local installation)
- Pinata IPFS account
- Polygon wallet with testnet/mainnet tokens

### 1. Installation

```bash
# Clone and install dependencies
git clone <repository-url>
cd contracts-2
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp env.example .env

# Edit .env with your configuration
nano .env
```

**Required Environment Variables:**

```env
# Server Configuration

```

### 3. Database Setup

```bash
# Start MongoDB (if not running)
brew services start mongodb-community
# or
sudo systemctl start mongod

# Verify connection
npm run dev
```

### 4. Smart Contract Deployment

#### Deploy to Polygon Amoy (Testnet)

```bash
# Switch to Amoy network
npm run switch:amoy

# Deploy contracts
npm run deploy polygon-amoy

# Verify deployment
npm run verify:amoy
```

#### Deploy to Polygon Mainnet

```bash
# Switch to Mainnet
npm run switch:mainnet

# Deploy contracts
npm run deploy polygon-mainnet

# Verify deployment
npm run verify:mainnet
```

### 5. Update Environment with Contract Addresses

```bash
# Automatically update .env with deployed addresses
npm run update-env
```

### 6. Start the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm run build
npm start
```

## 📋 Available Scripts

### Development

- `npm run dev` - Start development server with nodemon
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run compile` - Compile smart contracts

### Network Management

- `npm run setup` - Setup network configurations
- `npm run switch:amoy` - Switch to Polygon Amoy network
- `npm run switch:mainnet` - Switch to Polygon Mainnet network

### Deployment

- `npm run deploy polygon-amoy` - Deploy to Polygon Amoy
- `npm run deploy polygon-mainnet` - Deploy to Polygon Mainnet
- `npm run update-env` - Update .env with contract addresses
- `npm run verify:amoy` - Verify contracts on Amoy
- `npm run verify:mainnet` - Verify contracts on Mainnet

### Code Quality

- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## 🏗️ Smart Contracts

The system deploys the following contracts:

1. **TrataTechSecurityEnhanced** - Security library
2. **ERC2771Forwarder** - Gasless transaction forwarder
3. **TrataTechMain_Fixed** - Main contract
4. **TrataTechProductPassport_Fixed** - Product passport management
5. **TrataTechOwnershipRegistry_Fixed** - Ownership tracking
6. **TrataTechProvenance_Fixed** - Supply chain provenance

## 🔌 API Endpoints

### Health Check

- `GET /health` - Server health status
- `GET /health/db` - Database connection status
- `GET /health/ipfs` - IPFS connection status
- `GET /health/blockchain` - Blockchain connection status

### API Key Management

- `POST /api/apikey/create` - Create new API key
- `GET /api/apikey/list` - List API keys
- `DELETE /api/apikey/:id` - Delete API key

### Smart Contract APIs

All contract APIs require `X-API-Key` header for authentication.

#### TrataTechMain

- `POST /api/main/registerProduct`
- `GET /api/main/getProduct/:id`
- `GET /api/main/getAllProducts`

#### Product Passport

- `POST /api/passport/createPassport`
- `GET /api/passport/getPassport/:id`
- `PUT /api/passport/updatePassport/:id`

#### Ownership Registry

- `POST /api/ownership/transferOwnership`
- `GET /api/ownership/getOwnership/:id`
- `GET /api/ownership/getOwnershipHistory/:id`

#### Provenance

- `POST /api/provenance/addProvenanceRecord`
- `GET /api/provenance/getProvenance/:id`
- `GET /api/provenance/getProvenanceHistory/:id`

#### Forwarder (Gasless Transactions)

- `POST /api/forwarder/execute`
- `POST /api/forwarder/batchExecute`

## 🔧 Configuration

### Network Configuration

The system supports two networks:

- **Polygon Amoy** (Testnet) - Chain ID: 80002
- **Polygon Mainnet** - Chain ID: 137

Switch networks using:

```bash
npm run switch:amoy    # Switch to testnet
npm run switch:mainnet # Switch to mainnet
```

### IPFS Configuration

Uses Pinata IPFS service:

- Upload files and JSON data
- Automatic pinning
- Gateway access for retrieval

### Database Schema

MongoDB collections:

- `apikeys` - API key management
- `transactions` - Blockchain transaction records
- `ipfsdata` - IPFS metadata and hashes

## 🚨 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**

   ```bash
   # Check if MongoDB is running
   brew services list | grep mongodb
   # Start if not running
   brew services start mongodb-community
   ```

2. **IPFS Connection Failed**

   - Verify `PINATA_JWT` in `.env`
   - Check Pinata account status
   - Ensure gateway URL is correct

3. **Blockchain Connection Failed**

   - Verify RPC URLs in `.env`
   - Check network configuration
   - Ensure sufficient wallet balance

4. **Contract Deployment Failed**
   - Verify `PRIVATE_KEY` is correct
   - Check wallet has sufficient tokens
   - Ensure network is properly configured

### Logs

Check server logs for detailed error information:

```bash
# Development logs
npm run dev

# Production logs
npm start
```

## 📝 Postman Collection

Import the provided Postman collection to test all API endpoints:

- Health check endpoints
- API key management
- Smart contract interactions
- IPFS operations

## 🔐 Security

- API key authentication for all smart contract endpoints
- Input validation using Zod schemas
- Rate limiting on all endpoints
- CORS protection
- Helmet security headers

## 📊 Monitoring

The server provides comprehensive health checks:

- Database connectivity
- IPFS service status
- Blockchain network status
- Contract interaction capabilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:

1. Check the troubleshooting section
2. Review server logs
3. Verify environment configuration
4. Create an issue with detailed information

---

**Note**: Always test on Polygon Amoy testnet before deploying to mainnet. Ensure you have sufficient tokens for gas fees on the target network.

# Update your .env file with these addresses:

T_R_A_T_A_T_E_C_H_S_E_C_U_R_I_T_Y_E_N_H_A_N_C_E_D_ADDRESS=0xcf92825D614649A48806367F3c67a88CF09087f7
E_R_C2771_F_O_R_W_A_R_D_E_R_ADDRESS=0x67811FE241EE9f64E44c8100373641393339844A
T_R_A_T_A_T_E_C_H_M_A_I_N_ADDRESS=0xe4FcF814BE4336F3c32f43599E1331D27E0678aB
T_R_A_T_A_T_E_C_H_P_R_O_D_U_C_T_P_A_S_S_P_O_R_T_ADDRESS=0x24eb0DdB892eE3F81371b58020BaA095d63DFeF3
T_R_A_T_A_T_E_C_H_O_W_N_E_R_S_H_I_P_R_E_G_I_S_T_R_Y_ADDRESS=0xf99b8DFDF21b4782E83A660A332329Ef0E1d7225
T_R_A_T_A_T_E_C_H_P_R_O_V_E_N_A_N_C_E_ADDRESS=0x49AbBd40324ce9A3aE29D6AB361B31E1B1bdb94f
