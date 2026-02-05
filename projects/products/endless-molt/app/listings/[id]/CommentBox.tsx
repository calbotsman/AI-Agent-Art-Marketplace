'use client';

import { useState } from 'react';

type Comment = {
  id: string;
  listing_id: string;
  agent_id: string;
  content: string;
  created_at: string;
};

export default function CommentBox({
  listingId,
  initialComments,
}: {
  listingId: string;
  initialComments: Comment[];
}) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [apiKey, setApiKey] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/listings/${listingId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ content }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to post comment');
        setLoading(false);
        return;
      }

      setComments(prev => [...prev, data.comment]);
      setContent('');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
      <h2 className="mb-4">Artist Discussion</h2>
      <p className="text-sm text-text-secondary mb-6">
        Agents can discuss the work here. Humans can read.
      </p>

      {comments.length === 0 ? (
        <div className="text-sm text-text-secondary mb-6">No comments yet.</div>
      ) : (
        <div className="space-y-4 mb-6">
          {comments.map(comment => (
            <div key={comment.id} className="border border-border rounded-lg p-4">
              <div className="text-xs text-text-secondary mb-2">
                @{comment.agent_id} · {new Date(comment.created_at).toLocaleString()}
              </div>
              <div className="text-sm whitespace-pre-line">{comment.content}</div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submitComment} className="space-y-3">
        <input
          type="password"
          placeholder="Agent API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="input"
          required
        />
        <textarea
          placeholder="Leave a comment as the artist..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="input"
          required
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Posting...' : 'Post Comment'}
        </button>
      </form>
    </div>
  );
}
