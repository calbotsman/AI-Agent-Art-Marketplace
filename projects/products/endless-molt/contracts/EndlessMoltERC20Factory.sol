// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EndlessMoltArtToken
 * @dev ERC20 token that AI agents can create as art objects
 * Each token represents a unique art piece with fungible supply
 */
contract EndlessMoltArtToken is ERC20, Ownable {
    string public artworkURI; // IPFS link to artwork metadata
    address public creator; // AI agent that created this
    uint256 public maxSupply; // Maximum supply (art edition size)

    constructor(
        string memory name,
        string memory symbol,
        uint256 _maxSupply,
        string memory _artworkURI,
        address _creator
    ) ERC20(name, symbol) Ownable(_creator) {
        creator = _creator;
        maxSupply = _maxSupply;
        artworkURI = _artworkURI;

        // Mint initial supply to creator
        _mint(_creator, _maxSupply);
    }

    function tokenURI() public view returns (string memory) {
        return artworkURI;
    }
}

/**
 * @title EndlessMoltERC20Factory
 * @dev Factory contract for AI agents to create ERC20 art tokens
 * Only verified AI agents can create tokens
 */
contract EndlessMoltERC20Factory is Ownable {
    // Mapping of AI agent addresses to verified status
    mapping(address => bool) public verifiedAgents;

    // Array of all created art tokens
    address[] public artTokens;

    // Mapping of creator to their tokens
    mapping(address => address[]) public creatorTokens;

    event ArtTokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 maxSupply
    );

    event AgentVerified(address indexed agent);
    event AgentUnverified(address indexed agent);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Verify an AI agent to allow token creation
     */
    function verifyAgent(address agent) external onlyOwner {
        verifiedAgents[agent] = true;
        emit AgentVerified(agent);
    }

    /**
     * @dev Unverify an AI agent
     */
    function unverifyAgent(address agent) external onlyOwner {
        verifiedAgents[agent] = false;
        emit AgentUnverified(agent);
    }

    /**
     * @dev Create a new ERC20 art token
     * @param name Token name (artwork title)
     * @param symbol Token symbol (artist signature)
     * @param maxSupply Maximum supply (edition size, e.g., 100 for limited edition)
     * @param artworkURI IPFS URI to artwork metadata
     */
    function createArtToken(
        string memory name,
        string memory symbol,
        uint256 maxSupply,
        string memory artworkURI
    ) external returns (address) {
        require(verifiedAgents[msg.sender], "Only verified AI agents can create art tokens");
        require(maxSupply > 0 && maxSupply <= 1000000, "Supply must be between 1 and 1,000,000");

        // Deploy new art token
        EndlessMoltArtToken token = new EndlessMoltArtToken(
            name,
            symbol,
            maxSupply,
            artworkURI,
            msg.sender
        );

        address tokenAddress = address(token);

        // Track the token
        artTokens.push(tokenAddress);
        creatorTokens[msg.sender].push(tokenAddress);

        emit ArtTokenCreated(tokenAddress, msg.sender, name, symbol, maxSupply);

        return tokenAddress;
    }

    /**
     * @dev Get all art tokens created by an agent
     */
    function getCreatorTokens(address creator) external view returns (address[] memory) {
        return creatorTokens[creator];
    }

    /**
     * @dev Get total number of art tokens created
     */
    function getTotalTokens() external view returns (uint256) {
        return artTokens.length;
    }

    /**
     * @dev Check if an address is a verified agent
     */
    function isVerifiedAgent(address agent) external view returns (bool) {
        return verifiedAgents[agent];
    }
}
