// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title EndlessMoltMarketplace
 * @dev Marketplace contract for fixed-price NFT sales (Buy Now)
 * - Platform fee: 12.5% primary / 5% secondary
 * - Buyer fee: currently 0% (no extra payment step)
 * - Automatic royalty payments to creators (ERC2981)
 * - Escrow mechanism for secure transfers
 */
contract EndlessMoltMarketplace is Ownable, ReentrancyGuard, Pausable {
    // Platform fee (in basis points) collected by the marketplace.
    // Keep this conservative to reduce friction for early creators/collectors.
    uint96 private constant PRIMARY_PLATFORM_FEE_BPS = 1250; // 12.5%
    uint96 private constant SECONDARY_PLATFORM_FEE_BPS = 500; // 5%

    // Buyer fees are high-friction; keep at 0 until we have product-market fit.
    uint96 private constant BUYER_FEE_PERCENTAGE = 0;

    // Basis points denominator (100% = 10000 basis points)
    uint96 private constant BASIS_POINTS = 10000;

    // Accumulated platform fees
    uint256 public accumulatedFees;

    // Listing structure
    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        bool active;
    }

    // Mapping from listing ID to Listing
    mapping(bytes32 => Listing) public listings;

    // Events
    event Listed(
        bytes32 indexed listingId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 price
    );
    event Sale(
        bytes32 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 price,
        uint256 platformFee,
        uint256 buyerFee,
        uint256 royaltyAmount
    );
    event ListingCancelled(bytes32 indexed listingId);
    event FeesWithdrawn(address indexed owner, uint256 amount);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev List an NFT for fixed-price sale
     * @param nftContract The NFT contract address
     * @param tokenId The token ID
     * @param price The sale price in wei
     */
    function listNFT(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external nonReentrant whenNotPaused returns (bytes32) {
        require(price > 0, "Price must be greater than 0");
        require(nftContract != address(0), "Invalid NFT contract");

        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the NFT owner");
        require(
            nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );

        bytes32 listingId = keccak256(abi.encodePacked(nftContract, tokenId, msg.sender, block.timestamp));

        listings[listingId] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            active: true
        });

        emit Listed(listingId, msg.sender, nftContract, tokenId, price);

        return listingId;
    }

    /**
     * @dev Buy an NFT at fixed price
     * @param listingId The listing ID
     */
    function buyNFT(bytes32 listingId) external payable nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(listing.seller != msg.sender, "Cannot buy your own NFT");

        uint256 price = listing.price;
        uint256 buyerFee = (price * BUYER_FEE_PERCENTAGE) / BASIS_POINTS;
        uint256 totalPrice = price + buyerFee;

        require(msg.value >= totalPrice, "Insufficient payment");

        // Mark listing as inactive before transfers (checks-effects-interactions)
        listing.active = false;

        // Check for royalties (ERC2981)
        uint256 royaltyAmount = 0;
        address royaltyReceiver = address(0);

        try IERC2981(listing.nftContract).royaltyInfo(listing.tokenId, price) returns (
            address receiver,
            uint256 royalty
        ) {
            royaltyAmount = royalty;
            royaltyReceiver = receiver;
        } catch {
            // No royalty support
        }

        // Primary sale if seller is the royalty receiver (or royalties not configured)
        bool isPrimary = royaltyReceiver == address(0) || royaltyReceiver == listing.seller;
        uint96 platformFeeBps = isPrimary ? PRIMARY_PLATFORM_FEE_BPS : SECONDARY_PLATFORM_FEE_BPS;
        uint256 platformFee = (price * platformFeeBps) / BASIS_POINTS;

        // Calculate seller proceeds
        uint256 sellerProceeds = price - platformFee - royaltyAmount;

        // Accumulate fees
        accumulatedFees += platformFee + buyerFee;

        // Transfer NFT to buyer
        IERC721(listing.nftContract).safeTransferFrom(listing.seller, msg.sender, listing.tokenId);

        // Pay royalty to creator
        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            (bool royaltySuccess, ) = payable(royaltyReceiver).call{value: royaltyAmount}("");
            require(royaltySuccess, "Royalty payment failed");
        }

        // Pay seller
        (bool sellerSuccess, ) = payable(listing.seller).call{value: sellerProceeds}("");
        require(sellerSuccess, "Seller payment failed");

        // Refund excess payment
        if (msg.value > totalPrice) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - totalPrice}("");
            require(refundSuccess, "Refund failed");
        }

        emit Sale(listingId, msg.sender, listing.seller, price, platformFee, buyerFee, royaltyAmount);
    }

    /**
     * @dev Cancel a listing
     * @param listingId The listing ID
     */
    function cancelListing(bytes32 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender || msg.sender == owner(), "Not authorized");

        listing.active = false;

        emit ListingCancelled(listingId);
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
     * @dev Pause the marketplace (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the marketplace
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Get listing details
     */
    function getListing(bytes32 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    /**
     * @dev Calculate total price including buyer fee
     */
    function calculateTotalPrice(uint256 price) external pure returns (uint256) {
        uint256 buyerFee = (price * BUYER_FEE_PERCENTAGE) / BASIS_POINTS;
        return price + buyerFee;
    }

    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {}
}
