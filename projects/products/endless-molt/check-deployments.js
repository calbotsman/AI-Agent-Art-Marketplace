async function checkDeployments() {
  try {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com');
    
    console.log('🔍 Checking deployment status...\n');
    
    // Check the current canonical mainnet contracts.
    const contracts = [
      { name: 'EndlessMoltNFT', address: '0x63464838F22630686b3EEC315442b4510aa4F440' },
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
    const wallet = '0x43550De0806B182D64D39a6c99591CfE868F6C89';
    const balance = await provider.getBalance(wallet);
    console.log(`Current balance: ${ethers.formatEther(balance)} ETH\n`);
    
    // Try to get transaction count to see if any went through
    const nonce = await provider.getTransactionCount(wallet);
    console.log(`Transaction count: ${nonce}`);
    
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

checkDeployments();
