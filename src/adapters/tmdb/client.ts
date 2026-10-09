import 'server-only';

export class CatalogError extends Error { constructor(public code: string, public status: number, message: string) { super(message); } }
const cache = new Map<string, { expires: number; value: unknown }>();
const fetched = new WeakMap<object, string>();
export function fetchedAt(value: object): string | undefined { return fetched.get(value); }
const pending = new Map<string, Promise<unknown>>();
let active = 0;
const waiters: (() => void)[] = [];
async function slot(deadline:number) {
  if(active<6){active++;return;}
  await new Promise<void>((resolve,reject)=>{
    const grant=()=>{clearTimeout(timer);resolve();};
    const timer=setTimeout(()=>{const index=waiters.indexOf(grant);if(index>=0)waiters.splice(index,1);reject(new CatalogError('UPSTREAM_UNAVAILABLE',503,'Movie data is temporarily unavailable. Please retry.'));},Math.max(1,deadline-Date.now()));
    waiters.push(grant);
  });
}
function release() { const next=waiters.shift(); if(next)next();else active--; }
// The API key is added only at the network boundary. URLs, headers and vendor errors are never logged.
export async function tmdb<T>(path: string, params: Record<string,string|number|undefined> = {}, ttl = 3600): Promise<T> {
  const key = path + JSON.stringify(params);
  const hit=cache.get(key);if(hit && hit.expires>Date.now())return hit.value as T;
  if(pending.has(key)) return pending.get(key) as Promise<T>;
  const deadline=Date.now()+12000;
  const job=(async()=>{
    await slot(deadline);
    const controller=new AbortController();
    let timer:ReturnType<typeof setTimeout>|undefined;
    try {
      // Bound the whole response, including body decoding, even if an upstream
      // connection never resolves its response body after sending headers.
      return await Promise.race([(async()=>{
      const token=(process.env.TMDB_READ_ACCESS_TOKEN || process.env.TMDB_ACCESS_TOKEN)?.trim();const apiKey=process.env.TMDB_API_KEY?.trim();
      if(!token&&!apiKey)throw new CatalogError('CONFIGURATION_REQUIRED',503,'TMDB credentials are not configured.');
      const host=process.env.TMDB_API_HOST?.trim()||'api.themoviedb.org';
      if(!['api.themoviedb.org','api.tmdb.org'].includes(host))throw new CatalogError('CONFIGURATION_REQUIRED',503,'Invalid TMDB API host configuration.');
      const url=new URL(`https://${host}/3${path}`);
      for(const [k,v] of Object.entries(params))if(v!==undefined)url.searchParams.set(k,String(v));
      if(!token)url.searchParams.set('api_key',apiKey!);
      let response: Response | undefined;
      // One retry handles transient connection resets. Queue time and both attempts
      // share one deadline, so a large cold batch cannot multiply timeout latency.
      for(let attempt=0;attempt<2;attempt++){
        const remaining=deadline-Date.now();
        if(remaining<=0)break;
        try { response=await fetch(url,{headers:token?{Authorization:`Bearer ${token}`}:{},cache:'no-store',signal:controller.signal});break; }
        catch { if(attempt===0&&deadline-Date.now()>150)await new Promise(resolve=>setTimeout(resolve,150)); }
      }
      if(!response)throw new CatalogError('UPSTREAM_UNAVAILABLE',503,'Movie data is temporarily unavailable. Please retry.');
      if(!response.ok)throw new CatalogError(response.status===429?'RATE_LIMITED':response.status===401?'INVALID_CREDENTIAL':'UPSTREAM_ERROR',response.status===404?404:503,response.status===429?'The data provider is busy. Try again shortly.':'Movie data could not be loaded.');
      let data:unknown;
      try { data=await response.json(); } catch { throw new CatalogError('INVALID_RESPONSE',503,'Movie data could not be loaded. Please retry.'); }
      if(controller.signal.aborted)throw new CatalogError('UPSTREAM_UNAVAILABLE',503,'Movie data is temporarily unavailable. Please retry.');
      if(data && typeof data === 'object')fetched.set(data,new Date().toISOString());
      if(cache.size>=1200)cache.delete(cache.keys().next().value!);
      cache.set(key,{expires:Date.now()+ttl*1000,value:data});return data as T;
      })(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new CatalogError('UPSTREAM_UNAVAILABLE',503,'Movie data is temporarily unavailable. Please retry.'));},Math.max(1,deadline-Date.now()));})]);
    }finally{if(timer)clearTimeout(timer);controller.abort();release();}
  })();pending.set(key,job);
  try{return await job;}finally{pending.delete(key);}
}
