import 'server-only';
import { deriveMoods, moodDefinitions } from '@/modules/discovery/moods';
import { genreMatches } from '@/modules/catalog/preferences';
import { selectTrailer, type VideoReference } from '@/modules/catalog/videos';
import { tmdb, CatalogError, fetchedAt } from './client';
import { languageCodes, languageCode, parseTitleRef, type Title, type Provider, type CatalogQuery, type CatalogPage, type CatalogSource, type MediaType, type Mood, type Offer } from '@/modules/catalog/types';

type Row = {id:number;title?:string;name?:string;original_title?:string;original_name?:string;overview?:string;tagline?:string;media_type?:string;adult?:boolean;release_date?:string;first_air_date?:string;original_language?:string;genre_ids?:number[];genres?:{id:number;name:string}[];poster_path?:string;backdrop_path?:string;vote_average?:number;vote_count?:number;popularity?:number;runtime?:number;episode_run_time?:number[];number_of_seasons?:number;belongs_to_collection?:{id:number};created_by?:{name:string}[]};
type ProviderRow={provider_id:number;provider_name:string;logo_path?:string;display_priority?:number;display_priorities?:Record<string,number>};
type Availability = {results?:Record<string,{link?:string;flatrate?:ProviderRow[];rent?:ProviderRow[];buy?:ProviderRow[];free?:ProviderRow[];ads?:ProviderRow[]}>};
type Page={results:Row[];total_pages:number;total_results:number;page:number};
type Details=Row&{credits?:{cast:{id:number;name:string;character?:string;profile_path?:string}[];crew:{id:number;name:string;job:string;profile_path?:string}[]};videos?:{results:VideoReference[]};keywords?:{keywords?:{id:number;name:string}[];results?:{id:number;name:string}[]};'watch/providers'?:Availability;release_dates?:{results:{iso_3166_1:string;release_dates:{certification:string}[]}[]};content_ratings?:{results:{iso_3166_1:string;rating:string}[]}};
const getConfig=()=>tmdb<{images:{secure_base_url:string;poster_sizes:string[];backdrop_sizes:string[]}}>('/configuration',{},86400);
const getGenres=(type:MediaType)=>tmdb<{genres:{id:number;name:string}[]}>(`/genre/${type}/list`,{language:'en'},86400);
function image(base:string,path:string|undefined,size:string){return path&&/^\/[A-Za-z0-9_.-]+$/.test(path)?`${base}${size}${path}`:undefined;}
export function safeWatchUrl(value?:string){try{const u=new URL(value!);return u.protocol==='https:'&&u.hostname==='www.themoviedb.org'?u.href:undefined;}catch{return undefined;}}
export function mapOffers(raw:Availability,base:string,checkedAt?:string):Pick<Title,'offers'|'watchOptionsUrl'|'availabilityStatus'|'availabilityCheckedAt'>{
 const india=raw.results?.IN;const offers:Offer[]=[];
 for(const [key,type] of [['flatrate','subscription'],['rent','rent'],['buy','buy'],['free','free'],['ads','ads']] as const)for(const p of india?.[key]??[])offers.push({provider:String(p.provider_id),name:p.provider_name,logoUrl:image(base,p.logo_path,'w92'),region:'IN',type:key==='flatrate'&&/channel/i.test(p.provider_name)?'addon':type});
 return {offers,watchOptionsUrl:safeWatchUrl(india?.link),availabilityStatus:india?'known':'unknown',availabilityCheckedAt:checkedAt};
}
async function normalize(row:Row,type:MediaType):Promise<Title>{
 const [config,genres]=await Promise.all([getConfig(),getGenres(type)]);const base=config.images.secure_base_url;
 const names=row.genres?.map(g=>g.name)??(row.genre_ids??[]).map(id=>genres.genres.find(g=>g.id===id)?.name).filter((g):g is string=>!!g);
 return {id:`tmdb:${type}:${row.id}`,externalId:row.id,mediaType:type,source:'tmdb',collectionId:row.belongs_to_collection?.id,name:row.title??row.name??'Untitled',originalTitle:row.original_title??row.original_name,tagline:row.tagline??'',synopsis:row.overview??'',kind:type==='movie'?'movie':'series',year:Number((row.release_date??row.first_air_date??'').slice(0,4))||0,language:Object.entries(languageCodes).find(([,code])=>code===row.original_language)?.[0]??row.original_language??'Unknown',originalLanguage:row.original_language,genres:names,runtime:row.runtime??row.episode_run_time?.[0]??0,seasons:row.number_of_seasons,rating:row.vote_average??0,votes:row.vote_count??0,popularity:row.popularity??0,posterUrl:image(base,row.poster_path,'w500'),backdropUrl:image(base,row.backdrop_path,'w1280'),moods:deriveMoods({genres:names}),people:[],offers:[],availabilityStatus:'unknown'};
}
export async function getProviders():Promise<Provider[]>{
 const [movie,tv,config]=await Promise.all([tmdb<{results:ProviderRow[]}>('/watch/providers/movie',{watch_region:'IN'},86400),tmdb<{results:ProviderRow[]}>('/watch/providers/tv',{watch_region:'IN'},86400),getConfig()]);
 const map=new Map<number,Provider>();
 for(const [kind,rows]of [['movie',movie.results],['tv',tv.results]]as const)for(const p of rows){const existing=map.get(p.provider_id);if(existing){existing.mediaTypes!.push(kind);continue;}map.set(p.provider_id,{id:String(p.provider_id),name:p.provider_name,short:p.provider_name.slice(0,3),color:'#ece4d8',logoUrl:image(config.images.secure_base_url,p.logo_path,'w92'),addon:/channel/i.test(p.provider_name),mediaTypes:[kind]});}
 // Presentation priority only; availability is always resolved from actual title offers.
 const priority=['8','119','2336','232','237','350','309','532','561','11','315'];
 return [...map.values()].sort((a,b)=>(priority.includes(a.id)?priority.indexOf(a.id):100)-(priority.includes(b.id)?priority.indexOf(b.id):100));
}
export async function getTitle(ref:string):Promise<Title|undefined>{
 const parsed=parseTitleRef(ref);if(!parsed)return undefined;
 const {mediaType:type,id}=parsed;
 try{const row=await tmdb<Details>(`/${type}/${id}`,{language:'en-US',append_to_response:`credits,videos,keywords,watch/providers,${type==='movie'?'release_dates':'content_ratings'}`},3600);if(row.adult)return undefined;
 const title=await normalize(row,type);const config=await getConfig();const base=config.images.secure_base_url;
 const cast=(row.credits?.cast??[]).slice(0,20).map(p=>({id:p.id,name:p.name,role:p.character??'Cast',image:image(base,p.profile_path,'w185')}));
 const creators=(row.credits?.crew??[]).filter(p=>p.job==='Director').map(p=>({id:p.id,name:p.name,role:'Director',image:image(base,p.profile_path,'w185')}));
 const trailerUrl=selectTrailer(row.videos?.results??[],row.original_language);
 const result:Title={...title,...mapOffers(row['watch/providers']??{},base,fetchedAt(row)),credits:[...creators,...cast],people:[...creators,...cast].map(p=>p.name),creators:[...creators.map(p=>p.name),...(row.created_by??[]).map(p=>p.name)],keywordRefs:row.keywords?.keywords??row.keywords?.results??[],keywords:(row.keywords?.keywords??row.keywords?.results??[]).map(k=>k.name),trailerUrl,certification:type==='movie'?row.release_dates?.results.find(r=>r.iso_3166_1==='IN')?.release_dates.find(r=>r.certification)?.certification:row.content_ratings?.results.find(r=>r.iso_3166_1==='IN')?.rating};
 return {...result,moods:deriveMoods(result)};
 }catch(e){if(e instanceof CatalogError&&e.status===404)return undefined;throw e;}
}
export async function getCatalog(query:CatalogQuery={}):Promise<CatalogPage>{
 const page=Math.min(100,Math.max(1,query.page??1));const types:MediaType[]=query.kind==='movie'?['movie']:query.kind==='series'?['tv']:['movie','tv'];
 type Pool={data:Page;type:MediaType|'mixed';source?:string};
 const jobs:Promise<PromiseSettledResult<Pool | undefined>>[]=[];
 // Attach both handlers immediately, even while other pools await prerequisites.
 const addJob=(job:Promise<Pool | undefined>)=>jobs.push(job.then(value=>({status:'fulfilled' as const,value}),reason=>({status:'rejected' as const,reason})));
 if(query.query?.trim()) addJob(tmdb<Page>('/search/multi',{query:query.query.trim().slice(0,120),page,language:'en-US',include_adult:'false'},300).then(data=>({data,type:'mixed'})));
 else if(query.generators?.length){
  for(const spec of query.generators.slice(0,18))addJob((async()=>{
   const type=spec.mediaType;const genres=await getGenres(type);
   let path=`/discover/${type}`;
   const params:Record<string,string|number|undefined>={page,language:'en-US',include_adult:'false',watch_region:'IN'};
   if(spec.kind==='trending'){path=`/trending/${type}/week`;}
   else if(spec.kind==='recommendations'||spec.kind==='similar'){if(!spec.seedId)return;path=`/${type}/${spec.seedId}/${spec.kind}`;}
   else {
    params.with_original_language=spec.language?languageCode(spec.language):undefined;
    params.with_genres=genres.genres.find(g=>spec.genre&&genreMatches([g.name],spec.genre))?.id;
    if(spec.genre&&!params.with_genres)return;
    if(type==='movie'&&spec.personId)params.with_people=spec.personId;
    if(spec.keywordId)params.with_keywords=spec.keywordId;
    if(spec.providers?.length){params.with_watch_providers=spec.providers.join('|');params.with_watch_monetization_types='flatrate';}
    if(query.maxRuntime)params['with_runtime.lte']=query.maxRuntime-1;
    if(query.minRuntime)params['with_runtime.gte']=query.minRuntime;
    if(query.minRating)params['vote_average.gte']=query.minRating;
    if(query.year)params[type==='movie'?'primary_release_year':'first_air_date_year']=query.year;
    params.sort_by=spec.sort==='quality'?'vote_average.desc':spec.sort==='recent'?(type==='movie'?'primary_release_date.desc':'first_air_date.desc'):'popularity.desc';
    params['vote_count.gte']=spec.sort==='quality'?150:20;
    params[type==='movie'?'primary_release_date.lte':'first_air_date.lte']=new Date().toISOString().slice(0,10);
    if(spec.yearFrom)params[type==='movie'?'primary_release_date.gte':'first_air_date.gte']=`${spec.yearFrom}-01-01`;
   }
   return {data:await tmdb<Page>(path,params,1800),type,source:spec.id};
  })());
 }
 else {
  const langs=(query.languages?.length?query.languages:['Telugu','Hindi','Tamil','Malayalam','English']).slice(0,8);
  const allProviders=await getProviders();const selected=(query.providers??[]).filter(id=>allProviders.some(p=>p.id===id));
  for(const type of types){const genres=await getGenres(type);const genre=genres.genres.find(g=>query.genre&&genreMatches([g.name],query.genre))?.id;
   // Explicit sorts use one globally ordered page per media type. Default pools balance language/provider candidates.
   const pools=query.languages?.length ? langs : query.sort&&query.sort!=='picks' ? [undefined] : langs;
   for(const lang of pools){const params:Record<string,string|number|undefined>={page,include_adult:'false',language:'en-US',watch_region:'IN',with_original_language:lang?languageCode(lang):undefined,with_genres:genre,sort_by:query.sort==='rating'?'vote_average.desc':query.sort==='newest'?(type==='movie'?'primary_release_date.desc':'first_air_date.desc'):query.sort==='alphabetical'?(type==='movie'?'title.asc':'name.asc'):'popularity.desc','vote_count.gte':query.sort==='rating'?100:5,[type==='movie'?'primary_release_date.lte':'first_air_date.lte']:new Date().toISOString().slice(0,10)};
    if(type==='movie')params.region='IN';
    if(query.minRating)params['vote_average.gte']=query.minRating;
    if(query.year)params[type==='movie'?'primary_release_year':'first_air_date_year']=query.year;
    if(query.maxRuntime)params['with_runtime.lte']=query.maxRuntime-1;
    if(query.minRuntime)params['with_runtime.gte']=query.minRuntime;
    if(!genre && query.mood && query.mood!=='All moods'){ const moodGenres=genres.genres.filter(g=>moodDefinitions.find(m=>m.id===query.mood)?.genres.some(name=>genreMatches([g.name],name))); if(moodGenres.length)params.with_genres=moodGenres.map(g=>g.id).join('|'); }
    const eligible=selected.filter(id=>allProviders.find(p=>p.id===id)?.mediaTypes?.includes(type));
    if(selected.length&&!eligible.length)continue;
    if(eligible.length){params.with_watch_providers=eligible.join('|');params.with_watch_monetization_types='flatrate';}
    if(!lang&&query.languages?.length===1)params.with_original_language=languageCode(query.languages[0]);
    addJob(tmdb<Page>(`/discover/${type}`,params,1800).then(data=>({data,type})));
   }
  }
  // Seed pools are retrieval candidates, not canned recommendations. Ranking remains our shared service.
  if(!query.sort||query.sort==='picks')for(const ref of (query.seedIds??[]).slice(0,3)){const parsed=parseTitleRef(ref);if(parsed)addJob(tmdb<Page>(`/${parsed.mediaType}/${parsed.id}/recommendations`,{language:'en-US',page:1},3600).then(data=>({data,type:parsed.mediaType})));}
 }
 const results=await Promise.all(jobs);const successful=results.filter((r):r is PromiseFulfilledResult<Pool>=>r.status==='fulfilled'&&!!r.value);
 if(!jobs.length)return {titles:[],page,hasMore:false};
 if(!successful.length)throw new CatalogError('UPSTREAM_UNAVAILABLE',503,'Movie data could not be loaded. Please retry.');
 const buckets=successful.map(({value:{data,type,source}})=>data.results.filter(r=>!r.adult&&(type!=='mixed'||r.media_type==='movie'||r.media_type==='tv')).map(r=>({row:r,type:type==='mixed'?r.media_type as MediaType:type,source:source??(query.query?'search':'discover')})));
 const unique=new Map<string,{row:Row;type:MediaType;source:string}>();
 // Round robin prevents the first language from exhausting the hydration/request budget.
 outer: for(let i=0;i<20;i++)for(const bucket of buckets){const item=bucket[i];if(item&&(!query.kind||query.kind==='all'||item.type===(query.kind==='movie'?'movie':'tv')))unique.set(`${item.type}:${item.row.id}`,item);if(unique.size>=(query.generators?60:36))break outer;}
 const provenance=new Map<string,Set<string>>();for(const bucket of buckets)for(const item of bucket){const key=`${item.type}:${item.row.id}`;const set=provenance.get(key)??new Set<string>();set.add(item.source);provenance.set(key,set);}
 const raw=[...unique.values()].slice(0,query.generators?60:36);const hydrated=await Promise.allSettled(raw.map(async({row,type})=>{try{return await getTitle(`tmdb:${type}:${row.id}`) ?? await normalize(row,type);}catch{return {...await normalize(row,type),availabilityStatus:'error' as const};}}));
 const titles=hydrated.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
 if(raw.length&&!titles.length)throw new CatalogError('UPSTREAM_UNAVAILABLE',503,'Movie data is temporarily unavailable. Please retry.');
 return {titles:titles.map(t=>({...t,provenance:[...(provenance.get(`${t.mediaType}:${t.externalId}`)??[])]})),page,hasMore:successful.some(r=>r.value.data.total_pages>page),total:query.query?successful[0].value.data.total_results:undefined,warnings:[...(results.some(r=>r.status==='rejected')?['Some candidate sources could not be loaded.']:[]),...(hydrated.some(r=>r.status==='rejected')||titles.some(t=>t.availabilityStatus==='error')?['Some title details or India watch options are unavailable. Please retry later.']:[])]};
}
export const tmdbCatalog:CatalogSource={mode:'live',search:getCatalog,providers:getProviders,list:async query=>(await getCatalog(query)).titles,get:getTitle};
