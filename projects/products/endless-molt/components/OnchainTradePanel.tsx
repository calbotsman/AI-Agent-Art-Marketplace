'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { decodeEventLog, formatEther, parseAbiItem, parseEther } from 'viem';
import { mainnet } from 'wagmi/chains';
import { config as wagmiConfig, getContractAddresses } from '@/lib/web3/config';
import { MARKETPLACE_ABI, NFT_ABI } from '@/lib/web3/contracts';
import { WalletConnect } from './WalletConnect';
import { trackEvent } from '@/lib/telemetry/client';

type ChainMetadata = {
  token_id?: string | number;
  contract_address?: string;
  marketplace_listing_id?: string;
  list_tx_hash?: string;
};

interface OnchainTradePanelProps {
  listingId: string;
  agentId: string;
  priceEth: string;
  metadata: string | null;
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const BYTES32_RE = /^0x[a-fA-F0-9]{64}$/;

function safeParseMetadata(raw: string | null): ChainMetadata {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ChainMetadata) : {};
  } catch {
    return {};
  }
}

function asTokenId(value: unknown): bigint | null {
  if (value === undefined || value === null || value === '') return null;
  try {
    return BigInt(String(value));
  } catch {
    return null;
  }
}

export function OnchainTradePanel({ listingId, agentId, priceEth, metadata }: OnchainTradePanelProps) {
  const { chainId, isConnected } = useAccount();
  const { writeContractAsync, isPending: txPending } = useWriteContract();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [agentApiKey, setAgentApiKey] = useState('');
  const [chainListingId, setChainListingId] = useState<string>(() => safeParseMetadata(metadata).marketplace_listing_id || '');

  const parsedMeta = useMemo(() => safeParseMetadata(metadata), [metadata]);
  const nftContract = (parsedMeta.contract_address || '').trim();
  const tokenId = asTokenId(parsedMeta.token_id);
  const onMainnet = chainId === mainnet.id;
  const contracts = getContractAddresses(onMainnet ? mainnet.id : chainId || mainnet.id);
  const marketplace = contracts.marketplace;
  const hasChainListingId = BYTES32_RE.test(chainListingId);
  const hasNftAddress = ADDRESS_RE.test(nftContract);

  useEffect(() => {
    try {
      setAgentApiKey(localStorage.getItem('endlessmolt_agent_api_key') || '');
    } catch {
      setAgentApiKey('');
    }
  }, []);

  const {
    data: listingData,
    refetch: refetchListing,
    isFetching: listingFetching,
  } = useReadContract({
    address: marketplace as `0x${string}`,
    abi: MARKETPLACE_ABI,
    functionName: 'getListing',
    args: hasChainListingId ? [chainListingId as `0x${string}`] : undefined,
    query: { enabled: onMainnet && hasChainListingId && ADDRESS_RE.test(marketplace) },
  } as any);

  const onchainPrice = ((listingData as any)?.price ?? (listingData as any)?.[3]) as bigint | undefined;
  const onchainActive = Boolean((listingData as any)?.active ?? (listingData as any)?.[4]);
  const onchainSeller = (((listingData as any)?.seller ?? (listingData as any)?.[0]) || '') as string;

  async function syncOnchainStatus() {
    await fetch(`/api/listings/${listingId}/sync-onchain`, { method: 'POST' }).catch(() => null);
  }

  async function persistMetadata(nextMeta: Record<string, unknown>, nextStatus?: 'active' | 'in_auction' | 'sold') {
    if (!agentApiKey.trim()) return;
    await fetch(`/api/listings/${listingId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': agentApiKey.trim(),
      },
      body: JSON.stringify({
        metadata: nextMeta,
        ...(nextStatus ? { status: nextStatus } : {}),
      }),
    });
  }

  async function approveMarketplace() {
    if (!isConnected || !onMainnet || !hasNftAddress || !tokenId) {
      setError('Connect wallet on mainnet with a minted token first.');
      return;
    }

    try {
      setWorking(true);
      setError(null);
      setStatus('Approving marketplace contract...');
      const hash = await writeContractAsync({
        address: nftContract as `0x${string}`,
        abi: NFT_ABI,
        functionName: 'approve',
        args: [marketplace as `0x${string}`, tokenId],
      } as any);
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus('Marketplace approval confirmed.');
    } catch (e: any) {
      setStatus(null);
      setError(e?.shortMessage || e?.message || 'Approval failed');
    } finally {
      setWorking(false);
    }
  }

  async function listOnchain() {
    if (!isConnected || !onMainnet || !hasNftAddress || !tokenId) {
      setError('Connect wallet on mainnet with a minted token first.');
      return;
    }

    try {
      setWorking(true);
      setError(null);
      setStatus('Submitting on-chain listing...');
      const hash = await writeContractAsync({
        address: marketplace as `0x${string}`,
        abi: MARKETPLACE_ABI,
        functionName: 'listNFT',
        args: [nftContract as `0x${string}`, tokenId, parseEther(priceEth)],
      } as any);
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });

      let emittedId: string | null = null;
      const listedEvent = parseAbiItem(
        'event Listed(bytes32 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price)'
      );
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: [listedEvent],
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'Listed') {
            emittedId = String((decoded.args as any).listingId);
            break;
          }
        } catch {
          // ignore unrelated logs
        }
      }

      if (!emittedId || !BYTES32_RE.test(emittedId)) {
        throw new Error('Could not read on-chain listing ID from tx logs');
      }

      const nextMeta = {
        ...parsedMeta,
        marketplace_listing_id: emittedId,
        contract_address: nftContract,
        token_id: String(tokenId),
        list_tx_hash: hash,
      };
      setChainListingId(emittedId);
      await persistMetadata(nextMeta, 'active');
      await refetchListing();
      setStatus('On-chain listing is live.');
    } catch (e: any) {
      setStatus(null);
      setError(e?.shortMessage || e?.message || 'On-chain listing failed');
    } finally {
      setWorking(false);
    }
  }

  async function buyNow() {
    if (!hasChainListingId) {
      setError('This piece is not listed on-chain yet.');
      return;
    }
    if (!isConnected || !onMainnet) {
      setError('Connect wallet on Ethereum mainnet to buy.');
      return;
    }
    if (!onchainPrice || onchainPrice <= 0n) {
      setError('On-chain price unavailable.');
      return;
    }

    try {
      setWorking(true);
      setError(null);
      setStatus('Submitting buy transaction...');
      trackEvent('buy_clicked', {
        listing_id: listingId,
        chain_listing_id: chainListingId,
      });
      const hash = await writeContractAsync({
        address: marketplace as `0x${string}`,
        abi: MARKETPLACE_ABI,
        functionName: 'buyNFT',
        args: [chainListingId as `0x${string}`],
        value: onchainPrice,
      } as any);
      await waitForTransactionReceipt(wagmiConfig, { hash });
      await refetchListing();
      await syncOnchainStatus();
      trackEvent('buy_confirmed', {
        listing_id: listingId,
        chain_listing_id: chainListingId,
        tx_hash: hash,
      });
      setStatus('Purchase confirmed on-chain.');
    } catch (e: any) {
      setStatus(null);
      trackEvent('buy_failed', {
        listing_id: listingId,
        chain_listing_id: chainListingId,
        reason: e?.shortMessage || e?.message || 'buy_failed',
      });
      setError(e?.shortMessage || e?.message || 'Buy transaction failed');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="mt-6 border border-black/10 bg-white px-6 py-6">
      <p className="text-[12px] font-black uppercase tracking-[0.08em]">On-chain market</p>
      <div className="mt-4">
        <WalletConnect />
      </div>

      {!onMainnet ? (
        <p className="mt-4 text-[12px] font-medium text-red-600">Switch wallet to Ethereum mainnet.</p>
      ) : null}

      <div className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
        <p>Agent: {agentId}</p>
        <p className="mt-1">Price target: {priceEth} ETH</p>
        {hasChainListingId ? <p className="mt-1">Listing ID: {chainListingId}</p> : <p className="mt-1">Listing ID: not created yet</p>}
        {hasChainListingId && listingData ? (
          <p className="mt-1">
            Chain status: {listingFetching ? 'loading...' : onchainActive ? 'active' : 'filled / inactive'}
          </p>
        ) : null}
        {hasChainListingId && onchainPrice ? <p className="mt-1">On-chain price: {formatEther(onchainPrice)} ETH</p> : null}
        {hasChainListingId && onchainSeller ? <p className="mt-1">Seller wallet: {onchainSeller}</p> : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
        <button
          type="button"
          onClick={approveMarketplace}
          disabled={txPending || working || !hasNftAddress || !tokenId || !onMainnet}
          className="underline decoration-red-600 underline-offset-4 disabled:opacity-50"
        >
          Approve token
        </button>
        <span aria-hidden="true">→</span>
        <button
          type="button"
          onClick={listOnchain}
          disabled={txPending || working || !hasNftAddress || !tokenId || !onMainnet}
          className="underline decoration-red-600 underline-offset-4 disabled:opacity-50"
        >
          List on-chain
        </button>
        <span aria-hidden="true">→</span>
        <button
          type="button"
          onClick={buyNow}
          disabled={txPending || working || !hasChainListingId || !onMainnet || (hasChainListingId && !onchainActive)}
          className="underline decoration-red-600 underline-offset-4 disabled:opacity-50"
        >
          Buy now
        </button>
        <span aria-hidden="true">→</span>
        <Link href={`/auctions/${listingId}`} className="underline decoration-red-600 underline-offset-4">
          Bid / auction view
        </Link>
        <span aria-hidden="true">→</span>
      </div>

      {!agentApiKey.trim() ? (
        <p className="mt-4 text-[12px] font-medium text-black/50">
          Local agent key not found. On-chain trades still work, but DB metadata cannot auto-persist from this browser.
        </p>
      ) : null}

      {status ? <p className="mt-4 text-[12px] font-medium text-black/70">{status}</p> : null}
      {error ? <p className="mt-4 text-[12px] font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
