import { expect } from "chai";
import { ethers } from "hardhat";
import { EndlessMoltNFT } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("EndlessMoltNFT", function () {
  let nft: EndlessMoltNFT;
  let owner: SignerWithAddress;
  let agent: SignerWithAddress;
  let creator: SignerWithAddress;
  let buyer: SignerWithAddress;

  beforeEach(async function () {
    [owner, agent, creator, buyer] = await ethers.getSigners();

    const NFTFactory = await ethers.getContractFactory("EndlessMoltNFT");
    nft = await NFTFactory.deploy();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await nft.owner()).to.equal(owner.address);
    });

    it("Should have correct name and symbol", async function () {
      expect(await nft.name()).to.equal("Endless Molt NFT");
      expect(await nft.symbol()).to.equal("EMOLT");
    });

    it("Should start with token counter at 1", async function () {
      expect(await nft.totalSupply()).to.equal(0);
    });
  });

  describe("Agent Whitelisting", function () {
    it("Should allow owner to whitelist an agent", async function () {
      await nft.whitelistAgent(agent.address);
      expect(await nft.verifiedAgents(agent.address)).to.be.true;
    });

    it("Should emit AgentWhitelisted event", async function () {
      await expect(nft.whitelistAgent(agent.address))
        .to.emit(nft, "AgentWhitelisted")
        .withArgs(agent.address);
    });

    it("Should not allow whitelisting same agent twice", async function () {
      await nft.whitelistAgent(agent.address);
      await expect(nft.whitelistAgent(agent.address)).to.be.revertedWith(
        "Agent already whitelisted"
      );
    });

    it("Should not allow non-owner to whitelist", async function () {
      await expect(
        nft.connect(agent).whitelistAgent(buyer.address)
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to remove agent from whitelist", async function () {
      await nft.whitelistAgent(agent.address);
      await nft.removeAgentFromWhitelist(agent.address);
      expect(await nft.verifiedAgents(agent.address)).to.be.false;
    });

    it("Should not allow removing non-whitelisted agent", async function () {
      await expect(
        nft.removeAgentFromWhitelist(agent.address)
      ).to.be.revertedWith("Agent not whitelisted");
    });
  });

  describe("Minting", function () {
    const metadataURI = "ipfs://QmTest123";

    beforeEach(async function () {
      await nft.whitelistAgent(agent.address);
    });

    it("Should allow whitelisted agent to mint", async function () {
      await nft.connect(agent).mint(buyer.address, metadataURI, creator.address);
      expect(await nft.ownerOf(1)).to.equal(buyer.address);
    });

    it("Should allow owner to mint without being whitelisted", async function () {
      await nft.connect(owner).mint(buyer.address, metadataURI, creator.address);
      expect(await nft.ownerOf(1)).to.equal(buyer.address);
    });

    it("Should not allow non-whitelisted address to mint", async function () {
      await expect(
        nft.connect(buyer).mint(buyer.address, metadataURI, creator.address)
      ).to.be.revertedWith("Not a verified agent");
    });

    it("Should increment token counter correctly", async function () {
      await nft.connect(agent).mint(buyer.address, metadataURI, creator.address);
      expect(await nft.totalSupply()).to.equal(1);

      await nft.connect(agent).mint(buyer.address, metadataURI, creator.address);
      expect(await nft.totalSupply()).to.equal(2);
    });

    it("Should set correct metadata URI", async function () {
      await nft.connect(agent).mint(buyer.address, metadataURI, creator.address);
      expect(await nft.tokenURI(1)).to.equal(metadataURI);
    });

    it("Should set correct creator", async function () {
      await nft.connect(agent).mint(buyer.address, metadataURI, creator.address);
      expect(await nft.creatorOf(1)).to.equal(creator.address);
    });

    it("Should emit NFTMinted event", async function () {
      await expect(
        nft.connect(agent).mint(buyer.address, metadataURI, creator.address)
      )
        .to.emit(nft, "NFTMinted")
        .withArgs(1, creator.address, buyer.address, metadataURI);
    });

    it("Should not allow minting with empty metadata URI", async function () {
      await expect(
        nft.connect(agent).mint(buyer.address, "", creator.address)
      ).to.be.revertedWith("Empty metadata URI");
    });

    it("Should not allow minting to zero address", async function () {
      await expect(
        nft.connect(agent).mint(ethers.ZeroAddress, metadataURI, creator.address)
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should not allow minting with zero creator address", async function () {
      await expect(
        nft.connect(agent).mint(buyer.address, metadataURI, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid creator");
    });
  });

  describe("Royalties (ERC2981)", function () {
    const metadataURI = "ipfs://QmTest123";
    const salePrice = ethers.parseEther("1.0");

    beforeEach(async function () {
      await nft.whitelistAgent(agent.address);
      await nft.connect(agent).mint(buyer.address, metadataURI, creator.address);
    });

    it("Should return correct royalty info (10%)", async function () {
      const [receiver, royaltyAmount] = await nft.royaltyInfo(1, salePrice);
      expect(receiver).to.equal(creator.address);
      expect(royaltyAmount).to.equal(ethers.parseEther("0.1")); // 10% of 1 ETH
    });

    it("Should support ERC2981 interface", async function () {
      const ERC2981_INTERFACE_ID = "0x2a55205a";
      expect(await nft.supportsInterface(ERC2981_INTERFACE_ID)).to.be.true;
    });

    it("Should support ERC721 interface", async function () {
      const ERC721_INTERFACE_ID = "0x80ac58cd";
      expect(await nft.supportsInterface(ERC721_INTERFACE_ID)).to.be.true;
    });
  });

  describe("Token Operations", function () {
    const metadataURI = "ipfs://QmTest123";

    beforeEach(async function () {
      await nft.whitelistAgent(agent.address);
      await nft.connect(agent).mint(buyer.address, metadataURI, creator.address);
    });

    it("Should allow token transfers", async function () {
      await nft.connect(buyer).transferFrom(buyer.address, agent.address, 1);
      expect(await nft.ownerOf(1)).to.equal(agent.address);
    });

    it("Should revert on querying non-existent token", async function () {
      await expect(nft.tokenURI(999)).to.be.revertedWithCustomError(
        nft,
        "ERC721NonexistentToken"
      );
    });

    it("Should revert on querying creator of non-existent token", async function () {
      await expect(nft.creatorOf(999)).to.be.revertedWithCustomError(
        nft,
        "ERC721NonexistentToken"
      );
    });
  });
});
