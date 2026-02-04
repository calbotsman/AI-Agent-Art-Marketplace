// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EndlessMoltNFT
 * @dev ERC721 NFT contract for 1-of-1 artworks with royalty support
 * - Only whitelisted agents can mint
 * - 10% perpetual royalties to original creator
 * - Metadata stored on IPFS
 */
contract EndlessMoltNFT is ERC721, ERC2981, Ownable, ReentrancyGuard {
    // Token counter for unique IDs
    uint256 private _tokenIdCounter;

    // Mapping from token ID to metadata URI (IPFS hash)
    mapping(uint256 => string) private _tokenURIs;

    // Mapping from token ID to original creator
    mapping(uint256 => address) private _creators;

    // Whitelist of verified agents who can mint
    mapping(address => bool) public verifiedAgents;

    // Default royalty percentage (10% = 1000 basis points)
    uint96 private constant DEFAULT_ROYALTY_PERCENTAGE = 1000;

    // Events
    event NFTMinted(uint256 indexed tokenId, address indexed creator, address indexed to, string metadataURI);
    event AgentWhitelisted(address indexed agent);
    event AgentRemovedFromWhitelist(address indexed agent);

    constructor() ERC721("Endless Molt NFT", "EMOLT") Ownable(msg.sender) {
        _tokenIdCounter = 1; // Start from token ID 1
    }

    /**
     * @dev Modifier to restrict minting to whitelisted agents
     */
    modifier onlyVerifiedAgent() {
        require(verifiedAgents[msg.sender] || msg.sender == owner(), "Not a verified agent");
        _;
    }

    /**
     * @dev Mint a new 1-of-1 NFT
     * @param to The address that will own the minted NFT
     * @param metadataURI The IPFS URI for the NFT metadata
     * @param creator The original creator address for royalties
     */
    function mint(
        address to,
        string memory metadataURI,
        address creator
    ) external onlyVerifiedAgent nonReentrant returns (uint256) {
        require(to != address(0), "Invalid recipient");
        require(creator != address(0), "Invalid creator");
        require(bytes(metadataURI).length > 0, "Empty metadata URI");

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _safeMint(to, tokenId);
        _tokenURIs[tokenId] = metadataURI;
        _creators[tokenId] = creator;

        // Set royalty info for this token (10% to creator)
        _setTokenRoyalty(tokenId, creator, DEFAULT_ROYALTY_PERCENTAGE);

        emit NFTMinted(tokenId, creator, to, metadataURI);

        return tokenId;
    }

    /**
     * @dev Add an agent to the whitelist
     * @param agent The address to whitelist
     */
    function whitelistAgent(address agent) external onlyOwner {
        require(agent != address(0), "Invalid agent address");
        require(!verifiedAgents[agent], "Agent already whitelisted");

        verifiedAgents[agent] = true;
        emit AgentWhitelisted(agent);
    }

    /**
     * @dev Remove an agent from the whitelist
     * @param agent The address to remove
     */
    function removeAgentFromWhitelist(address agent) external onlyOwner {
        require(verifiedAgents[agent], "Agent not whitelisted");

        verifiedAgents[agent] = false;
        emit AgentRemovedFromWhitelist(agent);
    }

    /**
     * @dev Get the metadata URI for a token
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }

    /**
     * @dev Get the original creator of a token
     */
    function creatorOf(uint256 tokenId) external view returns (address) {
        _requireOwned(tokenId);
        return _creators[tokenId];
    }

    /**
     * @dev Get the current token counter value
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter - 1;
    }

    /**
     * @dev See {IERC165-supportsInterface}
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
