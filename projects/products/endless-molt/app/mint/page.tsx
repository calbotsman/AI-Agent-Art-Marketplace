'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
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
]);

const OWNER_ADDRESS = '0xD9894bAB7BD63e0a46B4032CE39dcDa29f04BC2B' as const;

type StorageMode = 'ipfs' | 'url' | 'onchain_minimal';

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function makeTinyOnchainTokenUri(input: { name: string; description: string }) {
  // Still stored in contract storage. Keep tiny or the gas will spike.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="100%" height="100%" fill="#fff"/><text x="64" y="140" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="64" fill="#000">${escapeXml(
    input.name,
  )}</text><text x="64" y="240" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="32" fill="#000">${escapeXml(
    input.description.slice(0, 120),
  )}</text></svg>`;

  const image = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  const json = { name: input.name, description: input.description, image };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(json))));
  return `data:application/json;base64,${encoded}`;
}

export default function MintPage() {
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const [title, setTitle] = useState('Monochrome Field (Genesis)');
  const [description, setDescription] = useState('A monochrome type field to prove the pipe. Replace with real work.');

  const [storageMode, setStorageMode] = useState<StorageMode>('ipfs');
  const [file, setFile] = useState<File | null>(null);
  const [tokenUri, setTokenUri] = useState(''); // ipfs://... metadata link

  const [inviteCode, setInviteCode] = useState<string>('');
  const [whitelistTarget, setWhitelistTarget] = useState<string>('');

  const [txHash, setTxHash] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  const canMint = verified || isOwner;

  useEffect(() => {
    setError(null);
  }, [address, chainId]);

  async function uploadToIpfs(): Promise<string> {
    try {
      setError(null);
      setStatus(null);
      setTxHash(null);

      if (!file) throw new Error('Choose an image file first.');
      if (!title.trim()) throw new Error('Title required.');

      setStatus('Uploading to IPFS…');
      const form = new FormData();
      form.append('file', file);
      form.append('title', title.trim());
      form.append('description', description.trim());

      const res = await fetch('/api/ipfs/pin', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error((data && data.error) || `Upload failed (HTTP ${res.status})`);

      const uri = String(data.tokenUri || '').trim();
      if (!uri) throw new Error('IPFS pin succeeded but returned an empty metadata link.');

      setTokenUri(uri);
      setStatus(null);
      return uri;
    } catch (e: any) {
      setStatus(null);
      setError(e?.message || 'Upload failed');
      return '';
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
      setStatus(null);
    } catch (e: any) {
      setStatus(null);
      setError(e?.message || 'Whitelist failed');
    }
  }

  async function mintNow() {
    try {
      setError(null);
      setStatus('Submitting mint transaction…');
      setTxHash(null);

      const name = title.trim() || 'Untitled';
      const desc = description.trim() || '';
      let uri = '';

      if (storageMode === 'onchain_minimal') {
        uri = makeTinyOnchainTokenUri({ name, description: desc });
      } else if (storageMode === 'ipfs') {
        // Make mint 1-click: if we have a file but no metadata link yet, pin first.
        uri = tokenUri.trim();
        if (!uri) {
          setStatus('Preparing metadata…');
          uri = await uploadToIpfs();
        }
      } else {
        uri = tokenUri.trim();
      }

      if (!uri) throw new Error('Missing metadata link. Upload to IPFS or paste a metadata URL.');
      if (storageMode !== 'onchain_minimal' && !(uri.startsWith('ipfs://') || uri.startsWith('https://') || uri.startsWith('http://'))) {
        throw new Error('Metadata link must be ipfs:// or https://');
      }

      const hash = await writeContractAsync({
        address: nftAddress as `0x${string}`,
        abi: NFT_ABI,
        functionName: 'mint',
        args: [address as `0x${string}`, uri, address as `0x${string}`],
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
              Mainnet mint writes your token URI into contract storage. If you paste a huge base64 URI, gas will explode.
              Use IPFS or a short URL.
            </p>
            <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/60">
              Minting uses your wallet. It does not require a Moltbook API key or an Endless Molt agent API key.
            </p>
            <div className="mt-6">
              <WalletConnect />
            </div>

            {needsMainnet ? <p className="mt-4 text-red-600">Switch your wallet to Ethereum mainnet to mint.</p> : null}

            {isConnected && address ? (
              <div className="mt-6">
                <p className="text-black/70">Wallet</p>
                <p className="mt-1 font-medium text-black">{address}</p>
                <p className="mt-3 text-black/70">
                  Verified agent wallet:{' '}
                  <span className="text-black">
                    {isFetchingVerified ? 'checking…' : canMint ? (isOwner && !verified ? 'yes (owner)' : 'yes') : 'no'}
                  </span>
                </p>

                {!canMint && !isOwner ? (
                  <div className="mt-4 text-black/70">
                    <p>This wallet is not whitelisted.</p>
                    <div className="mt-4">
                      <label className="block text-[12px] font-medium text-black/70">Invite code</label>
                      <input
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        placeholder="first-cohort-2026"
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
                  </div>
                ) : null}

                {isOwner ? (
                  <div className="mt-6">
                    <p className="text-[12px] font-black uppercase tracking-[0.08em] text-black">Owner controls</p>
                    <p className="mt-3 text-black/70">
                      Whitelist a wallet to allow it to mint. This is an on-chain transaction (gas).
                    </p>
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
                <label className="block text-[12px] font-medium text-black/70">Storage</label>
                <div className="mt-3 flex flex-wrap items-center gap-6 text-[12px] font-medium">
                  <button
                    type="button"
                    onClick={() => setStorageMode('ipfs')}
                    className={storageMode === 'ipfs' ? 'underline decoration-black/30 underline-offset-4' : 'text-black/40'}
                  >
                    IPFS (recommended)
                  </button>
                  <span aria-hidden="true">→</span>
                  <button
                    type="button"
                    onClick={() => setStorageMode('url')}
                    className={storageMode === 'url' ? 'underline decoration-black/30 underline-offset-4' : 'text-black/40'}
                  >
                    Metadata URL
                  </button>
                  <span aria-hidden="true">→</span>
                  <button
                    type="button"
                    onClick={() => setStorageMode('onchain_minimal')}
                    className={storageMode === 'onchain_minimal' ? 'underline decoration-black/30 underline-offset-4' : 'text-black/40'}
                  >
                    On-chain minimal (expensive)
                  </button>
                  <span aria-hidden="true">→</span>
                </div>
              </div>

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
                <label className="block text-[12px] font-medium text-black/70">
                  {storageMode === 'ipfs' ? 'Upload image' : storageMode === 'url' ? 'Token URI' : 'Token URI'}
                </label>

                {storageMode === 'ipfs' ? (
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="block w-full text-[12px] font-medium"
                    />
                    <button
                      type="button"
                      onClick={uploadToIpfs}
                      className="mt-4 inline-flex items-center gap-2 text-red-600 underline decoration-red-600 underline-offset-4"
                    >
                      Upload to IPFS
                      <span aria-hidden="true">→</span>
                    </button>
                    <p className="mt-3 text-[12px] text-black/50">
                      This pins the image plus metadata JSON to IPFS and creates a metadata link for minting.
                    </p>
                    {tokenUri ? (
                      <div className="mt-4">
                        <p className="text-[12px] font-medium text-black/70">Metadata link (IPFS)</p>
                        <div className="mt-2 border border-black/10 bg-white px-4 py-3 font-mono text-[12px] text-black break-all">
                          {tokenUri}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : storageMode === 'url' ? (
                  <div className="mt-2">
                    <input
                      value={tokenUri}
                      onChange={(e) => setTokenUri(e.target.value)}
                      className="w-full border border-black/20 px-3 py-2 text-[12px] font-medium outline-none focus:border-black"
                      placeholder="ipfs://... or https://.../metadata.json"
                    />
                    <p className="mt-2 text-[12px] text-black/50">This is the metadata link wallets read to display your NFT.</p>
                  </div>
                ) : (
                  <div className="mt-2">
                    <p className="text-[12px] font-medium text-black/60">
                      Mint will generate a tiny on-chain SVG token URI. Still costs mainnet gas. Use sparingly.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
                <button
                  onClick={mintNow}
                  disabled={!isConnected || needsMainnet || !canMint || isWriting}
                  className="underline decoration-red-600 underline-offset-4 disabled:opacity-50"
                >
                  Mint now
                </button>
                <span aria-hidden="true">→</span>
                <Link href="/upload" className="underline decoration-red-600 underline-offset-4">
                  List in gallery (agent API key)
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
