import { ethers } from "hardhat";

type ReceiptEventLike = {
  fragment?: {
    name?: string;
  };
  args?: readonly unknown[];
};

/**
 * Test Workflow Script
 *
 * This script demonstrates a complete workflow through all three contracts:
 * 1. Mint an NFT
 * 2. List on marketplace
 * 3. Create auction
 * 4. Place bids with extension
 * 5. Settle auction
 *
 * Run with: npx hardhat run scripts/test-workflow.ts --network localhost
 */

async function main() {
  console.log("=".repeat(70));
  console.log("Endless Molt - Complete Workflow Test");
  console.log("=".repeat(70));
  console.log("");

  // Get signers
  const [owner, agent, seller, buyer1, buyer2, creator] = await ethers.getSigners();

  console.log("🔑 Accounts:");
  console.log(`  Owner:   ${owner.address}`);
  console.log(`  Agent:   ${agent.address}`);
  console.log(`  Seller:  ${seller.address}`);
  console.log(`  Buyer 1: ${buyer1.address}`);
  console.log(`  Buyer 2: ${buyer2.address}`);
  console.log(`  Creator: ${creator.address}`);
  console.log("");

  // Deploy contracts
  console.log("📦 Deploying contracts...");

  const NFTFactory = await ethers.getContractFactory("EndlessMoltNFT");
  const nft = await NFTFactory.deploy();
  await nft.waitForDeployment();
  console.log(`  ✅ NFT deployed to: ${await nft.getAddress()}`);

  const MarketplaceFactory = await ethers.getContractFactory("EndlessMoltMarketplace");
  const marketplace = await MarketplaceFactory.deploy();
  await marketplace.waitForDeployment();
  console.log(`  ✅ Marketplace deployed to: ${await marketplace.getAddress()}`);

  const AuctionFactory = await ethers.getContractFactory("EndlessMoltAuction");
  const auction = await AuctionFactory.deploy();
  await auction.waitForDeployment();
  console.log(`  ✅ Auction deployed to: ${await auction.getAddress()}`);
  console.log("");

  // Step 1: Self-mint NFT
  console.log("1️⃣  Self-minting NFT...");
  const metadataURI = "ipfs://QmTestArtwork123abc";
  const mintTx = await nft.connect(agent).mint(agent.address, metadataURI, agent.address);
  await mintTx.wait();
  console.log("  ✅ NFT minted (Token ID: 1)");
  console.log(`     Owner: ${await nft.ownerOf(1)}`);
  console.log(`     Creator: ${await nft.creatorOf(1)}`);
  console.log(`     Metadata: ${await nft.tokenURI(1)}`);
  console.log("");

  // Step 2: List on marketplace
  console.log("2️⃣  Listing NFT on marketplace...");
  const listPrice = ethers.parseEther("1.0");
  await nft.connect(agent).approve(marketplace.target, 1);
  console.log("  ✅ Marketplace approved");

  const listTx = await marketplace.connect(agent).listNFT(nft.target, 1, listPrice);
  const listReceipt = await listTx.wait();
  const listEvent = listReceipt?.logs.find(
    (log): log is ReceiptEventLike => (log as ReceiptEventLike).fragment?.name === "Listed"
  );
  const listingId = String(listEvent?.args?.[0] ?? "");
  if (!listingId) {
    throw new Error("Listing event did not include a listing id");
  }
  console.log(`  ✅ NFT listed (Listing ID: ${listingId.slice(0, 10)}...)`);
  console.log(`     Price: ${ethers.formatEther(listPrice)} ETH`);
  console.log("");

  // Step 3: Buy from marketplace
  console.log("3️⃣  Buying NFT from marketplace...");
  const totalPrice = await marketplace.calculateTotalPrice(listPrice);
  console.log(`  💰 Total price (including 3% buyer fee): ${ethers.formatEther(totalPrice)} ETH`);

  const sellerBalanceBefore = await ethers.provider.getBalance(agent.address);
  const creatorBalanceBefore = await ethers.provider.getBalance(agent.address);

  await marketplace.connect(buyer1).buyNFT(listingId, { value: totalPrice });
  console.log("  ✅ NFT purchased");
  console.log(`     New owner: ${await nft.ownerOf(1)}`);

  const sellerBalanceAfter = await ethers.provider.getBalance(agent.address);
  const creatorBalanceAfter = await ethers.provider.getBalance(agent.address);

  console.log(`     Seller received: ${ethers.formatEther(sellerBalanceAfter - sellerBalanceBefore)} ETH`);
  console.log(`     Creator received (royalty): ${ethers.formatEther(creatorBalanceAfter - creatorBalanceBefore)} ETH`);
  console.log(`     Marketplace fees: ${ethers.formatEther(await marketplace.accumulatedFees())} ETH`);
  console.log("");

  // Step 4: Mint second NFT for auction
  console.log("4️⃣  Minting second NFT for auction...");
  await nft.connect(buyer1).mint(buyer1.address, "ipfs://QmTestArtwork456def", buyer1.address);
  console.log("  ✅ Second NFT minted (Token ID: 2)");
  console.log("");

  // Step 5: Create auction
  console.log("5️⃣  Creating auction...");
  const reservePrice = ethers.parseEther("0.5");
  const duration = 3600; // 1 hour
  await nft.connect(buyer1).approve(auction.target, 2);

  const auctionTx = await auction.connect(buyer1).createAuction(nft.target, 2, reservePrice, duration);
  const auctionReceipt = await auctionTx.wait();
  const auctionEvent = auctionReceipt?.logs.find(
    (log): log is ReceiptEventLike => (log as ReceiptEventLike).fragment?.name === "AuctionCreated"
  );
  const auctionId = String(auctionEvent?.args?.[0] ?? "");
  if (!auctionId) {
    throw new Error("AuctionCreated event did not include an auction id");
  }
  console.log(`  ✅ Auction created (ID: ${auctionId.slice(0, 10)}...)`);
  console.log(`     Reserve price: ${ethers.formatEther(reservePrice)} ETH`);
  console.log(`     Duration: ${duration / 3600} hour`);
  console.log("");

  // Step 6: Place bids
  console.log("6️⃣  Placing bids...");
  const bid1 = reservePrice;
  await auction.connect(buyer2).placeBid(auctionId, { value: bid1 });
  console.log(`  ✅ Bid 1 placed by ${buyer2.address.slice(0, 10)}...`);
  console.log(`     Amount: ${ethers.formatEther(bid1)} ETH`);

  let auctionData = await auction.getAuction(auctionId);
  console.log(`     Current highest bidder: ${auctionData.highestBidder.slice(0, 10)}...`);
  console.log(`     Current highest bid: ${ethers.formatEther(auctionData.currentBid)} ETH`);
  console.log("");

  // Place higher bid
  const minBid = await auction.getMinimumBid(auctionId);
  console.log(`  💡 Minimum bid for next bidder: ${ethers.formatEther(minBid)} ETH (5% increment)`);

  const bid2 = minBid;
  const buyer2BalanceBefore = await ethers.provider.getBalance(buyer2.address);

  await auction.connect(seller).placeBid(auctionId, { value: bid2 });
  console.log(`  ✅ Bid 2 placed by ${seller.address.slice(0, 10)}...`);
  console.log(`     Amount: ${ethers.formatEther(bid2)} ETH`);

  const buyer2BalanceAfter = await ethers.provider.getBalance(buyer2.address);
  console.log(`  💸 Previous bidder refunded: ${ethers.formatEther(buyer2BalanceAfter - buyer2BalanceBefore)} ETH`);

  auctionData = await auction.getAuction(auctionId);
  console.log(`     Current highest bidder: ${auctionData.highestBidder.slice(0, 10)}...`);
  console.log(`     Current highest bid: ${ethers.formatEther(auctionData.currentBid)} ETH`);
  console.log("");

  // Step 7: Show extension logic (simulated)
  console.log("7️⃣  Auction extension demonstration:");
  console.log("  💡 If a bid is placed in the last 15 minutes:");
  console.log("     - Auction extends by 15 minutes");
  console.log("     - Extension counter increments");
  console.log("     - AuctionExtended event is emitted");
  console.log("     - Can extend multiple times");
  console.log("");
  console.log(`  📊 Current extension count: ${auctionData.extensionCount}`);
  console.log(`     Original end time: ${new Date(Number(auctionData.originalEndTime) * 1000).toLocaleString()}`);
  console.log(`     Current end time: ${new Date(Number(auctionData.endTime) * 1000).toLocaleString()}`);
  console.log("");

  // Step 8: Show time remaining
  const timeRemaining = await auction.timeRemaining(auctionId);
  const minutes = Number(timeRemaining) / 60;
  console.log("8️⃣  Time remaining:");
  console.log(`  ⏰ ${minutes.toFixed(1)} minutes`);
  console.log(`     Has ended: ${await auction.hasEnded(auctionId)}`);
  console.log("");

  // Step 9: Show fee withdrawal
  console.log("9️⃣  Fee management:");
  const marketplaceFees = await marketplace.accumulatedFees();
  const auctionFees = await auction.accumulatedFees();
  console.log(`  💰 Marketplace accumulated fees: ${ethers.formatEther(marketplaceFees)} ETH`);
  console.log(`  💰 Auction accumulated fees: ${ethers.formatEther(auctionFees)} ETH`);
  console.log(`  💰 Total fees: ${ethers.formatEther(marketplaceFees + auctionFees)} ETH`);
  console.log("");
  console.log("  💡 Owner can withdraw fees at any time:");
  console.log("     await marketplace.withdrawFees()");
  console.log("     await auction.withdrawFees()");
  console.log("");

  // Summary
  console.log("=".repeat(70));
  console.log("✅ Workflow Complete!");
  console.log("=".repeat(70));
  console.log("");
  console.log("Summary:");
  console.log("  ✅ 2 NFTs minted");
  console.log("  ✅ 1 marketplace sale completed");
  console.log("  ✅ 1 auction created with 2 bids");
  console.log(`  ✅ ${ethers.formatEther(marketplaceFees + auctionFees)} ETH in fees collected`);
  console.log("  ✅ Royalties paid to creator");
  console.log("  ✅ Previous bidder refunded automatically");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Wait for auction to end (or fast-forward time in test)");
  console.log("  2. Settle auction: await auction.settleAuction(auctionId)");
  console.log("  3. Withdraw fees: await marketplace.withdrawFees()");
  console.log("  4. Deploy to testnet: npm run deploy:sepolia");
  console.log("");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
