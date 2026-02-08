import { expect } from "chai";
import { ethers } from "hardhat";
import { EndlessMoltNFT, EndlessMoltAuction } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("EndlessMoltAuction", function () {
  let nft: EndlessMoltNFT;
  let auction: EndlessMoltAuction;
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let bidder1: SignerWithAddress;
  let bidder2: SignerWithAddress;
  let creator: SignerWithAddress;

  const metadataURI = "ipfs://QmTest123";
  const reservePrice = ethers.parseEther("1.0");
  const duration = 3600; // 1 hour

  beforeEach(async function () {
    [owner, seller, bidder1, bidder2, creator] = await ethers.getSigners();

    // Deploy NFT contract
    const NFTFactory = await ethers.getContractFactory("EndlessMoltNFT");
    nft = await NFTFactory.deploy();

    // Deploy Auction contract
    const AuctionFactory = await ethers.getContractFactory("EndlessMoltAuction");
    auction = await AuctionFactory.deploy();

    // Whitelist seller and mint NFT
    await nft.whitelistAgent(seller.address);
    await nft.connect(seller).mint(seller.address, metadataURI, creator.address);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await auction.owner()).to.equal(owner.address);
    });

    it("Should start with zero accumulated fees", async function () {
      expect(await auction.accumulatedFees()).to.equal(0);
    });
  });

  describe("Creating Auction", function () {
    it("Should allow NFT owner to create auction", async function () {
      await nft.connect(seller).approve(auction.target, 1);

      await expect(
        auction.connect(seller).createAuction(nft.target, 1, reservePrice, duration)
      ).to.emit(auction, "AuctionCreated");
    });

    it("Should not allow creating auction without approval", async function () {
      await expect(
        auction.connect(seller).createAuction(nft.target, 1, reservePrice, duration)
      ).to.be.revertedWith("Auction contract not approved");
    });

    it("Should not allow non-owner to create auction", async function () {
      await nft.connect(seller).approve(auction.target, 1);

      await expect(
        auction.connect(bidder1).createAuction(nft.target, 1, reservePrice, duration)
      ).to.be.revertedWith("Not the NFT owner");
    });

    it("Should not allow zero reserve price", async function () {
      await nft.connect(seller).approve(auction.target, 1);

      await expect(
        auction.connect(seller).createAuction(nft.target, 1, 0, duration)
      ).to.be.revertedWith("Reserve price must be greater than 0");
    });

    it("Should not allow duration less than 1 hour", async function () {
      await nft.connect(seller).approve(auction.target, 1);

      await expect(
        auction.connect(seller).createAuction(nft.target, 1, reservePrice, 1800) // 30 minutes
      ).to.be.revertedWith("Duration must be at least 1 hour");
    });

    it("Should create auction with correct details", async function () {
      await nft.connect(seller).approve(auction.target, 1);

      const tx = await auction.connect(seller).createAuction(nft.target, 1, reservePrice, duration);
      const receipt = await tx.wait();

      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "AuctionCreated"
      );
      const auctionId = (event as any).args[0];

      const auctionData = await auction.getAuction(auctionId);
      expect(auctionData.seller).to.equal(seller.address);
      expect(auctionData.nftContract).to.equal(nft.target);
      expect(auctionData.tokenId).to.equal(1);
      expect(auctionData.reservePrice).to.equal(reservePrice);
      expect(auctionData.settled).to.be.false;
      expect(auctionData.cancelled).to.be.false;
    });
  });

  describe("Bidding", function () {
    let auctionId: string;

    beforeEach(async function () {
      await nft.connect(seller).approve(auction.target, 1);
      const tx = await auction.connect(seller).createAuction(nft.target, 1, reservePrice, duration);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "AuctionCreated"
      );
      auctionId = (event as any).args[0];
    });

    it("Should allow placing bid at reserve price", async function () {
      await auction.connect(bidder1).placeBid(auctionId, { value: reservePrice });

      const auctionData = await auction.getAuction(auctionId);
      expect(auctionData.currentBid).to.equal(reservePrice);
      expect(auctionData.highestBidder).to.equal(bidder1.address);
    });

    it("Should not allow bid below reserve price", async function () {
      const lowBid = ethers.parseEther("0.5");

      await expect(
        auction.connect(bidder1).placeBid(auctionId, { value: lowBid })
      ).to.be.revertedWith("Bid too low");
    });

    it("Should require 5% minimum increment for subsequent bids", async function () {
      await auction.connect(bidder1).placeBid(auctionId, { value: reservePrice });

      const minBid = await auction.getMinimumBid(auctionId);
      const expectedMinBid = reservePrice + (reservePrice * 500n) / 10000n; // 5% increment

      expect(minBid).to.equal(expectedMinBid);

      // Try to bid with less than 5% increment
      const lowIncrement = reservePrice + ethers.parseEther("0.01");
      await expect(
        auction.connect(bidder2).placeBid(auctionId, { value: lowIncrement })
      ).to.be.revertedWith("Bid too low");
    });

    it("Should refund previous bidder when outbid", async function () {
      await auction.connect(bidder1).placeBid(auctionId, { value: reservePrice });

      const bidder1BalanceBefore = await ethers.provider.getBalance(bidder1.address);

      const minBid = await auction.getMinimumBid(auctionId);
      await auction.connect(bidder2).placeBid(auctionId, { value: minBid });

      const bidder1BalanceAfter = await ethers.provider.getBalance(bidder1.address);

      // Bidder1 should have received their bid back
      expect(bidder1BalanceAfter - bidder1BalanceBefore).to.equal(reservePrice);
    });

    it("Should not allow seller to bid", async function () {
      await expect(
        auction.connect(seller).placeBid(auctionId, { value: reservePrice })
      ).to.be.revertedWith("Seller cannot bid");
    });

    it("Should not allow bidding after auction ends", async function () {
      // Fast forward past auction end time
      await time.increase(duration + 1);

      await expect(
        auction.connect(bidder1).placeBid(auctionId, { value: reservePrice })
      ).to.be.revertedWith("Auction ended");
    });

    it("Should emit BidPlaced event", async function () {
      await expect(auction.connect(bidder1).placeBid(auctionId, { value: reservePrice }))
        .to.emit(auction, "BidPlaced");
    });
  });

  describe("15-Minute Extension Rule", function () {
    let auctionId: string;

    beforeEach(async function () {
      await nft.connect(seller).approve(auction.target, 1);
      const tx = await auction.connect(seller).createAuction(nft.target, 1, reservePrice, duration);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "AuctionCreated"
      );
      auctionId = (event as any).args[0];
    });

    it("Should extend auction by 15 minutes if bid in last 15 minutes", async function () {
      // Fast forward to 10 minutes before end
      await time.increase(duration - 600);

      const auctionBefore = await auction.getAuction(auctionId);
      const originalEndTime = auctionBefore.endTime;

      await auction.connect(bidder1).placeBid(auctionId, { value: reservePrice });

      const auctionAfter = await auction.getAuction(auctionId);
      const newEndTime = auctionAfter.endTime;

      // Should be extended by 900 seconds (15 minutes)
      expect(newEndTime - originalEndTime).to.equal(900n);
      expect(auctionAfter.extensionCount).to.equal(1);
    });

    it("Should not extend if bid placed with more than 15 minutes remaining", async function () {
      // Place bid with 20 minutes remaining
      await time.increase(duration - 1200);

      const auctionBefore = await auction.getAuction(auctionId);
      const originalEndTime = auctionBefore.endTime;

      await auction.connect(bidder1).placeBid(auctionId, { value: reservePrice });

      const auctionAfter = await auction.getAuction(auctionId);
      const newEndTime = auctionAfter.endTime;

      // Should not be extended
      expect(newEndTime).to.equal(originalEndTime);
      expect(auctionAfter.extensionCount).to.equal(0);
    });

    it("Should allow multiple extensions", async function () {
      // Fast forward to 10 minutes before end
      await time.increase(duration - 600);

      await auction.connect(bidder1).placeBid(auctionId, { value: reservePrice });

      // Fast forward to 10 minutes before new end (within extension window)
      await time.increase(600);

      const minBid = await auction.getMinimumBid(auctionId);
      await auction.connect(bidder2).placeBid(auctionId, { value: minBid });

      const auctionData = await auction.getAuction(auctionId);
      expect(auctionData.extensionCount).to.equal(2);
    });

    it("Should emit AuctionExtended event", async function () {
      await time.increase(duration - 600);

      await expect(auction.connect(bidder1).placeBid(auctionId, { value: reservePrice }))
        .to.emit(auction, "AuctionExtended");
    });
  });

  describe("Settlement", function () {
    let auctionId: string;

    beforeEach(async function () {
      await nft.connect(seller).approve(auction.target, 1);
      const tx = await auction.connect(seller).createAuction(nft.target, 1, reservePrice, duration);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "AuctionCreated"
      );
      auctionId = (event as any).args[0];

      // Place a winning bid
      await auction.connect(bidder1).placeBid(auctionId, { value: reservePrice });

      // Fast forward past auction end
      await time.increase(duration + 1);
    });

    it("Should allow settling auction after end time", async function () {
      await auction.connect(bidder1).settleAuction(auctionId);

      expect(await nft.ownerOf(1)).to.equal(bidder1.address);

      const auctionData = await auction.getAuction(auctionId);
      expect(auctionData.settled).to.be.true;
    });

    it("Should distribute funds correctly with fees and royalties", async function () {
      const finalBid = reservePrice;
      const buyerFee = 0n; // auctions currently do not charge an additional buyer fee
      const platformFee = (finalBid * 2500n) / 10000n; // 25% (secondary sale)
      const royalty = (finalBid * 1000n) / 10000n; // 10%
      const sellerProceeds = finalBid - platformFee - royalty;

      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      const creatorBalanceBefore = await ethers.provider.getBalance(creator.address);

      await auction.connect(bidder1).settleAuction(auctionId);

      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      const creatorBalanceAfter = await ethers.provider.getBalance(creator.address);

      // Check seller received correct amount
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(sellerProceeds);

      // Check creator received royalty
      expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(royalty);

      // Check fees accumulated (platform fee + buyer fee)
      expect(await auction.accumulatedFees()).to.equal(platformFee + buyerFee);
    });

    it("Should not allow settling before end time", async function () {
      // Create new auction
      await nft.connect(seller).mint(seller.address, metadataURI, creator.address);
      await nft.connect(seller).approve(auction.target, 2);

      const tx = await auction.connect(seller).createAuction(nft.target, 2, reservePrice, duration);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "AuctionCreated"
      );
      const newAuctionId = (event as any).args[0];

      await auction.connect(bidder1).placeBid(newAuctionId, { value: reservePrice });

      await expect(
        auction.connect(bidder1).settleAuction(newAuctionId)
      ).to.be.revertedWith("Auction not ended");
    });

    it("Should not allow settling auction with no bids", async function () {
      // Create new auction with no bids
      await nft.connect(seller).mint(seller.address, metadataURI, creator.address);
      await nft.connect(seller).approve(auction.target, 2);

      const tx = await auction.connect(seller).createAuction(nft.target, 2, reservePrice, duration);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "AuctionCreated"
      );
      const newAuctionId = (event as any).args[0];

      await time.increase(duration + 1);

      await expect(
        auction.connect(bidder1).settleAuction(newAuctionId)
      ).to.be.revertedWith("Reserve price not met");
    });

    it("Should not allow settling twice", async function () {
      await auction.connect(bidder1).settleAuction(auctionId);

      await expect(
        auction.connect(bidder1).settleAuction(auctionId)
      ).to.be.revertedWith("Auction already settled");
    });

    it("Should emit AuctionSettled event", async function () {
      await expect(auction.connect(bidder1).settleAuction(auctionId))
        .to.emit(auction, "AuctionSettled");
    });
  });

  describe("Cancelling Auction", function () {
    let auctionId: string;

    beforeEach(async function () {
      await nft.connect(seller).approve(auction.target, 1);
      const tx = await auction.connect(seller).createAuction(nft.target, 1, reservePrice, duration);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "AuctionCreated"
      );
      auctionId = (event as any).args[0];
    });

    it("Should allow seller to cancel auction with no bids", async function () {
      await auction.connect(seller).cancelAuction(auctionId);

      const auctionData = await auction.getAuction(auctionId);
      expect(auctionData.cancelled).to.be.true;
    });

    it("Should allow owner to cancel auction", async function () {
      await auction.connect(owner).cancelAuction(auctionId);

      const auctionData = await auction.getAuction(auctionId);
      expect(auctionData.cancelled).to.be.true;
    });

    it("Should not allow cancelling auction with bids", async function () {
      await auction.connect(bidder1).placeBid(auctionId, { value: reservePrice });

      await expect(
        auction.connect(seller).cancelAuction(auctionId)
      ).to.be.revertedWith("Cannot cancel auction with bids");
    });

    it("Should not allow non-authorized to cancel", async function () {
      await expect(
        auction.connect(bidder1).cancelAuction(auctionId)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should emit AuctionCancelled event", async function () {
      await expect(auction.connect(seller).cancelAuction(auctionId))
        .to.emit(auction, "AuctionCancelled")
        .withArgs(auctionId);
    });
  });

  describe("Fee Withdrawal", function () {
    let auctionId: string;

    beforeEach(async function () {
      await nft.connect(seller).approve(auction.target, 1);
      const tx = await auction.connect(seller).createAuction(nft.target, 1, reservePrice, duration);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "AuctionCreated"
      );
      auctionId = (event as any).args[0];

      // Complete auction
      await auction.connect(bidder1).placeBid(auctionId, { value: reservePrice });
      await time.increase(duration + 1);
      await auction.connect(bidder1).settleAuction(auctionId);
    });

    it("Should allow owner to withdraw fees", async function () {
      const accumulatedFees = await auction.accumulatedFees();
      expect(accumulatedFees).to.be.gt(0);

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

      const tx = await auction.connect(owner).withdrawFees();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * tx.gasPrice!;

      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      expect(ownerBalanceAfter - ownerBalanceBefore).to.be.closeTo(
        accumulatedFees - gasUsed,
        ethers.parseEther("0.001")
      );

      expect(await auction.accumulatedFees()).to.equal(0);
    });

    it("Should not allow non-owner to withdraw", async function () {
      await expect(
        auction.connect(bidder1).withdrawFees()
      ).to.be.revertedWithCustomError(auction, "OwnableUnauthorizedAccount");
    });

    it("Should not allow withdrawal when no fees", async function () {
      await auction.connect(owner).withdrawFees();

      await expect(
        auction.connect(owner).withdrawFees()
      ).to.be.revertedWith("No fees to withdraw");
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow owner to pause", async function () {
      await auction.connect(owner).pause();

      await nft.connect(seller).approve(auction.target, 1);

      await expect(
        auction.connect(seller).createAuction(nft.target, 1, reservePrice, duration)
      ).to.be.revertedWithCustomError(auction, "EnforcedPause");
    });

    it("Should allow owner to unpause", async function () {
      await auction.connect(owner).pause();
      await auction.connect(owner).unpause();

      await nft.connect(seller).approve(auction.target, 1);
      await expect(
        auction.connect(seller).createAuction(nft.target, 1, reservePrice, duration)
      ).to.emit(auction, "AuctionCreated");
    });
  });

  describe("Helper Functions", function () {
    let auctionId: string;

    beforeEach(async function () {
      await nft.connect(seller).approve(auction.target, 1);
      const tx = await auction.connect(seller).createAuction(nft.target, 1, reservePrice, duration);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "AuctionCreated"
      );
      auctionId = (event as any).args[0];
    });

    it("Should correctly report if auction has ended", async function () {
      expect(await auction.hasEnded(auctionId)).to.be.false;

      await time.increase(duration + 1);

      expect(await auction.hasEnded(auctionId)).to.be.true;
    });

    it("Should correctly calculate time remaining", async function () {
      const remaining = await auction.timeRemaining(auctionId);
      expect(remaining).to.be.closeTo(BigInt(duration), 10n);

      await time.increase(duration / 2);

      const remainingHalf = await auction.timeRemaining(auctionId);
      expect(remainingHalf).to.be.closeTo(BigInt(duration / 2), 10n);

      await time.increase(duration);

      const remainingEnd = await auction.timeRemaining(auctionId);
      expect(remainingEnd).to.equal(0);
    });
  });
});
