#!/bin/bash

# TrataTech Smart Contract Deployment Script
# Usage: ./deploy.sh [amoy|mainnet]

set -e

NETWORK=${1:-amoy}

echo "🚀 TrataTech Smart Contract Deployment"
echo "======================================"

if [ "$NETWORK" = "amoy" ]; then
    echo "📍 Deploying to Polygon Amoy Testnet"
    echo "⚠️  This will deploy to TESTNET only"
    echo ""
    read -p "Continue with Amoy testnet deployment? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔨 Starting deployment..."
        npx hardhat run scripts/deploy-amoy.js --network polygonAmoy
        
        # Find the latest deployment file
        DEPLOYMENT_FILE=$(ls -t deployments/deployment-upgradeable-polygonAmoy-*.json 2>/dev/null | head -n1)
        
        if [ -n "$DEPLOYMENT_FILE" ]; then
            echo "✅ Deployment completed! Check $DEPLOYMENT_FILE for details."
            echo "🔧 Environment variables have been automatically updated in .env file."
        else
            echo "❌ No deployment file found. Check the deployment logs."
        fi
    else
        echo "❌ Deployment cancelled."
    fi
    
elif [ "$NETWORK" = "mainnet" ]; then
    echo "📍 Deploying to Polygon Mainnet"
    echo "⚠️  WARNING: This will deploy to MAINNET!"
    echo "⚠️  Make sure you have sufficient MATIC for gas fees!"
    echo "⚠️  This action cannot be undone!"
    echo ""
    read -p "Are you absolutely sure you want to deploy to MAINNET? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔨 Starting mainnet deployment..."
        npx hardhat run scripts/deploy-mainnet.js --network polygon
        
        # Find the latest deployment file
        DEPLOYMENT_FILE=$(ls -t deployments/deployment-upgradeable-polygonMainnet-*.json 2>/dev/null | head -n1)
        
        if [ -n "$DEPLOYMENT_FILE" ]; then
            echo "✅ Mainnet deployment completed! Check $DEPLOYMENT_FILE for details."
            echo "🔧 Environment variables have been automatically updated in .env file."
            echo "🔍 Consider verifying contracts on Polygonscan."
        else
            echo "❌ No deployment file found. Check the deployment logs."
        fi
    else
        echo "❌ Mainnet deployment cancelled."
    fi
    
else
    echo "❌ Invalid network. Use 'amoy' or 'mainnet'"
    echo "Usage: ./deploy.sh [amoy|mainnet]"
    exit 1
fi

echo ""
echo "🔧 Next Steps:"
echo "1. Update your PRIVATE_KEY in .env file"
echo "2. Update your PINATA_JWT and PINATA_GATEWAY if needed"
echo "3. Restart your API server: npm run dev"
echo "4. Test the contracts with your API"
echo ""
echo "📚 For more details, see DEPLOYMENT_GUIDE.md"
