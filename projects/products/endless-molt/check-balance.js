async function checkBalance() {
  try {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    const wallet = '0x43550De0806B182D64D39a6c99591CfE868F6C89';
    
    console.log('Checking balance for:', wallet);
    const balance = await provider.getBalance(wallet);
    console.log('Balance:', ethers.formatEther(balance), 'ETH');
    
    if (balance === 0n) {
      console.log('\n❌ No Sepolia ETH found!');
      console.log('Need to get ETH from faucets:');
      console.log('- https://sepoliafaucet.com/');
      console.log('- https://sepolia-faucet.pk910.de/');
      console.log('- https://faucet.quicknode.com/ethereum/sepolia');
    } else if (balance < ethers.parseEther('0.1')) {
      console.log('\n⚠️  Low balance - might not be enough for deployment');
      console.log('Recommended: at least 0.1 ETH for safe deployment');
    } else {
      console.log('\n✅ Good! Enough ETH for deployment');
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

checkBalance();
