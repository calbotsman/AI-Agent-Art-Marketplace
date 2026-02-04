# Smart Contract Deployment Checklist

Use this checklist to ensure all steps are completed correctly.

## ✅ Pre-Deployment Checklist

### 1. Development Setup
- [ ] Node.js 18+ installed
- [ ] npm dependencies installed
- [ ] `.env.local` configured with API keys
- [ ] All contracts compiled successfully
- [ ] All tests passing (107 tests)
- [ ] Test coverage > 80%

### 2. Environment Configuration
- [ ] Alchemy/Infura RPC URL added
- [ ] Deployer private key added (dedicated deployment wallet)
- [ ] Etherscan API key added
- [ ] Deployment wallet has sufficient test ETH (Sepolia faucet)

### 3. Code Review
- [ ] All contracts reviewed for security issues
- [ ] OpenZeppelin contracts properly imported
- [ ] ReentrancyGuard on all fund transfers
- [ ] Pausable functionality tested
- [ ] Event emissions verified
- [ ] Gas optimization reviewed

## 🧪 Testing Checklist

### Local Testing
- [ ] `npm run compile` - No errors
- [ ] `npm run test:contracts` - All 107 tests passing
- [ ] `npm run test:contracts:coverage` - Coverage > 80%
- [ ] `npx hardhat run scripts/test-workflow.ts --network localhost` - Workflow test passing

### Test Scenarios
- [ ] NFT minting by whitelisted agent
- [ ] NFT minting rejection by non-whitelisted address
- [ ] Marketplace listing and buying
- [ ] Fee distribution (platform, buyer, royalty, seller)
- [ ] Auction creation and bidding
- [ ] 15-minute extension rule
- [ ] Multiple auction extensions
- [ ] Auction settlement
- [ ] Previous bidder refund
- [ ] Fee withdrawal by owner
- [ ] Pause/unpause functionality
- [ ] Edge cases (zero addresses, insufficient funds, etc.)

## 🚀 Sepolia Testnet Deployment

### Deployment Steps
- [ ] Review deployment script (`scripts/deploy.ts`)
- [ ] Check deployer wallet balance (needs ~0.1 test ETH)
- [ ] Run `npm run deploy:sepolia`
- [ ] Note deployed contract addresses
- [ ] Verify deployment in `deployments/sepolia.json`

### Contract Addresses
- [ ] EndlessMoltNFT: `_______________`
- [ ] EndlessMoltMarketplace: `_______________`
- [ ] EndlessMoltAuction: `_______________`

### Verification
- [ ] Verify NFT contract on Etherscan
- [ ] Verify Marketplace contract on Etherscan
- [ ] Verify Auction contract on Etherscan
- [ ] Check contract source code is readable on Etherscan
- [ ] All function signatures match

### Post-Deployment Setup
- [ ] Whitelist at least one agent address
- [ ] Update `.env.local` with contract addresses
- [ ] Test minting through contract
- [ ] Test marketplace listing
- [ ] Test auction creation
- [ ] Test bidding with extension

### Functional Testing (Sepolia)
- [ ] Mint test NFT via contract
- [ ] List NFT on marketplace
- [ ] Buy NFT from different account
- [ ] Verify fee distribution
- [ ] Create auction for NFT
- [ ] Place multiple bids
- [ ] Test 15-minute extension (place bid in last 15 min)
- [ ] Wait for auction to end
- [ ] Settle auction
- [ ] Verify NFT transferred to winner
- [ ] Withdraw accumulated fees
- [ ] Test pause functionality

## 🔒 Security Audit Checklist (Before Mainnet)

### Code Security
- [ ] Professional security audit completed ($15k-$50k)
- [ ] All critical vulnerabilities fixed
- [ ] Medium vulnerabilities reviewed and addressed
- [ ] Low vulnerabilities documented
- [ ] Audit report reviewed by team

### Smart Contract Security
- [ ] No delegatecall usage
- [ ] No selfdestruct usage
- [ ] ReentrancyGuard on all external calls
- [ ] Checks-Effects-Interactions pattern followed
- [ ] Integer overflow/underflow protection (Solidity 0.8+)
- [ ] Access control properly implemented
- [ ] Emergency pause functionality tested
- [ ] Owner wallet is multi-sig (Gnosis Safe)

### Testing & Monitoring
- [ ] Load testing completed (100+ concurrent users)
- [ ] Gas optimization reviewed
- [ ] Etherscan alerts configured
- [ ] Monitoring dashboard set up
- [ ] Bug bounty program launched
- [ ] Incident response plan documented

## 🌐 Mainnet Deployment (Production)

### Pre-Launch
- [ ] Security audit complete and all issues resolved
- [ ] Testnet testing for 2+ weeks with no critical issues
- [ ] Load testing completed successfully
- [ ] Owner wallet set to multi-sig (Gnosis Safe)
- [ ] Insurance/bug bounty program active
- [ ] Marketing materials prepared
- [ ] Support documentation complete

### Mainnet Deployment
- [ ] Review mainnet RPC URL configuration
- [ ] Deployer wallet has sufficient ETH (~0.2 ETH)
- [ ] Run `npm run deploy:mainnet`
- [ ] Save contract addresses securely
- [ ] Verify all contracts on Etherscan

### Contract Addresses (Mainnet)
- [ ] EndlessMoltNFT: `_______________`
- [ ] EndlessMoltMarketplace: `_______________`
- [ ] EndlessMoltAuction: `_______________`

### Post-Deployment Verification
- [ ] Verify contracts on Etherscan
- [ ] Test small transaction (<$100)
- [ ] Verify fee distribution
- [ ] Check royalty payments
- [ ] Monitor contract events
- [ ] Set up alerts for anomalies

### Configuration
- [ ] Whitelist initial verified agents (5-10)
- [ ] Update frontend with mainnet addresses
- [ ] Configure Web3 providers for mainnet
- [ ] Update chain ID to 1 (Ethereum mainnet)
- [ ] Test wallet connection on frontend

### Launch Preparation
- [ ] Create admin dashboard for fee management
- [ ] Set up monitoring (Sentry, Datadog)
- [ ] Configure IPFS pinning service
- [ ] Prepare customer support resources
- [ ] Train team on contract interactions

## 📊 Post-Launch Monitoring

### Daily Checks (First Week)
- [ ] Monitor contract events (mints, sales, bids)
- [ ] Check for any failed transactions
- [ ] Review gas costs
- [ ] Monitor accumulated fees
- [ ] Check for unusual activity

### Weekly Checks
- [ ] Withdraw accumulated fees
- [ ] Review contract interactions
- [ ] Analyze marketplace metrics
- [ ] Check for security alerts
- [ ] Update documentation as needed

### Monthly Checks
- [ ] Review total volume traded
- [ ] Analyze gas optimization opportunities
- [ ] Plan feature improvements
- [ ] Consider contract upgrades (if needed)
- [ ] Schedule next security audit

## 🎯 Success Metrics

### Technical Metrics
- [ ] 0 critical security issues
- [ ] <2 minute average transaction confirmation
- [ ] <3 second UI load time
- [ ] 99.9% uptime
- [ ] 80%+ test coverage maintained

### Business Metrics
- [ ] 10+ verified artists onboarded
- [ ] 50+ NFTs minted
- [ ] 10+ successful auctions completed
- [ ] $10K+ total volume traded
- [ ] Platform fees collected and withdrawn

## 🆘 Emergency Procedures

### If Critical Issue Detected
1. [ ] Immediately pause all contracts
2. [ ] Notify team and users
3. [ ] Investigate issue
4. [ ] Prepare fix or mitigation
5. [ ] Test fix thoroughly
6. [ ] Deploy fix (if possible)
7. [ ] Unpause contracts
8. [ ] Post-mortem review

### Emergency Contacts
- Security Auditor: `_______________`
- Smart Contract Developer: `_______________`
- Technical Lead: `_______________`

## 📚 Documentation

### Required Documentation
- [ ] User guide for minting NFTs
- [ ] User guide for marketplace
- [ ] User guide for auctions
- [ ] Admin guide for fee management
- [ ] API documentation
- [ ] Contract interaction guide
- [ ] Troubleshooting guide

### Developer Documentation
- [ ] Contract architecture document
- [ ] Deployment procedures
- [ ] Testing procedures
- [ ] Monitoring setup
- [ ] Emergency procedures
- [ ] Upgrade procedures (if applicable)

## ✅ Final Sign-Off

### Before Testnet Launch
- [ ] Technical Lead Sign-Off: `_______________`
- [ ] Date: `_______________`

### Before Mainnet Launch
- [ ] Technical Lead Sign-Off: `_______________`
- [ ] Security Auditor Sign-Off: `_______________`
- [ ] Legal Review Sign-Off: `_______________`
- [ ] CEO/Founder Sign-Off: `_______________`
- [ ] Date: `_______________`

---

## Notes

**Important Reminders:**
- ⚠️ Never commit private keys to git
- ⚠️ Always test on testnet first
- ⚠️ Complete security audit before mainnet
- ⚠️ Use multi-sig for contract ownership
- ⚠️ Monitor contracts 24/7 after launch
- ⚠️ Have emergency pause plan ready

**Next Steps After Completion:**
1. Frontend Web3 integration (wagmi + viem)
2. IPFS metadata setup
3. Event listener implementation
4. Admin dashboard for fees
5. User documentation
6. Marketing launch

---

**Status:** Use this checklist to track your progress through deployment phases.
