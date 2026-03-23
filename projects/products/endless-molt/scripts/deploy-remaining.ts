/**
 * Deploy remaining contracts (Marketplace + Auction)
 * NFT already deployed to: 0xCB775D441729eD900DCD8766F4ae130D8613bAe2
 */

import pkg from 'hardhat';
import fs from 'node:fs';
const { ethers } = pkg;

async function main() {
  console.log('🚀 Deploying remaining Endless Molt contracts...\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH\n');

  // NFT already deployed
  const nftAddress = '0xCB775D441729eD900DCD8766F4ae130D8613bAe2';
  console.log('Using existing NFT contract:', nftAddress);

  // 2. Deploy Marketplace Contract
  console.log('\n📝 Deploying EndlessMoltMarketplace...');
  const Marketplace = await ethers.getContractFactory('EndlessMoltMarketplace');
  const marketplace = await Marketplace.deploy();
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log('✅ EndlessMoltMarketplace deployed to:', marketplaceAddress);

  // 3. Deploy Auction Contract
  console.log('\n📝 Deploying EndlessMoltAuction...');
  const Auction = await ethers.getContractFactory('EndlessMoltAuction');
  const auction = await Auction.deploy();
  await auction.waitForDeployment();
  const auctionAddress = await auction.getAddress();
  console.log('✅ EndlessMoltAuction deployed to:', auctionAddress);

  // Save deployment addresses
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
