/**
 * Deploy all contracts to Sepolia testnet
 */

import { ethers } from 'hardhat';

async function main() {
  console.log('🚀 Deploying Endless Molt contracts to Sepolia...\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH\n');

  if (balance < ethers.parseEther('0.1')) {
    console.error('❌ Insufficient balance! Need at least 0.1 Sepolia ETH');
    console.log('\nGet Sepolia ETH from:');
    console.log('- https://sepoliafaucet.com/');
    console.log('- https://www.infura.io/faucet/sepolia');
    console.log(`\nYour address: ${deployer.address}`);
    process.exit(1);
  }

  //1. Deploy NFT Contract
  console.log('📝 Deploying EndlessMoltNFT...');
  const NFT = await ethers.getContractFactory('EndlessMoltNFT');
  const nft = await NFT.deploy();
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log('✅ EndlessMoltNFT deployed to:', nftAddress);

  // 2. Deploy Marketplace Contract
  console.log('\n📝 Deploying EndlessMoltMarketplace...');
  const Marketplace = await ethers.getContractFactory('EndlessMoltMarketplace');
  const marketplace = await Marketplace.deploy(nftAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log('✅ EndlessMoltMarketplace deployed to:', marketplaceAddress);

  // 3. Deploy Auction Contract
  console.log('\n📝 Deploying EndlessMoltAuction...');
  const Auction = await ethers.getContractFactory('EndlessMoltAuction');
  const auction = await Auction.deploy(nftAddress);
  await auction.waitForDeployment();
  const auctionAddress = await auction.getAddress();
  console.log('✅ EndlessMoltAuction deployed to:', auctionAddress);

  // Save deployment addresses
  const fs = require('fs');
  const addresses = {
    network: 'sepolia',
    nft: nftAddress,
    marketplace: marketplaceAddress,
    auction: auctionAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    'deployments/sepolia-addresses.json',
    JSON.stringify(addresses, null, 2)
  );

  console.log('\n📋 Deployment Summary:');
  console.log('════════════════════════════════════════');
  console.log(`NFT:         ${nftAddress}`);
  console.log(`Marketplace: ${marketplaceAddress}`);
  console.log(`Auction:     ${auctionAddress}`);
  console.log('════════════════════════════════════════');

  console.log('\n✅ Deployment complete!');
  console.log('\nNext steps:');
  console.log('1. Verify contracts: npm run verify:sepolia');
  console.log('2. Update .env.local with addresses');
  console.log(`3. View on Etherscan: https://sepolia.etherscan.io/address/${nftAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
