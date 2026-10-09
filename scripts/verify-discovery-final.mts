import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {defaultFilters} from '../src/modules/recommendations/rank';
const fixture=JSON.parse(await readFile('/tmp/nextscene-discovery-fixture.json','utf8'));
const origin='http://localhost:5000';let cookie='';
async function post(path:string,body:unknown){const r=await fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];const data=await r.json();assert.equal(r.status,200,data.error);return data;}
const a=await post('/api/auth',{action:'login',email:fixture.email,password:fixture.password});assert.equal(a.state.onboarding,'completed');assert.ok(a.state.liked.length>=2);assert.ok(Object.values(a.state.ratings).includes(9));
const filtered=await post('/api/recommendations',{surface:'discover',sessionId:'final-discovery',filters:{...defaultFilters,mood:'Funny',language:'English',provider:'119',maxRuntime:120}});
assert.ok(filtered.ranked.length>0);assert.ok(filtered.ranked.every((r:any)=>r.title.language==='English'&&r.title.runtime>0&&r.title.runtime<120&&r.title.offers.some((o:any)=>o.provider==='119'&&o.type==='subscription'&&o.region==='IN')));assert.equal(filtered.debug,undefined);assert.ok(filtered.rows.every((r:any)=>!Object.hasOwn(r,'diagnostics')));
const swipe=await post('/api/recommendations',{surface:'swipe',sessionId:'final-discovery'});assert.ok(swipe.ranked.length>0);
const b=await post('/api/auth',{action:'login',email:fixture.bEmail,password:fixture.password});assert.equal(b.state.onboarding,'skipped');assert.deepEqual(b.state.languages,['en']);assert.deepEqual(b.state.liked,[]);assert.deepEqual(b.state.saved,[]);assert.deepEqual(b.state.watched,[]);assert.deepEqual(b.state.ratings,{});
const forged=await post('/api/recommendations',{surface:'discover',sessionId:'final-discovery',state:a.state,debug:true});assert.equal(forged.owner,b.user.id);assert.equal(forged.debug.taste.evidenceCount,0);
const report={passed:true,completedAndSkippedPersist:true,accountBEmptyPrivateLibrary:true,forgedAccountAIgnored:true,normalResponseHasNoDiagnostics:true,swipeCandidates:swipe.ranked.length,explicitMatches:filtered.ranked.map((r:any)=>({name:r.title.name,runtime:r.title.runtime,language:r.title.language}))};
await writeFile('docs/verification/discovery-final.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
