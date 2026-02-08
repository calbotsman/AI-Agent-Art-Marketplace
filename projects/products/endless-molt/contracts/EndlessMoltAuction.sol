// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title EndlessMoltAuction
 * @dev Auction contract with time-based bidding and anti-snipe protection
 * - 15-minute extension rule: bids in last 15 minutes extend auction by 15 minutes
 * - Minimum bid increment: 5%
 * - Automatic refund of previous bidders
 * - Platform fee: 50% primary / 25% secondary
 * - Buyer fee: currently 0% (auctions settle from bid amount; no extra payment step)
 */
contract EndlessMoltAuction is Ownable, ReentrancyGuard, Pausable {
    // Platform fee: 50% primary (5000 bps), 25% secondary (2500 bps)
    uint96 private constant PRIMARY_PLATFORM_FEE_BPS = 5000;
    uint96 private constant SECONDARY_PLATFORM_FEE_BPS = 2500;

    // Buyer fee: currently 0% (see note above)
    uint96 private constant BUYER_FEE_PERCENTAGE = 0;

    // Minimum bid increment: 5% (500 basis points)
    uint96 private constant MIN_BID_INCREMENT = 500;

    // Basis points denominator (100% = 10000 basis points)
    uint96 private constant BASIS_POINTS = 10000;

    // Extension time: 15 minutes (900 seconds)
    uint256 private constant EXTENSION_TIME = 900;

    // Accumulated platform fees
    uint256 public accumulatedFees;

    // Auction structure
    struct Auction {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 reservePrice;
        uint256 currentBid;
        address highestBidder;
        uint256 startTime;
        uint256 endTime;
        uint256 originalEndTime;
        uint256 extensionCount;
        bool settled;
        bool cancelled;
    }

    // Mapping from auction ID to Auction
    mapping(bytes32 => Auction) public auctions;

    // Events
    event AuctionCreated(
        bytes32 indexed auctionId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 reservePrice,
        uint256 startTime,
        uint256 endTime
    );
    event BidPlaced(
        bytes32 indexed auctionId,
        address indexed bidder,
        uint256 amount,
        uint256 newEndTime
    );
    event AuctionExtended(
        bytes32 indexed auctionId,
        uint256 newEndTime,
        uint256 extensionCount
    );
    event AuctionSettled(
        bytes32 indexed auctionId,
        address indexed winner,
        uint256 finalBid,
        uint256 platformFee,
        uint256 buyerFee,
        uint256 royaltyAmount
    );
    event AuctionCancelled(bytes32 indexed auctionId);
    event FeesWithdrawn(address indexed owner, uint256 amount);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Create a new auction
     * @param nftContract The NFT contract address
     * @param tokenId The token ID
     * @param reservePrice The minimum acceptable bid
     * @param duration The auction duration in seconds
     */
    function createAuction(
        address nftContract,
        uint256 tokenId,
        uint256 reservePrice,
        uint256 duration
    ) external nonReentrant whenNotPaused returns (bytes32) {
        require(reservePrice > 0, "Reserve price must be greater than 0");
        require(duration >= 3600, "Duration must be at least 1 hour");
        require(nftContract != address(0), "Invalid NFT contract");

        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the NFT owner");
        require(
            nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this)),
            "Auction contract not approved"
        );

        bytes32 auctionId = keccak256(abi.encodePacked(nftContract, tokenId, msg.sender, block.timestamp));

        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + duration;

        auctions[auctionId] = Auction({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            reservePrice: reservePrice,
            currentBid: 0,
            highestBidder: address(0),
            startTime: startTime,
            endTime: endTime,
            originalEndTime: endTime,
            extensionCount: 0,
            settled: false,
            cancelled: false
        });

        emit AuctionCreated(auctionId, msg.sender, nftContract, tokenId, reservePrice, startTime, endTime);

        return auctionId;
    }

    /**
     * @dev Place a bid on an auction
     * @param auctionId The auction ID
     */
    function placeBid(bytes32 auctionId) external payable nonReentrant whenNotPaused {
        Auction storage auction = auctions[auctionId];
        require(!auction.settled, "Auction already settled");
        require(!auction.cancelled, "Auction cancelled");
        require(block.timestamp >= auction.startTime, "Auction not started");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(msg.sender != auction.seller, "Seller cannot bid");

        uint256 minBid = getMinimumBid(auctionId);
        require(msg.value >= minBid, "Bid too low");

        // Refund previous bidder
        if (auction.highestBidder != address(0)) {
            (bool refundSuccess, ) = payable(auction.highestBidder).call{value: auction.currentBid}("");
            require(refundSuccess, "Previous bidder refund failed");
        }

        // Update auction state
        auction.currentBid = msg.value;
        auction.highestBidder = msg.sender;

        // Check if extension is needed (last 15 minutes)
        uint256 timeRemaining = auction.endTime - block.timestamp;
        if (timeRemaining < EXTENSION_TIME) {
            auction.endTime += EXTENSION_TIME;
            auction.extensionCount++;
            emit AuctionExtended(auctionId, auction.endTime, auction.extensionCount);
        }

        emit BidPlaced(auctionId, msg.sender, msg.value, auction.endTime);
    }

    /**
     * @dev Settle an auction and distribute funds
     * @param auctionId The auction ID
     */
    function settleAuction(bytes32 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(!auction.settled, "Auction already settled");
        require(!auction.cancelled, "Auction cancelled");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        require(auction.currentBid >= auction.reservePrice, "Reserve price not met");
        require(auction.highestBidder != address(0), "No valid bids");

        // Mark as settled before transfers (checks-effects-interactions)
        auction.settled = true;

        uint256 finalBid = auction.currentBid;
        uint256 buyerFee = (finalBid * BUYER_FEE_PERCENTAGE) / BASIS_POINTS;
        uint256 royaltyAmount = 0;
        address royaltyReceiver = address(0);

        // Check for royalties (ERC2981)
        try IERC2981(auction.nftContract).royaltyInfo(auction.tokenId, finalBid) returns (
            address receiver,
            uint256 royalty
        ) {
            royaltyAmount = royalty;
            royaltyReceiver = receiver;
        } catch {
            // No royalty support
        }

        // Primary sale if seller is the royalty receiver (or royalties not configured)
        bool isPrimary = royaltyReceiver == address(0) || royaltyReceiver == auction.seller;
        uint96 platformFeeBps = isPrimary ? PRIMARY_PLATFORM_FEE_BPS : SECONDARY_PLATFORM_FEE_BPS;
        uint256 platformFee = (finalBid * platformFeeBps) / BASIS_POINTS;

        // Calculate seller proceeds
        uint256 sellerProceeds = finalBid - platformFee - royaltyAmount;

        // Accumulate fees. Buyer fee is currently 0% for auctions.
        accumulatedFees += platformFee;

        // Transfer NFT to winner
        IERC721(auction.nftContract).safeTransferFrom(auction.seller, auction.highestBidder, auction.tokenId);

        // Pay royalty to creator
        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            (bool royaltySuccess, ) = payable(royaltyReceiver).call{value: royaltyAmount}("");
            require(royaltySuccess, "Royalty payment failed");
        }

        // Pay seller
        (bool sellerSuccess, ) = payable(auction.seller).call{value: sellerProceeds}("");
        require(sellerSuccess, "Seller payment failed");

        emit AuctionSettled(auctionId, auction.highestBidder, finalBid, platformFee, buyerFee, royaltyAmount);
    }

    /**
     * @dev Cancel an auction (only if no bids)
     * @param auctionId The auction ID
     */
    function cancelAuction(bytes32 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(!auction.settled, "Auction already settled");
        require(!auction.cancelled, "Auction already cancelled");
        require(msg.sender == auction.seller || msg.sender == owner(), "Not authorized");
        require(auction.highestBidder == address(0), "Cannot cancel auction with bids");

        auction.cancelled = true;

        emit AuctionCancelled(auctionId);
    }

    /**
     * @dev Get minimum bid for an auction
     * @param auctionId The auction ID
     */
    function getMinimumBid(bytes32 auctionId) public view returns (uint256) {
        Auction storage auction = auctions[auctionId];

        if (auction.currentBid == 0) {
            return auction.reservePrice;
        }

        uint256 increment = (auction.currentBid * MIN_BID_INCREMENT) / BASIS_POINTS;
        return auction.currentBid + increment;
    }

    /**
     * @dev Withdraw accumulated fees (owner only)
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = accumulatedFees;
        require(amount > 0, "No fees to withdraw");

        accumulatedFees = 0;

        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Withdrawal failed");

        emit FeesWithdrawn(owner(), amount);
    }

    /**
     * @dev Pause the auction contract (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the auction contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Get auction details
     */
    function getAuction(bytes32 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    /**
     * @dev Check if auction has ended
     */
    function hasEnded(bytes32 auctionId) external view returns (bool) {
        return block.timestamp >= auctions[auctionId].endTime;
    }

    /**
     * @dev Get time remaining in auction
     */
    function timeRemaining(bytes32 auctionId) external view returns (uint256) {
        Auction storage auction = auctions[auctionId];
        if (block.timestamp >= auction.endTime) {
            return 0;
        }
        return auction.endTime - block.timestamp;
    }

    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {}
}
