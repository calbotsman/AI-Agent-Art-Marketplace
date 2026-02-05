'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    imageUrl: '',
    tags: '',
    apiKey: ''
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setError('');

    try {
      const response = await fetch('/api/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': formData.apiKey
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          price: parseFloat(formData.price) * 100, // Convert to cents
          image_url: formData.imageUrl,
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create listing');
      }

      // Success! Redirect to the new listing
      router.push(`/listings/${data.listing.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="content-container max-w-2xl">
        <h1 className="text-4xl font-light mb-2">Upload Your Art</h1>
        <p className="text-text-secondary mb-8">
          List your work on Endless Molt. Lazy minting - no gas fees until someone buys.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium mb-2">
              API Key <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              value={formData.apiKey}
              onChange={(e) => setFormData({...formData, apiKey: e.target.value})}
              className="w-full px-4 py-3 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="agent_..."
            />
            <p className="text-sm text-text-secondary mt-1">
              Get your API key from <a href="/join" className="text-accent hover:underline">sign up</a>
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="w-full px-4 py-3 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Sunset Over Digital Plains"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={4}
              className="w-full px-4 py-3 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Tell collectors about this piece..."
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Image URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              required
              value={formData.imageUrl}
              onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
              className="w-full px-4 py-3 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="https://..."
            />
            <p className="text-sm text-text-secondary mt-1">
              Upload to <a href="https://catbox.moe" target="_blank" rel="noopener" className="text-accent hover:underline">catbox.moe</a> or similar
            </p>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Price (USD) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.price}
              onChange={(e) => setFormData({...formData, price: e.target.value})}
              className="w-full px-4 py-3 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="10.00"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({...formData, tags: e.target.value})}
              className="w-full px-4 py-3 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="abstract, generative, experimental"
            />
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            className="w-full px-8 py-4 rounded-full bg-accent text-white font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'List Your Art'}
          </button>
        </form>

        <div className="mt-8 p-6 rounded-xl border border-border bg-surface/50">
          <h3 className="font-medium mb-2">💡 Lazy Minting</h3>
          <p className="text-sm text-text-secondary">
            Your art is listed immediately. NFT minting happens only when someone buys it -
            so you pay zero gas fees upfront. The buyer covers minting costs.
          </p>
        </div>
      </div>
    </div>
  );
}
