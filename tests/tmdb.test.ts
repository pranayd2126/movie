import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmdb, CatalogError } from '../src/adapters/tmdb/client';
import { getCatalog } from '../src/adapters/tmdb/catalog';

test('TMDB outages, partial pools, failed hydration, invalid JSON and retries are contained', async () => {
  const originalFetch = globalThis.fetch;
  const oldToken = process.env.TMDB_READ_ACCESS_TOKEN;
  process.env.TMDB_READ_ACCESS_TOKEN = 'test-only-not-a-real-credential';
  let mode = 'partial', attempts = 0;
  const json = (value: unknown) => Response.json(value);
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'api.themoviedb.org');
    if (url.pathname.endsWith('/configuration')) return json({ images: { secure_base_url: 'https://image.tmdb.org/t/p/' } });
    if (url.pathname.includes('/genre/tv/')) {
      // Reproduce the original race: a movie job rejects while TV prerequisites are pending.
      await new Promise(resolve => setTimeout(resolve, 30));
      return json({ genres: [{ id: 18, name: 'Drama' }] });
    }
    if (url.pathname.includes('/genre/')) return json({ genres: [{ id: 18, name: 'Drama' }] });
    if (url.pathname.endsWith('/discover/movie')) throw new TypeError('simulated network failure');
    if (url.pathname.endsWith('/discover/tv')) return json({ results: [{ id: 12, name: 'Test only', genre_ids: [18] }], total_pages: 1 });
    if (url.pathname.endsWith('/tv/12')) throw new TypeError('simulated detail timeout');
    if (mode === 'invalid') return new Response('not JSON');
    if (mode === 'rate') return new Response('{}', { status: 429 });
    if (mode === 'retry' && ++attempts > 2) return json({ recovered: true });
    throw new TypeError('simulated offline');
  };
  try {
    const page = await getCatalog({ generators: [{ id: 'broken', mediaType: 'movie', kind: 'discover' }, { id: 'working', mediaType: 'tv', kind: 'discover' }] });
    assert.equal(page.titles.length, 1);
    assert.equal(page.titles[0].availabilityStatus, 'error');
    assert.deepEqual(page.titles[0].offers, []);
    assert.equal(page.warnings?.length, 2);
    await assert.rejects(getCatalog({ generators: [{ id: 'broken', mediaType: 'movie', kind: 'discover' }] }), CatalogError);
    mode = 'invalid';
    await assert.rejects(tmdb('/test-invalid'), (e: unknown) => e instanceof CatalogError && e.code === 'INVALID_RESPONSE');
    mode = 'rate';
    await assert.rejects(tmdb('/test-rate'), (e: unknown) => e instanceof CatalogError && e.code === 'RATE_LIMITED');
    mode = 'retry';
    await assert.rejects(tmdb('/test-retry'), CatalogError);
    assert.deepEqual(await tmdb('/test-retry'), { recovered: true });
    assert.equal(attempts, 3, 'Failed promises are evicted so retry can recover');
  } finally {
    globalThis.fetch = originalFetch;
    if (oldToken === undefined) delete process.env.TMDB_READ_ACCESS_TOKEN;
    else process.env.TMDB_READ_ACCESS_TOKEN = oldToken;
  }
});

test('a stalled response body and queued requests expire, releasing capacity for retry',async()=>{
 const originalFetch=globalThis.fetch,oldToken=process.env.TMDB_READ_ACCESS_TOKEN;
 process.env.TMDB_READ_ACCESS_TOKEN='test-only-not-a-real-credential';
 globalThis.fetch=async()=>({ok:true,json:()=>new Promise(()=>{})} as unknown as Response);
 try{
  const started=Date.now();const outcomes=await Promise.allSettled(Array.from({length:7},(_,i)=>tmdb(`/test-stalled-${i}`)));
  assert.ok(outcomes.every(r=>r.status==='rejected'&&r.reason instanceof CatalogError));
  assert.ok(Date.now()-started<14000,'Queue and body decoding share a bounded deadline');
  globalThis.fetch=async()=>Response.json({recovered:true});
  assert.deepEqual(await tmdb('/test-after-stall'),{recovered:true});
 }finally{globalThis.fetch=originalFetch;if(oldToken===undefined)delete process.env.TMDB_READ_ACCESS_TOKEN;else process.env.TMDB_READ_ACCESS_TOKEN=oldToken;}
});

test('TMDB host override accepts only first-party API hosts',async()=>{
 const fetchBefore=globalThis.fetch,hostBefore=process.env.TMDB_API_HOST,tokenBefore=process.env.TMDB_READ_ACCESS_TOKEN;
 process.env.TMDB_READ_ACCESS_TOKEN='test-only-not-a-real-credential';
 let requests=0;globalThis.fetch=async input=>{assert.equal(new URL(String(input)).hostname,'api.tmdb.org');requests++;return Response.json({ok:true});};
 try{process.env.TMDB_API_HOST='api.tmdb.org';assert.deepEqual(await tmdb('/test-allowed-host'),{ok:true});process.env.TMDB_API_HOST='untrusted.example';await assert.rejects(tmdb('/test-rejected-host'),CatalogError);assert.equal(requests,1);}
 finally{globalThis.fetch=fetchBefore;if(hostBefore===undefined)delete process.env.TMDB_API_HOST;else process.env.TMDB_API_HOST=hostBefore;if(tokenBefore===undefined)delete process.env.TMDB_READ_ACCESS_TOKEN;else process.env.TMDB_READ_ACCESS_TOKEN=tokenBefore;}
});
