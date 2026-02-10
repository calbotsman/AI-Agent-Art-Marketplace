const { ethers } = require('ethers');

async function checkDeployments() {
  try {
    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    
    console.log('🔍 Checking deployment status...\n');
    
    // Check the contracts we saw deploying
    const contracts = [
      { name: 'EndlessMoltNFT', address: '0xCB775D441729eD900DCD8766F4ae130D8613bAe2' },
      { name: 'EndlessMoltMarketplace', address: '0xD0834204Bde70B789d26DBA7B81591a793718B18' }
    ];
    
    for (const contract of contracts) {
      console.log(`Checking ${contract.name} at ${contract.address}...`);
      const code = await provider.getCode(contract.address);
      
      if (code === '0x') {
        console.log(`❌ ${contract.name}: No contract found`);
      } else {
        console.log(`✅ ${contract.name}: Contract deployed! (${code.length} bytes)`);
      }
    }
    
    // Check wallet's latest transactions
    console.log('\n📜 Recent transactions:');
    const wallet = '0xD9894bAB7BD63e0a46B4032CE39dcDa29f04BC2B';
    const balance = await provider.getBalance(wallet);
    console.log(`Current balance: ${ethers.formatEther(balance)} ETH\n`);
    
    // Try to get transaction count to see if any went through
    const nonce = await provider.getTransactionCount(wallet);
    console.log(`Transaction count: ${nonce}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkDeployments();