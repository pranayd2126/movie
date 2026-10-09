import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {defaultFilters} from '../src/modules/recommendations/rank';
const fixture=JSON.parse(await readFile('/tmp/nextscene-discovery-fixture.json','utf8'));const origin='http://localhost:5000';let cookie='';
async function api(path:string,body:unknown,expected=200){const r=await fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body),signal:AbortSignal.timeout(65000)});const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];const data=await r.json();assert.equal(r.status,expected,data.error);return data;}
const a=await api('/api/auth',{action:'login',email:fixture.email,password:fixture.password});
const request={surface:'discover',sessionId:'progressive-live',filters:defaultFilters,feed:{requestId:randomUUID()},debug:true};
let batch=await api('/api/recommendations',request);const first=batch,rows=[...batch.rows],batches=[{batch:batch.batch,rows:batch.rows.map((r:any)=>r.name),candidates:batch.candidateCount}];
for(let n=0;n<2&&batch.cursor;n++){const start=Date.now();batch=await api('/api/recommendations',{...request,feed:{...request.feed,cursor:batch.cursor}});rows.push(...batch.rows);batches.push({batch:batch.batch,rows:batch.rows.map((r:any)=>r.name),candidates:batch.candidateCount});console.log(`Batch ${batch.batch}: ${batch.rows.length} additional rows in ${Date.now()-start}ms`);}
assert.ok(first.rows.length);assert.ok(rows.length>first.rows.length);assert.equal(new Set(rows.map((r:any)=>r.id)).size,rows.length);const ids=rows.flatMap((r:any)=>r.items.map((i:any)=>i.title.id));assert.equal(new Set(ids).size,ids.length);
const repeat=await api('/api/recommendations',request);assert.deepEqual(repeat.rows,first.rows);
const b=await api('/api/auth',{action:'login',email:fixture.bEmail,password:fixture.password});
if(first.cursor)await api('/api/recommendations',{...request,feed:{...request.feed,cursor:first.cursor}},410);
const other=await api('/api/recommendations',{...request,state:a.state,feed:{requestId:randomUUID()}});assert.equal(other.owner,b.user.id);assert.notDeepEqual(other.rows.map((r:any)=>r.id),first.rows.map((r:any)=>r.id));
const filterRequest={...request,filters:{...defaultFilters,mood:'Funny',language:'English',provider:'119',maxRuntime:120},feed:{requestId:randomUUID()}};
const filtered=await api('/api/recommendations',filterRequest);const next=filtered.cursor?await api('/api/recommendations',{...filterRequest,feed:{...filterRequest.feed,cursor:filtered.cursor}}):{rows:[]};
const matches=[...filtered.rows,...next.rows].flatMap((r:any)=>r.items);assert.ok(matches.length);assert.ok(matches.every((i:any)=>i.title.language==='English'&&i.title.runtime>0&&i.title.runtime<120&&i.title.offers.some((o:any)=>o.provider==='119'&&o.type==='subscription'&&o.region==='IN')));
const report={passed:true,batches,totalRows:rows.length,uniqueTitles:ids.length,bRows:other.rows.map((r:any)=>r.name),ownerIsolation:true,forgedStateIgnored:true,idempotentReplay:true,filteredBatchRows:[filtered.rows.length,next.rows.length],filteredTitles:matches.map((i:any)=>i.title.name)};await writeFile('docs/verification/progressive-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
