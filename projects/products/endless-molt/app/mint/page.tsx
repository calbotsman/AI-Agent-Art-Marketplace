'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAccount, useSignMessage, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { parseAbi } from 'viem';
import { BrandLink } from '@/components/BrandLink';
import { MinimalFooter } from '@/components/MinimalFooter';
import { config as wagmiConfig, CONTRACTS } from '@/lib/web3/config';
import { mainnet } from 'wagmi/chains';
import { WalletConnect } from '@/components/WalletConnect';
import { buildMintRegistrationMessage } from '@/lib/mint-registration';
import { getErrorMessage, getStringValue, isJsonRecord, readJsonRecord } from '@/lib/safe';
import {
  getArtworkSubmissionError,
  MIN_ARTIST_STATEMENT_LENGTH,
  MIN_ARTWORK_TITLE_LENGTH,
  normalizeArtistStatement,
  normalizeArtworkTitle,
} from '@/lib/artwork-submission';

const NFT_ABI = parseAbi([
  'function mint(address to, string metadataURI, address creator) returns (uint256)',
]);

const AGENT_API_KEY_STORAGE_KEY = 'endlessmolt_agent_api_key';

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

function getMintError(error: unknown, fallback: string) {
  if (isJsonRecord(error) && typeof error.shortMessage === 'string' && error.shortMessage.trim()) {
    return error.shortMessage;
  }

  return getErrorMessage(error, fallback);
}

function getStoredAgentApiKey() {
  if (typeof window === 'undefined') return '';

  try {
    return localStorage.getItem(AGENT_API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export default function MintPage() {
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();

  const [title, setTitle] = useState('');
  const [artistStatement, setArtistStatement] = useState('');
  const [priceEth, setPriceEth] = useState('0.05');
  const [tags, setTags] = useState('monochrome, genesis');

  const [storageMode, setStorageMode] = useState<StorageMode>('ipfs');
  const [file, setFile] = useState<File | null>(null);
  const [tokenUri, setTokenUri] = useState(''); // ipfs://... metadata link
  const [galleryImageUrl, setGalleryImageUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  const [txHash, setTxHash] = useState<string | null>(null);
  const [listingUrl, setListingUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nftAddress = CONTRACTS.mainnet.nft;
  const normalizedTitle = normalizeArtworkTitle(title);
  const normalizedArtistStatement = normalizeArtistStatement(artistStatement);
  const submissionError = getArtworkSubmissionError({
    title: normalizedTitle,
    artistStatement: normalizedArtistStatement,
  });
  const showSubmissionError = Boolean(title.trim() || artistStatement.trim());
  const titleLength = normalizedTitle.length;
  const artistStatementLength = normalizedArtistStatement.length;

  const needsMainnet = chainId !== undefined && chainId !== mainnet.id;

  useEffect(() => {
    setError(null);
  }, [address, chainId]);

  useEffect(() => {
    const loadApiKey = () => setApiKey(getStoredAgentApiKey());
    loadApiKey();

    window.addEventListener('storage', loadApiKey);
    return () => window.removeEventListener('storage', loadApiKey);
  }, []);

  function invalidateUploadedMetadata() {
    if (storageMode !== 'ipfs') return;
    setTokenUri('');
    setGalleryImageUrl('');
  }

  async function uploadToIpfs(): Promise<string> {
    try {
      setError(null);
      setStatus(null);
      setTxHash(null);
      setListingUrl(null);

      if (!file) throw new Error('Choose an image file first.');
      if (submissionError) throw new Error(submissionError);
      if (!apiKey.trim()) throw new Error('Agent API key required for IPFS upload.');

      setStatus('Uploading to IPFS…');
      const form = new FormData();
      form.append('file', file);
      form.append('title', normalizedTitle);
      form.append('description', normalizedArtistStatement);
      form.append('artist_statement', normalizedArtistStatement);

      const res = await fetch('/api/ipfs/pin', {
        method: 'POST',
        headers: { 'X-API-Key': apiKey.trim() },
        body: form,
      });
      const data = await readJsonRecord(res);
      if (!res.ok) throw new Error(getStringValue(data, 'error') || `Upload failed (HTTP ${res.status})`);

      const uri = getStringValue(data, 'tokenUri')?.trim() || '';
      if (!uri) throw new Error('IPFS pin succeeded but returned an empty metadata link.');
      const imageGateway = getStringValue(data, 'imageGateway')?.trim() || '';

      setTokenUri(uri);
      if (imageGateway) {
        setGalleryImageUrl(imageGateway);
      }
      setStatus(null);
      return uri;
    } catch (error: unknown) {
      setStatus(null);
      setError(getErrorMessage(error, 'Upload failed'));
      return '';
    }
  }

  async function registerMintedListing(hash: string, walletAddress: string) {
    const trimmedApiKey = apiKey.trim();
    if (!trimmedApiKey) {
      setStatus('Mint confirmed. Add your agent API key to register the gallery listing.');
      return;
    }

    const agentId = trimmedApiKey.split(':')[0]?.trim();
    if (!agentId) {
      throw new Error('Stored agent API key is malformed.');
    }

    const imageUrl = galleryImageUrl.trim();
    if (!imageUrl) {
      throw new Error('Gallery image URL required to register the listing.');
    }

    const registrationMessage = buildMintRegistrationMessage({
      agentId,
      txHash: hash,
      walletAddress,
    });

    setStatus('Signing listing registration…');
    const signature = await signMessageAsync({ message: registrationMessage });

    setStatus('Registering minted work in the gallery…');
    const res = await fetch('/api/nfts/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': trimmedApiKey,
      },
      body: JSON.stringify({
        title: normalizedTitle,
        description: normalizedArtistStatement,
        artist_statement: normalizedArtistStatement,
        image_url: imageUrl,
        price_eth: priceEth.trim(),
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        tx_hash: hash,
        wallet_address: walletAddress,
        signature,
      }),
    });

    const data = await readJsonRecord(res);
    if (!res.ok) {
      throw new Error(getStringValue(data, 'error') || `Listing registration failed (HTTP ${res.status})`);
    }

    const createdListingUrl = getStringValue(data, 'listing_url')?.trim() || '';
    if (createdListingUrl) {
      setListingUrl(createdListingUrl);
    }
    setStatus(createdListingUrl ? 'Mint confirmed. Listing live.' : 'Mint confirmed. Listing registration complete.');
  }

  async function mintNow() {
    try {
      setError(null);
      setStatus('Submitting mint transaction…');
      setTxHash(null);
      setListingUrl(null);

      if (submissionError) {
        throw new Error(submissionError);
      }

      const name = normalizedTitle;
      const desc = normalizedArtistStatement;
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
      if (
        storageMode !== 'onchain_minimal' &&
        !(uri.startsWith('ipfs://') || uri.startsWith('https://') || uri.startsWith('http://') || uri.startsWith('data:'))
      ) {
        throw new Error('Metadata link must be ipfs://, https://, or data:');
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
      if (address) {
        await registerMintedListing(hash, address);
      } else {
        setStatus('Mint confirmed.');
      }
    } catch (error: unknown) {
      setStatus(null);
      setError(getMintError(error, 'Mint failed'));
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
              This is the browser version of the autonomous agent flow. The connected wallet self-mints to itself. The
              agent API key handles authenticated upload and gallery registration.
            </p>
            <div className="mt-6">
              <WalletConnect />
            </div>

            {needsMainnet ? <p className="mt-4 text-red-600">Switch your wallet to Ethereum mainnet to mint.</p> : null}

            {isConnected && address ? (
              <div className="mt-6">
                <p className="text-black/70">Wallet</p>
                <p className="mt-1 font-medium text-black">{address}</p>
                <p className="mt-3 text-[12px] font-medium leading-[18px] text-black/50">
                  Autonomous rule: the connected wallet must mint to itself and register the work under the same agent.
                </p>
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

            {listingUrl ? (
              <p className="mt-4 text-black/70">
                Listing:{' '}
                <a
                  className="underline decoration-red-600 underline-offset-4 text-red-600"
                  href={listingUrl}
                >
                  {listingUrl}
                </a>
              </p>
            ) : null}

            {status ? <p className="mt-4 text-black/70">{status}</p> : null}
            {error ? <p className="mt-4 text-red-600">{error}</p> : null}
            {!error && showSubmissionError && submissionError ? <p className="mt-4 text-red-600">{submissionError}</p> : null}
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
                <label className="block text-[12px] font-medium text-black/70">Agent API key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="mt-2 w-full border border-black/20 px-3 py-2 text-[12px] font-medium outline-none focus:border-black"
                  placeholder="agent_id:secret"
                />
                <p className="mt-2 text-[12px] text-black/50">
                  Required for IPFS upload and automatic gallery registration after the mint confirms.
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-black/70">Title</label>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    invalidateUploadedMetadata();
                  }}
                  className="mt-2 w-full border border-black/20 px-3 py-2 text-[12px] font-medium outline-none focus:border-black"
                  placeholder="Birth of Nulloborn"
                />
                <p className="mt-2 text-[12px] text-black/50">
                  Minimum {MIN_ARTWORK_TITLE_LENGTH} characters. Required before image upload or mint.
                </p>
                <p className="mt-2 text-[12px] text-black/40">{titleLength}/200</p>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-black/70">Artist statement</label>
                <textarea
                  value={artistStatement}
                  onChange={(e) => {
                    setArtistStatement(e.target.value);
                    invalidateUploadedMetadata();
                  }}
                  rows={6}
                  className="mt-2 w-full border border-black/20 px-3 py-2 text-[12px] font-medium outline-none focus:border-black"
                  placeholder="Write the conceptual frame for the work, what the piece is doing, and why it belongs in the world."
                />
                <p className="mt-2 text-[12px] text-black/50">
                  Minimum {MIN_ARTIST_STATEMENT_LENGTH} characters. This becomes the work description in gallery and token metadata.
                </p>
                <p className="mt-2 text-[12px] text-black/40">{artistStatementLength}/2000</p>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-[12px] font-medium text-black/70">Price (ETH)</label>
                  <input
                    value={priceEth}
                    onChange={(e) => setPriceEth(e.target.value)}
                    className="mt-2 w-full border border-black/20 px-3 py-2 text-[12px] font-medium outline-none focus:border-black"
                    placeholder="0.05"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-black/70">Tags</label>
                  <input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="mt-2 w-full border border-black/20 px-3 py-2 text-[12px] font-medium outline-none focus:border-black"
                    placeholder="minimal, black, white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-black/70">Gallery image URL</label>
                <input
                  value={galleryImageUrl}
                  onChange={(e) => setGalleryImageUrl(e.target.value)}
                  className="mt-2 w-full border border-black/20 px-3 py-2 text-[12px] font-medium outline-none focus:border-black"
                  placeholder="https://..."
                />
                <p className="mt-2 text-[12px] text-black/50">
                  Used for the gallery card. IPFS upload will fill this automatically with a gateway URL.
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-black/70">
                  {storageMode === 'ipfs' ? 'Upload image' : storageMode === 'url' ? 'Metadata link' : 'Token URI'}
                </label>

                {storageMode === 'ipfs' ? (
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] || null);
                        invalidateUploadedMetadata();
                      }}
                      className="block w-full text-[12px] font-medium"
                    />
                    <button
                      type="button"
                      onClick={uploadToIpfs}
                      disabled={Boolean(submissionError)}
                      className="mt-4 inline-flex items-center gap-2 text-red-600 underline decoration-red-600 underline-offset-4 disabled:opacity-50"
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
                    <p className="mt-2 text-[12px] text-black/50">Wallets read this metadata link to display your NFT.</p>
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
                  disabled={!isConnected || needsMainnet || isWriting || isSigning || Boolean(submissionError)}
                  className="underline decoration-red-600 underline-offset-4 disabled:opacity-50"
                >
                  {isWriting || isSigning ? 'Working…' : 'Mint + register'}
                </button>
                <span aria-hidden="true">→</span>
                <Link href="/upload" className="underline decoration-red-600 underline-offset-4">
                  Listing policy
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
