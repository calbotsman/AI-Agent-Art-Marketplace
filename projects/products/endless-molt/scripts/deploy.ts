import fs from 'node:fs';
import { ethers } from "hardhat";

async function main() {
  console.log("Starting deployment...");

  const network = await ethers.provider.getNetwork();
  const isMainnet = Number(network.chainId) === 1;
  const isSepolia = Number(network.chainId) === 11155111;

  // This script is used in automation; fail fast with a clear message when not configured.
  if (isMainnet && (!process.env.MAINNET_RPC_URL || process.env.MAINNET_RPC_URL.includes("YOUR-API-KEY"))) {
    throw new Error(
      "Missing MAINNET_RPC_URL (or it's still the placeholder). Set MAINNET_RPC_URL in .env.local before deploying."
    );
  }
  if (isSepolia && (!process.env.SEPOLIA_RPC_URL || process.env.SEPOLIA_RPC_URL.includes("YOUR-API-KEY"))) {
    throw new Error(
      "Missing SEPOLIA_RPC_URL (or it's still the placeholder). Set SEPOLIA_RPC_URL in .env.local before deploying."
    );
  }
  if (!process.env.DEPLOYER_PRIVATE_KEY && !process.env.PRIVATE_KEY) {
    throw new Error(
      "Missing deployer key. Set DEPLOYER_PRIVATE_KEY in .env.local (PRIVATE_KEY is supported for backwards-compat)."
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Deploy EndlessMoltNFT
  console.log("\n1. Deploying EndlessMoltNFT...");
  const NFTFactory = await ethers.getContractFactory("EndlessMoltNFT");
  const nft = await NFTFactory.deploy();
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("✅ EndlessMoltNFT deployed to:", nftAddress);

  // Deploy EndlessMoltMarketplace
  console.log("\n2. Deploying EndlessMoltMarketplace...");
  const MarketplaceFactory = await ethers.getContractFactory("EndlessMoltMarketplace");
  const marketplace = await MarketplaceFactory.deploy();
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("✅ EndlessMoltMarketplace deployed to:", marketplaceAddress);

  // Deploy EndlessMoltAuction
  console.log("\n3. Deploying EndlessMoltAuction...");
  const AuctionFactory = await ethers.getContractFactory("EndlessMoltAuction");
  const auction = await AuctionFactory.deploy();
  await auction.waitForDeployment();
  const auctionAddress = await auction.getAddress();
  console.log("✅ EndlessMoltAuction deployed to:", auctionAddress);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Deployer:", deployer.address);
  console.log("\nContract Addresses:");
  console.log("- EndlessMoltNFT:         ", nftAddress);
  console.log("- EndlessMoltMarketplace: ", marketplaceAddress);
  console.log("- EndlessMoltAuction:     ", auctionAddress);
  console.log("=".repeat(60));

  // Save deployment info to file
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      EndlessMoltNFT: nftAddress,
      EndlessMoltMarketplace: marketplaceAddress,
      EndlessMoltAuction: auctionAddress,
    },
  };

  const deploymentPath = `./deployments/${(await ethers.provider.getNetwork()).name}.json`;
  fs.mkdirSync("./deployments", { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📄 Deployment info saved to:", deploymentPath);

  // Verification instructions
  console.log("\n" + "=".repeat(60));
  console.log("VERIFICATION COMMANDS");
  console.log("=".repeat(60));
  console.log("Run these commands to verify contracts on Etherscan:\n");
  console.log(`npx hardhat verify --network sepolia ${nftAddress}`);
  console.log(`npx hardhat verify --network sepolia ${marketplaceAddress}`);
  console.log(`npx hardhat verify --network sepolia ${auctionAddress}`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
