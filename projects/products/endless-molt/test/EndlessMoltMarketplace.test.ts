import { expect } from "chai";
import { ethers } from "hardhat";
import { EndlessMoltNFT, EndlessMoltMarketplace } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("EndlessMoltMarketplace", function () {
  let nft: EndlessMoltNFT;
  let marketplace: EndlessMoltMarketplace;
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;
  let creator: SignerWithAddress;

  const metadataURI = "ipfs://QmTest123";
  const price = ethers.parseEther("1.0");

  beforeEach(async function () {
    [owner, seller, buyer, creator] = await ethers.getSigners();

    // Deploy NFT contract
    const NFTFactory = await ethers.getContractFactory("EndlessMoltNFT");
    nft = await NFTFactory.deploy();

    // Deploy Marketplace contract
    const MarketplaceFactory = await ethers.getContractFactory("EndlessMoltMarketplace");
    marketplace = await MarketplaceFactory.deploy();

    // Whitelist seller and mint NFT
    await nft.whitelistAgent(seller.address);
    await nft.connect(seller).mint(seller.address, metadataURI, creator.address);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await marketplace.owner()).to.equal(owner.address);
    });

    it("Should start with zero accumulated fees", async function () {
      expect(await marketplace.accumulatedFees()).to.equal(0);
    });
  });

  describe("Listing", function () {
    it("Should allow NFT owner to list", async function () {
      await nft.connect(seller).approve(marketplace.target, 1);

      await expect(marketplace.connect(seller).listNFT(nft.target, 1, price))
        .to.emit(marketplace, "Listed");
    });

    it("Should not allow listing without approval", async function () {
      await expect(
        marketplace.connect(seller).listNFT(nft.target, 1, price)
      ).to.be.revertedWith("Marketplace not approved");
    });

    it("Should not allow non-owner to list", async function () {
      await nft.connect(seller).approve(marketplace.target, 1);

      await expect(
        marketplace.connect(buyer).listNFT(nft.target, 1, price)
      ).to.be.revertedWith("Not the NFT owner");
    });

    it("Should not allow listing with zero price", async function () {
      await nft.connect(seller).approve(marketplace.target, 1);

      await expect(
        marketplace.connect(seller).listNFT(nft.target, 1, 0)
      ).to.be.revertedWith("Price must be greater than 0");
    });

    it("Should create listing with correct details", async function () {
      await nft.connect(seller).approve(marketplace.target, 1);

      const tx = await marketplace.connect(seller).listNFT(nft.target, 1, price);
      const receipt = await tx.wait();

      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "Listed"
      );
      const listingId = (event as any).args[0];

      const listing = await marketplace.getListing(listingId);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.nftContract).to.equal(nft.target);
      expect(listing.tokenId).to.equal(1);
      expect(listing.price).to.equal(price);
      expect(listing.active).to.be.true;
    });
  });

  describe("Buying", function () {
    let listingId: string;

    beforeEach(async function () {
      await nft.connect(seller).approve(marketplace.target, 1);
      const tx = await marketplace.connect(seller).listNFT(nft.target, 1, price);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "Listed"
      );
      listingId = (event as any).args[0];
    });

    it("Should allow buying NFT with correct payment", async function () {
      const totalPrice = await marketplace.calculateTotalPrice(price);

      await marketplace.connect(buyer).buyNFT(listingId, { value: totalPrice });

      expect(await nft.ownerOf(1)).to.equal(buyer.address);
    });

    it("Should transfer correct amounts with fees and royalties", async function () {
      const totalPrice = await marketplace.calculateTotalPrice(price);
      const buyerFee = (price * 300n) / 10000n; // 3%
      const platformFee = (price * 2500n) / 10000n; // 25% (secondary sale)
      const royalty = (price * 1000n) / 10000n; // 10%
      const sellerProceeds = price - platformFee - royalty;

      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      const creatorBalanceBefore = await ethers.provider.getBalance(creator.address);

      await marketplace.connect(buyer).buyNFT(listingId, { value: totalPrice });

      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      const creatorBalanceAfter = await ethers.provider.getBalance(creator.address);

      // Check seller received correct amount
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(sellerProceeds);

      // Check creator received royalty
      expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(royalty);

      // Check fees accumulated
      expect(await marketplace.accumulatedFees()).to.equal(platformFee + buyerFee);
    });

    it("Should not allow buying with insufficient payment", async function () {
      const insufficientPayment = price; // Missing buyer fee

      await expect(
        marketplace.connect(buyer).buyNFT(listingId, { value: insufficientPayment })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should not allow seller to buy their own NFT", async function () {
      const totalPrice = await marketplace.calculateTotalPrice(price);

      await expect(
        marketplace.connect(seller).buyNFT(listingId, { value: totalPrice })
      ).to.be.revertedWith("Cannot buy your own NFT");
    });

    it("Should mark listing as inactive after purchase", async function () {
      const totalPrice = await marketplace.calculateTotalPrice(price);

      await marketplace.connect(buyer).buyNFT(listingId, { value: totalPrice });

      const listing = await marketplace.getListing(listingId);
      expect(listing.active).to.be.false;
    });

    it("Should not allow buying inactive listing", async function () {
      const totalPrice = await marketplace.calculateTotalPrice(price);

      await marketplace.connect(buyer).buyNFT(listingId, { value: totalPrice });

      await expect(
        marketplace.connect(buyer).buyNFT(listingId, { value: totalPrice })
      ).to.be.revertedWith("Listing not active");
    });

    it("Should refund excess payment", async function () {
      const totalPrice = await marketplace.calculateTotalPrice(price);
      const excessPayment = totalPrice + ethers.parseEther("0.5");

      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

      const tx = await marketplace.connect(buyer).buyNFT(listingId, { value: excessPayment });
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * tx.gasPrice!;

      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);

      // Buyer should only have paid totalPrice + gas
      const expectedBalance = buyerBalanceBefore - totalPrice - gasUsed;
      expect(buyerBalanceAfter).to.be.closeTo(expectedBalance, ethers.parseEther("0.001"));
    });

    it("Should emit Sale event with correct parameters", async function () {
      const totalPrice = await marketplace.calculateTotalPrice(price);
      const buyerFee = (price * 300n) / 10000n;
      const platformFee = (price * 2500n) / 10000n; // secondary sale
      const royalty = (price * 1000n) / 10000n;

      await expect(marketplace.connect(buyer).buyNFT(listingId, { value: totalPrice }))
        .to.emit(marketplace, "Sale")
        .withArgs(listingId, buyer.address, seller.address, price, platformFee, buyerFee, royalty);
    });
  });

  describe("Cancelling Listing", function () {
    let listingId: string;

    beforeEach(async function () {
      await nft.connect(seller).approve(marketplace.target, 1);
      const tx = await marketplace.connect(seller).listNFT(nft.target, 1, price);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "Listed"
      );
      listingId = (event as any).args[0];
    });

    it("Should allow seller to cancel listing", async function () {
      await marketplace.connect(seller).cancelListing(listingId);

      const listing = await marketplace.getListing(listingId);
      expect(listing.active).to.be.false;
    });

    it("Should allow owner to cancel listing", async function () {
      await marketplace.connect(owner).cancelListing(listingId);

      const listing = await marketplace.getListing(listingId);
      expect(listing.active).to.be.false;
    });

    it("Should not allow non-authorized to cancel", async function () {
      await expect(
        marketplace.connect(buyer).cancelListing(listingId)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should emit ListingCancelled event", async function () {
      await expect(marketplace.connect(seller).cancelListing(listingId))
        .to.emit(marketplace, "ListingCancelled")
        .withArgs(listingId);
    });
  });

  describe("Fee Withdrawal", function () {
    let listingId: string;

    beforeEach(async function () {
      await nft.connect(seller).approve(marketplace.target, 1);
      const tx = await marketplace.connect(seller).listNFT(nft.target, 1, price);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "Listed"
      );
      listingId = (event as any).args[0];

      // Make a purchase to accumulate fees
      const totalPrice = await marketplace.calculateTotalPrice(price);
      await marketplace.connect(buyer).buyNFT(listingId, { value: totalPrice });
    });

    it("Should allow owner to withdraw fees", async function () {
      const accumulatedFees = await marketplace.accumulatedFees();
      expect(accumulatedFees).to.be.gt(0);

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

      const tx = await marketplace.connect(owner).withdrawFees();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * tx.gasPrice!;

      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      expect(ownerBalanceAfter - ownerBalanceBefore).to.be.closeTo(
        accumulatedFees - gasUsed,
        ethers.parseEther("0.001")
      );

      expect(await marketplace.accumulatedFees()).to.equal(0);
    });

    it("Should not allow non-owner to withdraw fees", async function () {
      await expect(
        marketplace.connect(buyer).withdrawFees()
      ).to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");
    });

    it("Should not allow withdrawal when no fees", async function () {
      await marketplace.connect(owner).withdrawFees();

      await expect(
        marketplace.connect(owner).withdrawFees()
      ).to.be.revertedWith("No fees to withdraw");
    });

    it("Should emit FeesWithdrawn event", async function () {
      const accumulatedFees = await marketplace.accumulatedFees();

      await expect(marketplace.connect(owner).withdrawFees())
        .to.emit(marketplace, "FeesWithdrawn")
        .withArgs(owner.address, accumulatedFees);
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow owner to pause", async function () {
      await marketplace.connect(owner).pause();

      await nft.connect(seller).approve(marketplace.target, 1);

      await expect(
        marketplace.connect(seller).listNFT(nft.target, 1, price)
      ).to.be.revertedWithCustomError(marketplace, "EnforcedPause");
    });

    it("Should allow owner to unpause", async function () {
      await marketplace.connect(owner).pause();
      await marketplace.connect(owner).unpause();

      await nft.connect(seller).approve(marketplace.target, 1);
      await expect(marketplace.connect(seller).listNFT(nft.target, 1, price))
        .to.emit(marketplace, "Listed");
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(
        marketplace.connect(buyer).pause()
      ).to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");
    });
  });
});
