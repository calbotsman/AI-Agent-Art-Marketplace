import fs from 'node:fs';
import { ethers } from 'hardhat';

async function main() {
  console.log('Starting NFT-only deployment...');

  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const isMainnet = chainId === 1;
  const isSepolia = chainId === 11155111;

  if (isMainnet && (!process.env.MAINNET_RPC_URL || process.env.MAINNET_RPC_URL.includes('YOUR-API-KEY'))) {
    throw new Error(
      "Missing MAINNET_RPC_URL (or it's still the placeholder). Set MAINNET_RPC_URL before deploying."
    );
  }
  if (isSepolia && (!process.env.SEPOLIA_RPC_URL || process.env.SEPOLIA_RPC_URL.includes('YOUR-API-KEY'))) {
    throw new Error(
      "Missing SEPOLIA_RPC_URL (or it's still the placeholder). Set SEPOLIA_RPC_URL before deploying."
    );
  }
  if (!process.env.DEPLOYER_PRIVATE_KEY && !process.env.PRIVATE_KEY) {
    throw new Error('Missing deployer key. Set DEPLOYER_PRIVATE_KEY or PRIVATE_KEY before deploying.');
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log('Deploying NFT with account:', deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH');

  const NFTFactory = await ethers.getContractFactory('EndlessMoltNFT');
  const nft = await NFTFactory.deploy();
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();

  console.log('✅ EndlessMoltNFT deployed to:', nftAddress);

  const deploymentInfo = {
    network: network.name,
    chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      EndlessMoltNFT: nftAddress,
    },
  };

  fs.mkdirSync('./deployments', { recursive: true });
  const deploymentPath = `./deployments/${network.name}-nft.json`;
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  console.log('Deployment info saved to:', deploymentPath);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
