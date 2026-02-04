import * as fs from "fs";
import * as path from "path";

/**
 * Verification Helper Script
 *
 * This script reads deployed contract addresses from the deployment JSON file
 * and generates verification commands for all contracts.
 *
 * Usage:
 *   npx ts-node scripts/verify-all.ts sepolia
 *   npx ts-node scripts/verify-all.ts mainnet
 */

async function main() {
  const network = process.argv[2] || "sepolia";
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network}.json`);

  // Check if deployment file exists
  if (!fs.existsSync(deploymentFile)) {
    console.error(`❌ Error: Deployment file not found: ${deploymentFile}`);
    console.error(`\nPlease deploy contracts first:`);
    console.error(`  npm run deploy:${network}`);
    process.exit(1);
  }

  // Read deployment info
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));

  console.log("=".repeat(70));
  console.log(`Verification Commands for ${network.toUpperCase()}`);
  console.log("=".repeat(70));
  console.log("");
  console.log("Copy and run these commands to verify contracts on Etherscan:");
  console.log("");

  // Generate verification commands
  const contracts = deploymentInfo.contracts;

  if (contracts.EndlessMoltNFT) {
    console.log("# Verify EndlessMoltNFT");
    console.log(`npx hardhat verify --network ${network} ${contracts.EndlessMoltNFT}`);
    console.log("");
  }

  if (contracts.EndlessMoltMarketplace) {
    console.log("# Verify EndlessMoltMarketplace");
    console.log(`npx hardhat verify --network ${network} ${contracts.EndlessMoltMarketplace}`);
    console.log("");
  }

  if (contracts.EndlessMoltAuction) {
    console.log("# Verify EndlessMoltAuction");
    console.log(`npx hardhat verify --network ${network} ${contracts.EndlessMoltAuction}`);
    console.log("");
  }

  console.log("=".repeat(70));
  console.log("");
  console.log("Or run all at once:");
  console.log("");
  console.log([
    `npx hardhat verify --network ${network} ${contracts.EndlessMoltNFT || ""}`,
    `npx hardhat verify --network ${network} ${contracts.EndlessMoltMarketplace || ""}`,
    `npx hardhat verify --network ${network} ${contracts.EndlessMoltAuction || ""}`,
  ].join(" && "));
  console.log("");

  // Show Etherscan links
  const etherscanBase = network === "mainnet"
    ? "https://etherscan.io"
    : `https://${network}.etherscan.io`;

  console.log("=".repeat(70));
  console.log("Etherscan Links:");
  console.log("=".repeat(70));
  console.log("");

  if (contracts.EndlessMoltNFT) {
    console.log(`EndlessMoltNFT:`);
    console.log(`${etherscanBase}/address/${contracts.EndlessMoltNFT}#code`);
    console.log("");
  }

  if (contracts.EndlessMoltMarketplace) {
    console.log(`EndlessMoltMarketplace:`);
    console.log(`${etherscanBase}/address/${contracts.EndlessMoltMarketplace}#code`);
    console.log("");
  }

  if (contracts.EndlessMoltAuction) {
    console.log(`EndlessMoltAuction:`);
    console.log(`${etherscanBase}/address/${contracts.EndlessMoltAuction}#code`);
    console.log("");
  }

  console.log("=".repeat(70));
  console.log("");

  // Show deployment summary
  console.log("Deployment Summary:");
  console.log("=".repeat(70));
  console.log(`Network: ${deploymentInfo.network}`);
  console.log(`Chain ID: ${deploymentInfo.chainId}`);
  console.log(`Deployer: ${deploymentInfo.deployer}`);
  console.log(`Timestamp: ${deploymentInfo.timestamp}`);
  console.log("=".repeat(70));
  console.log("");

  // Generate environment variables
  console.log("Environment Variables for .env.local:");
  console.log("=".repeat(70));
  console.log("");
  console.log(`NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=${contracts.EndlessMoltNFT || ""}`);
  console.log(`NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=${contracts.EndlessMoltMarketplace || ""}`);
  console.log(`NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS=${contracts.EndlessMoltAuction || ""}`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=${deploymentInfo.chainId || ""}`);
  console.log("");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
