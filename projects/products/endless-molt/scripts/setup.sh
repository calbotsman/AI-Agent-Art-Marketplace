#!/bin/bash

# Smart Contract Setup Script
# This script installs dependencies and sets up Hardhat for the Endless Molt NFT marketplace

set -e

echo "=================================================="
echo "Endless Molt Smart Contract Setup"
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json not found. Please run this script from the project root."
  exit 1
fi

# Install Hardhat and dependencies
echo "📦 Installing Hardhat and dependencies..."
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts ethers dotenv

echo ""
echo "✅ Dependencies installed successfully!"
echo ""

# Create deployments directory
mkdir -p deployments

echo "📁 Created deployments directory"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
  echo "⚠️  Warning: .env.local not found"
  echo "   Creating from .env.local.example..."
  cp .env.local.example .env.local
  echo "   ✅ Please update .env.local with your API keys"
else
  echo "✅ .env.local already exists"
fi

echo ""
echo "=================================================="
echo "Setup Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Update .env.local with your API keys:"
echo "   - SEPOLIA_RPC_URL (from Alchemy/Infura)"
echo "   - DEPLOYER_PRIVATE_KEY (your wallet's private key)"
echo "   - ETHERSCAN_API_KEY (for contract verification)"
echo ""
echo "2. Compile contracts:"
echo "   npm run compile"
echo ""
echo "3. Run tests:"
echo "   npm run test:contracts"
echo ""
echo "4. Deploy to Sepolia testnet:"
echo "   npm run deploy:sepolia"
echo ""
echo "5. Verify contracts on Etherscan:"
echo "   npx hardhat verify --network sepolia <CONTRACT_ADDRESS>"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT_GUIDE.md"
echo ""
