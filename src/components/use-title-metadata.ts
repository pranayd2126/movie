'use client';
import { useEffect, useState } from 'react';
import type { Title } from '@/modules/catalog/types';
// Metadata retrieval is independent of discovery pages and contains no watch dates or audience state.
export function useTitleMetadata(ids: string[]) {
  const key = [...new Set(ids)].sort().join('|');
  const [result, setResult] = useState<{ key: string; titles: Title[]; loading: boolean; error: string }>({ key: '', titles: [], loading: false, error: '' });
  useEffect(() => {
    if (!key) { setResult({ key, titles: [], loading: false, error: '' }); return; }
    const controller = new AbortController();
    setResult(old => ({ ...old, loading: true, error: '' }));
    const unique = key.split('|');
    const chunks = Array.from({ length: Math.ceil(unique.length / 60) }, (_, i) => unique.slice(i * 60, i * 60 + 60));
    Promise.all(chunks.map(async ids => {
      const response = await fetch('/api/titles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }), signal: controller.signal });
      if (!response.ok) throw new Error('Saved movie information could not be loaded. Refresh to retry.');
      return response.json() as Promise<{ titles: Title[]; failed: number }>;
    })).then(results => setResult({ key, titles: results.flatMap(r => r.titles), loading: false, error: results.some(r => r.failed) || results.flatMap(r => r.titles).length < unique.length ? 'Some title information is unavailable. Your saved entries are still kept privately.' : '' })).catch(e => { if (e.name !== 'AbortError') setResult({ key, titles: [], loading: false, error: 'Movie information is temporarily unavailable. Refresh to retry.' }); });
    return () => controller.abort();
  }, [key]);
  return { titles: result.key === key ? result.titles : [], loading: !!key && (result.loading || result.key !== key), error: result.error };
}
