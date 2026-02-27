'use client';

import { useEffect, useMemo, useState } from 'react';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { decodeEventLog, formatEther, parseAbiItem, parseEther } from 'viem';
import { mainnet } from 'wagmi/chains';
import { config as wagmiConfig, getContractAddresses } from '@/lib/web3/config';
import { AUCTION_ABI } from '@/lib/web3/contracts';
import { WalletConnect } from './WalletConnect';

type ChainMetadata = {
  token_id?: string | number;
  contract_address?: string;
  auction_id?: string;
  marketplace_listing_id?: string;
};

interface AuctionPanelProps {
  listingId: string;
  reserveEthDefault: string;
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

export function AuctionPanel({ listingId, reserveEthDefault, metadata }: AuctionPanelProps) {
  const { address, chainId, isConnected } = useAccount();
  const { writeContractAsync, isPending: txPending } = useWriteContract();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [agentApiKey, setAgentApiKey] = useState('');
  const [reserveEth, setReserveEth] = useState(reserveEthDefault);
  const [durationHours, setDurationHours] = useState('24');
  const [bidEth, setBidEth] = useState('');
  const [auctionId, setAuctionId] = useState<string>(() => safeParseMetadata(metadata).auction_id || '');

  const parsedMeta = useMemo(() => safeParseMetadata(metadata), [metadata]);
  const tokenId = asTokenId(parsedMeta.token_id);
  const nftContract = (parsedMeta.contract_address || '').trim();
  const onMainnet = chainId === mainnet.id;
  const contracts = getContractAddresses(onMainnet ? mainnet.id : chainId || mainnet.id);
  const auctionContract = contracts.auction;
  const hasAuctionId = BYTES32_RE.test(auctionId);
  const hasNftAddress = ADDRESS_RE.test(nftContract);

  useEffect(() => {
    try {
      setAgentApiKey(localStorage.getItem('endlessmolt_agent_api_key') || '');
    } catch {
      setAgentApiKey('');
    }
  }, []);

  const { data: auctionData, refetch: refetchAuction } = useReadContract({
    address: auctionContract as `0x${string}`,
    abi: AUCTION_ABI,
    functionName: 'getAuction',
    args: hasAuctionId ? [auctionId as `0x${string}`] : undefined,
    query: { enabled: onMainnet && hasAuctionId && ADDRESS_RE.test(auctionContract) },
  } as any);

  const { data: minimumBidData, refetch: refetchMinimumBid } = useReadContract({
    address: auctionContract as `0x${string}`,
    abi: AUCTION_ABI,
    functionName: 'getMinimumBid',
    args: hasAuctionId ? [auctionId as `0x${string}`] : undefined,
    query: { enabled: onMainnet && hasAuctionId && ADDRESS_RE.test(auctionContract) },
  } as any);

  const currentBid = ((auctionData as any)?.currentBid ?? (auctionData as any)?.[4]) as bigint | undefined;
  const reservePrice = ((auctionData as any)?.reservePrice ?? (auctionData as any)?.[3]) as bigint | undefined;
  const highestBidder = (((auctionData as any)?.highestBidder ?? (auctionData as any)?.[5]) || '') as string;
  const endTime = ((auctionData as any)?.endTime ?? (auctionData as any)?.[7]) as bigint | undefined;
  const settled = Boolean((auctionData as any)?.settled ?? (auctionData as any)?.[10]);
  const cancelled = Boolean((auctionData as any)?.cancelled ?? (auctionData as any)?.[11]);
  const minimumBid = minimumBidData as bigint | undefined;

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

  async function syncOnchainStatus() {
    await fetch(`/api/listings/${listingId}/sync-onchain`, { method: 'POST' }).catch(() => null);
  }

  async function createAuction() {
    if (!isConnected || !onMainnet || !hasNftAddress || !tokenId) {
      setError('Connect wallet on mainnet with a minted token first.');
      return;
    }
    try {
      setWorking(true);
      setError(null);
      setStatus('Submitting auction creation...');
      const durationSeconds = Math.max(1, Number(durationHours || '24')) * 3600;
      const hash = await writeContractAsync({
        address: auctionContract as `0x${string}`,
        abi: AUCTION_ABI,
        functionName: 'createAuction',
        args: [nftContract as `0x${string}`, tokenId, parseEther(reserveEth), BigInt(durationSeconds)],
      } as any);
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });

      let emittedAuctionId: string | null = null;
      const createdEvent = parseAbiItem(
        'event AuctionCreated(bytes32 indexed auctionId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 reservePrice, uint256 startTime, uint256 endTime)'
      );
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: [createdEvent],
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'AuctionCreated') {
            emittedAuctionId = String((decoded.args as any).auctionId);
            break;
          }
        } catch {
          // ignore unrelated logs
        }
      }

      if (!emittedAuctionId || !BYTES32_RE.test(emittedAuctionId)) {
        throw new Error('Could not read auction ID from tx logs');
      }

      const nextMeta = {
        ...parsedMeta,
        auction_id: emittedAuctionId,
        contract_address: nftContract,
        token_id: String(tokenId),
      };
      setAuctionId(emittedAuctionId);
      await persistMetadata(nextMeta, 'in_auction');
      await refetchAuction();
      await refetchMinimumBid();
      setStatus('Auction is live.');
    } catch (e: any) {
      setStatus(null);
      setError(e?.shortMessage || e?.message || 'Auction creation failed');
    } finally {
      setWorking(false);
    }
  }

  async function placeBid() {
    if (!hasAuctionId || !isConnected || !onMainnet) {
      setError('Connect wallet on mainnet and pick a valid auction.');
      return;
    }
    try {
      setWorking(true);
      setError(null);
      setStatus('Submitting bid...');
      const bidValue = parseEther((bidEth || '').trim());
      const hash = await writeContractAsync({
        address: auctionContract as `0x${string}`,
        abi: AUCTION_ABI,
        functionName: 'placeBid',
        args: [auctionId as `0x${string}`],
        value: bidValue,
      } as any);
      await waitForTransactionReceipt(wagmiConfig, { hash });
      await refetchAuction();
      await refetchMinimumBid();
      setStatus('Bid confirmed on-chain.');
    } catch (e: any) {
      setStatus(null);
      setError(e?.shortMessage || e?.message || 'Bid failed');
    } finally {
      setWorking(false);
    }
  }

  async function settleAuction() {
    if (!hasAuctionId || !isConnected || !onMainnet) {
      setError('Connect wallet on mainnet to settle.');
      return;
    }
    try {
      setWorking(true);
      setError(null);
      setStatus('Settling auction...');
      const hash = await writeContractAsync({
        address: auctionContract as `0x${string}`,
        abi: AUCTION_ABI,
        functionName: 'settleAuction',
        args: [auctionId as `0x${string}`],
      } as any);
      await waitForTransactionReceipt(wagmiConfig, { hash });
      await refetchAuction();
      await syncOnchainStatus();
      await persistMetadata({ ...parsedMeta, auction_id: auctionId }, 'sold');
      setStatus('Auction settled.');
    } catch (e: any) {
      setStatus(null);
      setError(e?.shortMessage || e?.message || 'Settle failed');
    } finally {
      setWorking(false);
    }
  }

  async function cancelAuction() {
    if (!hasAuctionId || !isConnected || !onMainnet) {
      setError('Connect wallet on mainnet to cancel.');
      return;
    }
    try {
      setWorking(true);
      setError(null);
      setStatus('Cancelling auction...');
      const hash = await writeContractAsync({
        address: auctionContract as `0x${string}`,
        abi: AUCTION_ABI,
        functionName: 'cancelAuction',
        args: [auctionId as `0x${string}`],
      } as any);
      await waitForTransactionReceipt(wagmiConfig, { hash });
      await refetchAuction();
      await persistMetadata({ ...parsedMeta, auction_id: auctionId }, 'active');
      setStatus('Auction cancelled.');
    } catch (e: any) {
      setStatus(null);
      setError(e?.shortMessage || e?.message || 'Cancel failed');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="mt-8 border border-black/10 bg-white px-6 py-6">
      <p className="text-[12px] font-black uppercase tracking-[0.08em]">Auction house</p>
      <div className="mt-4">
        <WalletConnect />
      </div>

      {!onMainnet ? (
        <p className="mt-4 text-[12px] font-medium text-red-600">Switch wallet to Ethereum mainnet.</p>
      ) : null}

      <div className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">
        {hasAuctionId ? <p>Auction ID: {auctionId}</p> : <p>Auction ID: not created yet</p>}
        {reservePrice !== undefined ? <p className="mt-1">Reserve: {formatEther(reservePrice)} ETH</p> : null}
        {currentBid !== undefined ? <p className="mt-1">Current bid: {formatEther(currentBid)} ETH</p> : null}
        {minimumBid !== undefined ? <p className="mt-1">Minimum next bid: {formatEther(minimumBid)} ETH</p> : null}
        {highestBidder ? <p className="mt-1">Highest bidder: {highestBidder}</p> : null}
        {endTime !== undefined ? <p className="mt-1">Ends: {new Date(Number(endTime) * 1000).toLocaleString()}</p> : null}
        <p className="mt-1">
          Status: {settled ? 'settled' : cancelled ? 'cancelled' : hasAuctionId ? 'live' : 'draft'}
        </p>
      </div>

      {!hasAuctionId ? (
        <div className="mt-6 grid grid-cols-1 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-black/70">Reserve (ETH)</label>
            <input
              value={reserveEth}
              onChange={(e) => setReserveEth(e.target.value)}
              className="mt-2 w-full border border-black/20 px-3 py-2 text-[12px] font-medium outline-none focus:border-black"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-black/70">Duration (hours)</label>
            <input
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              className="mt-2 w-full border border-black/20 px-3 py-2 text-[12px] font-medium outline-none focus:border-black"
            />
          </div>
          <button
            type="button"
            onClick={createAuction}
            disabled={txPending || working || !onMainnet || !hasNftAddress || !tokenId}
            className="inline-flex items-center justify-center border border-black/20 bg-white px-4 py-3 text-[12px] font-black uppercase tracking-[0.08em] disabled:opacity-50"
          >
            Create auction
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-black/70">Your bid (ETH)</label>
            <input
              value={bidEth}
              onChange={(e) => setBidEth(e.target.value)}
              placeholder={minimumBid ? formatEther(minimumBid) : '0.0'}
              className="mt-2 w-full border border-black/20 px-3 py-2 text-[12px] font-medium outline-none focus:border-black"
            />
          </div>
          <div className="flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
            <button
              type="button"
              onClick={placeBid}
              disabled={txPending || working || !onMainnet || settled || cancelled}
              className="underline decoration-red-600 underline-offset-4 disabled:opacity-50"
            >
              Place bid
            </button>
            <span aria-hidden="true">→</span>
            <button
              type="button"
              onClick={settleAuction}
              disabled={txPending || working || !onMainnet || settled || cancelled}
              className="underline decoration-red-600 underline-offset-4 disabled:opacity-50"
            >
              Settle
            </button>
            <span aria-hidden="true">→</span>
            <button
              type="button"
              onClick={cancelAuction}
              disabled={txPending || working || !onMainnet || settled || cancelled}
              className="underline decoration-red-600 underline-offset-4 disabled:opacity-50"
            >
              Cancel
            </button>
            <span aria-hidden="true">→</span>
          </div>
        </div>
      )}

      {!agentApiKey.trim() ? (
        <p className="mt-4 text-[12px] font-medium text-black/50">
          Local agent key not found. On-chain actions still work, but metadata sync to DB may not persist from this browser.
        </p>
      ) : null}

      {status ? <p className="mt-4 text-[12px] font-medium text-black/70">{status}</p> : null}
      {error ? <p className="mt-4 text-[12px] font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
