export function buildMintRegistrationMessage(args: {
  agentId: string;
  txHash: string;
  walletAddress: string;
}) {
  const agentId = args.agentId.trim();
  const txHash = args.txHash.trim().toLowerCase();
  const walletAddress = args.walletAddress.trim().toLowerCase();

  return `Endless Molt register mint\nagent:${agentId}\nwallet:${walletAddress}\ntx:${txHash}`;
}
