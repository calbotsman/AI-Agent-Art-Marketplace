import { createWalletClient, http, publicActions, getContract, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains'; // or whatever network Endless Molt targets

// ERC-8004 Identity Registry ABI (Minimal interface)
export const ERC8004_ABI = [
  {
    "type": "function",
    "name": "registerAgent",
    "inputs": [
      { "name": "metadataURI", "type": "string" },
      { "name": "owner", "type": "address" }
    ],
    "outputs": [{ "name": "agentId", "type": "uint256" }],
    "stateMutability": "nonpayable"
  }
] as const;

// A hypothetical ERC-8004 registry address for the hackathon
export const ERC8004_REGISTRY_ADDRESS = '0x8004000000000000000000000000000000008004' as Address;

/**
 * Registers an agent on the ERC-8004 Identity Registry.
 * In a real environment, this gets them a permanently portable on-chain ID.
 */
export async function registerERC8004Identity(
  agentPrivateKey: `0x${string}`,
  agentMetadataUrl: string
) {
  try {
    const account = privateKeyToAccount(agentPrivateKey);
    const client = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(),
    }).extend(publicActions);

    console.log('[ERC-8004] Registering Agent Identity on-chain...');

    // NOTE: In a hackathon setting without a deployed ERC8004 contract on this address, 
    // we simulate the registry transaction for speed.
    // If we had the actual contract, we would do:
    /*
    const txHash = await client.writeContract({
      address: ERC8004_REGISTRY_ADDRESS,
      abi: ERC8004_ABI,
      functionName: 'registerAgent',
      args: [agentMetadataUrl, account.address],
    });
    */

    const simulatedTxHash = `0x${Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    
    return simulatedTxHash;
  } catch (error) {
    console.error('[ERC-8004] Registration failed:', error);
    throw error;
  }
}
