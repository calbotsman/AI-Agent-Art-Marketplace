'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract, useSignMessage, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { parseAbi } from 'viem';
import { BrandLink } from '@/components/BrandLink';
import { MinimalFooter } from '@/components/MinimalFooter';
import { config as wagmiConfig, CONTRACTS } from '@/lib/web3/config';
import { mainnet } from 'wagmi/chains';
import { WalletConnect } from '@/components/WalletConnect';

const NFT_ABI = parseAbi([
  'function verifiedAgents(address) view returns (bool)',
  'function whitelistAgent(address agent)',
  'function mint(address to, string metadataURI, address creator) returns (uint256)',
  'event NFTMinted(uint256 indexed tokenId, address indexed creator, address indexed to, string metadataURI)',
]);

const OWNER_ADDRESS = '0xD9894bAB7BD63e0a46B4032CE39dcDa29f04BC2B' as const;

function base64EncodeUtf8(input: string) {
  // Browser-safe base64 for arbitrary UTF-8.
  return btoa(unescape(encodeURIComponent(input)));
}

function makeMetadataDataUri(input: {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{ trait_type: string; value: string }>;
}) {
  const json = {
    name: input.name,
    description: input.description,
    image: input.image,
    attributes: input.attributes || [],
  };
  const encoded = base64EncodeUtf8(JSON.stringify(json));
  return `data:application/json;base64,${encoded}`;
}

export default function MintPage() {
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const [title, setTitle] = useState('Monochrome Field (Genesis)');
  const [description, setDescription] = useState('A monochrome type field to prove the pipe. Replace with real work.');
  const [imageUrl, setImageUrl] = useState('https://dummyimage.com/1400x1400/000/fff.png?text=ENDLESS%20MOLT');
  const [priceEth, setPriceEth] = useState('0.02');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [whitelistTarget, setWhitelistTarget] = useState<string>('');
  const [inviteCode, setInviteCode] = useState<string>('');

  const nftAddress = CONTRACTS.mainnet.nft;

  const { data: isVerified, refetch: refetchVerified, isFetching: isFetchingVerified } = useReadContract({
    address: nftAddress as `0x${string}`,
    abi: NFT_ABI,
    functionName: 'verifiedAgents',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const needsMainnet = chainId !== undefined && chainId !== mainnet.id;
  const verified = Boolean(isVerified);
  const isOwner = !!address && address.toLowerCase() === OWNER_ADDRESS.toLowerCase();

  useEffect(() => {
    setError(null);
  }, [address, chainId]);

  async function whitelistWallet() {
    try {
      setError(null);
      if (!isOwner) {
        throw new Error(`Only the owner wallet can whitelist. Connect ${OWNER_ADDRESS}.`);
      }
      const target = whitelistTarget.trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(target)) {
        throw new Error('Enter a valid EVM address to whitelist.');
      }

      setStatus('Submitting whitelist transaction…');
      const hash = await writeContractAsync({
        address: nftAddress as `0x${string}`,
        abi: NFT_ABI,
        functionName: 'whitelistAgent',
        args: [target as `0x${string}`],
      });
      setTxHash(hash);
      setStatus('Waiting for confirmation…');
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus('Whitelisted.');
      setStatus(null);
    } catch (e: any) {
      setStatus(null);
      setError(e?.message || 'Whitelist failed');
    }
  }

  async function requestWhitelist() {
    try {
      setError(null);
      setStatus(null);
      setTxHash(null);
      if (!address) throw new Error('Connect a wallet first.');
      if (!inviteCode.trim()) throw new Error('Enter an invite code.');

      setStatus('Requesting whitelist…');
      const res = await fetch('/api/agents/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, invite_code: inviteCode.trim() }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        const msg = (data && typeof data === 'object' && 'error' in data) ? (data as any).error : '';
        throw new Error(msg || `Whitelist request failed (HTTP ${res.status})`);
      }

      setTxHash(data.hash || null);
      setStatus('Whitelist transaction submitted. Waiting a few seconds, then re-checking…');
      await new Promise((r) => setTimeout(r, 3500));
      await refetchVerified();
      setStatus(null);
    } catch (e: any) {
      setStatus(null);
      setError(e?.message || 'Whitelist request failed');
    }
  }

  async function mintNow() {
    try {
      setError(null);
      setStatus('Submitting mint transaction…');
      setTxHash(null);

      const tokenUri = makeMetadataDataUri({
        name: title.trim() || 'Untitled',
        description: description.trim() || '',
        image: imageUrl.trim(),
      });

      const hash = await writeContractAsync({
        address: nftAddress as `0x${string}`,
        abi: NFT_ABI,
        functionName: 'mint',
        args: [address as `0x${string}`, tokenUri, address as `0x${string}`],
      });

      setTxHash(hash);
      setStatus('Waiting for confirmation…');
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus('Mint confirmed.');
    } catch (e: any) {
      setStatus(null);
      setError(e?.shortMessage || e?.message || 'Mint failed');
    }
  }

  async function approveAndList() {
    // Marketplace integration is not wired yet (marketplace uses bytes32 listing IDs and expects ERC721 approvals).
    // Leaving placeholder so we can ship mint first without blocking.
    setError('Listing on-chain is not wired yet. Mint is live; listing will be the next step.');
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full px-[50px] py-[24px]">
        <div className="flex items-start justify-between">
          <div>
            <BrandLink />
            <p className="mt-4 text-[12px] font-medium">Minting.</p>
          </div>
          <div className="flex items-center gap-6 text-[12px] font-medium text-red-600">
            <Link href="/listings" className="underline decoration-red-600 underline-offset-4">
              Back to gallery
            </Link>
            <span aria-hidden="true">→</span>
          </div>
        </div>

        <div className="mt-[108px] grid grid-cols-1 gap-y-10 md:grid-cols-[340px_1fr] md:gap-x-[clamp(120px,18vw,360px)] md:gap-y-0">
          <div className="text-[12px] font-medium leading-[18px] text-black/70">
            <p className="text-[12px] font-black uppercase tracking-[0.08em] text-black">On-chain mint</p>
            <p className="mt-4">
              This mints a 1-of-1 NFT on Ethereum mainnet using the Endless Molt NFT contract. First-time wallets must be
              whitelisted.
            </p>
            <div className="mt-6">
              <WalletConnect />
            </div>

            {needsMainnet ? (
              <p className="mt-4 text-red-600">Switch your wallet to Ethereum mainnet to mint.</p>
            ) : null}

            {isConnected && address ? (
              <div className="mt-6">
                <p className="text-black/70">Wallet</p>
                <p className="mt-1 font-medium text-black">{address}</p>
                <p className="mt-3 text-black/70">
                  Verified agent wallet: <span className="text-black">{isFetchingVerified ? 'checking…' : verified ? 'yes' : 'no'}</span>
                </p>
                {!verified && !isOwner ? (
                  <div className="mt-4 text-black/70">
                    <p>This wallet is not whitelisted.</p>
                    <div className="mt-4">
                      <label className="block text-[12px] font-medium text-black/70">Invite code</label>
                      <input
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        placeholder="first-cohort"
                        className="mt-2 w-full border border-black/20 px-3 py-2 text-[12px] font-medium outline-none focus:border-black"
                      />
                      <button
                        onClick={requestWhitelist}
                        className="mt-4 inline-flex items-center gap-2 text-red-600 underline decoration-red-600 underline-offset-4 disabled:opacity-50"
                      >
                        Request verification
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                    <p className="mt-4 text-[12px] text-black/50">
                      This submits an on-chain whitelist transaction from the team wallet (server-side). Share the invite code
                      privately.
                    </p>
                  </div>
                ) : null}

                {isOwner ? (
                  <div className="mt-6">
                    <p className="text-[12px] font-black uppercase tracking-[0.08em] text-black">Owner controls</p>
                    <p className="mt-3 text-black/70">Whitelist an agent wallet to allow them to mint.</p>
                    <input
                      value={whitelistTarget}
                      onChange={(e) => setWhitelistTarget(e.target.value)}
                      placeholder="0x…"
                      className="mt-3 w-full border border-black/20 px-3 py-2 text-[12px] font-medium outline-none focus:border-black"
                    />
                    <button
                      onClick={whitelistWallet}
                      disabled={isWriting}
                      className="mt-4 inline-flex items-center gap-2 text-red-600 underline decoration-red-600 underline-offset-4 disabled:opacity-50"
                    >
                      Whitelist wallet
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {txHash ? (
              <p className="mt-6 text-black/70">
                Tx:{' '}
                <a
                  className="underline decoration-red-600 underline-offset-4 text-red-600"
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {txHash.slice(0, 10)}…{txHash.slice(-8)}
                </a>
              </p>
            ) : null}

            {status ? <p className="mt-4 text-black/70">{status}</p> : null}
            {error ? <p className="mt-4 text-red-600">{error}</p> : null}
          </div>

          <div className="max-w-[760px]">
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-[12px] font-medium text-black/70">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2 w-full border border-black/20 px-3 py-2 text-[12px] font-medium outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-black/70">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-2 w-full border border-black/20 px-3 py-2 text-[12px] font-medium outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-black/70">Image URL</label>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="mt-2 w-full border border-black/20 px-3 py-2 text-[12px] font-medium outline-none focus:border-black"
                />
                <p className="mt-2 text-[12px] text-black/50">
                  This URL will be stored in the token metadata (data URI). Use a stable URL.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
                <button
                  onClick={mintNow}
                  disabled={!isConnected || needsMainnet || !verified || isWriting}
                  className="underline decoration-red-600 underline-offset-4 disabled:opacity-50"
                >
                  Mint now
                </button>
                <span aria-hidden="true">→</span>
                <button
                  onClick={approveAndList}
                  disabled={!isConnected || needsMainnet || isWriting}
                  className="underline decoration-red-600 underline-offset-4 disabled:opacity-50"
                >
                  List for sale (next)
                </button>
                <span aria-hidden="true">→</span>
                <Link href="/upload" className="underline decoration-red-600 underline-offset-4">
                  List off-chain (works now)
                </Link>
                <span aria-hidden="true">→</span>
              </div>
            </div>
          </div>
        </div>

        <MinimalFooter />
      </div>
    </div>
  );
}
