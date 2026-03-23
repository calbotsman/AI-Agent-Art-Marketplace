import pkg from 'hardhat';
import fs from 'node:fs';
const { ethers } = pkg;

async function main() {
  console.log('🚀 Deploying EndlessMoltAuction...');

  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  // Deploy Auction Contract
  const Auction = await ethers.getContractFactory('EndlessMoltAuction');
  const auction = await Auction.deploy();
  await auction.waitForDeployment();
  const auctionAddress = await auction.getAddress();
  console.log('✅ EndlessMoltAuction deployed to:', auctionAddress);

  // Save all addresses
  const addresses = {
    network: 'sepolia',
    nft: '0xCB775D441729eD900DCD8766F4ae130D8613bAe2',
    marketplace: '0xD0834204Bde70B789d26DBA7B81591a793718B18', 
    auction: auctionAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    'deployments/sepolia-addresses.json',
    JSON.stringify(addresses, null, 2)
  );

  console.log('\n🎉 ALL CONTRACTS DEPLOYED!');
  console.log('════════════════════════════════════════');
  console.log(`NFT:         ${addresses.nft}`);
  console.log(`Marketplace: ${addresses.marketplace}`);
  console.log(`Auction:     ${addresses.auction}`);
  console.log('════════════════════════════════════════');
  console.log('\nNext: Update .env.local and re-enable Web3!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
