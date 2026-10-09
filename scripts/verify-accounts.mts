import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {defaultState} from '../src/modules/library/state';
import {recordChanges} from '../src/modules/library/events';
import {defaultFilters} from '../src/modules/recommendations/rank';
const base=process.env.TEST_ORIGIN??'http://localhost:5000';
const suffix=randomBytes(6).toString('hex'),password=randomBytes(24).toString('base64url');
let cookie='';const records:Record<string,{email:string;id:string;state:typeof defaultState;revision:number}>={};
async function api(path:string,method='GET',body?:unknown,expected=200){
 const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});
 const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
 assert.equal(r.status,expected,`${path} expected ${expected}, got ${r.status}`);
 return r.json();
}
const resolveTitle=async(query:string)=>{const data=await api('/api/catalog','POST',{query});const title=data.titles.find((t:any)=>t.name.toLowerCase()===query.toLowerCase()&&t.language==='Malayalam');assert.ok(title,`Real metadata lookup for ${query}`);assert.ok(title.genres.some((g:string)=>['Comedy','Drama'].includes(g)));return title.id as string;};
const comedyA=await resolveTitle('Premalu'),comedyB=await resolveTitle('Bangalore Days');
for(const name of ['A','B']){
 const email=`nextscene-test-${name.toLowerCase()}-${suffix}@example.invalid`;
 const result=await api('/api/auth','POST',{action:'signup',email,password,name:`Evaluation ${name}`});
 records[name]={email,id:result.user.id,state:structuredClone(defaultState),revision:result.revision};
 const id=name==='A'?'tmdb:movie:157336':comedyA;
 const update=recordChanges(result.state,{...result.state,liked:name==='A'?['tmdb:movie:157336','tmdb:movie:27205','tmdb:movie:579974']:[comedyA,comedyB],disliked:name==='A'?['tmdb:movie:9552']:['tmdb:movie:245891'],saved:[id],ratings:{[id]:10},favorites:[id],watched:[{titleId:id,watchedAt:new Date().toISOString(),audience:'private'}],dismissed:[name==='A'?'tmdb:movie:245891':'tmdb:movie:9552'],genres:name==='A'?['Science Fiction']:['Comedy'],services:name==='A'?['119']:['8','2336'],languages:name==='A'?['Telugu','English']:['Malayalam','Tamil']},{surface:'account-test',sessionId:`test-${name}`});
 const saved=await api('/api/profile','PUT',{owner:result.user.id,revision:result.revision,state:update});records[name].state=saved.state;records[name].revision=saved.revision;
 const restored=await api('/api/auth');assert.equal(restored.user.id,result.user.id);assert.deepEqual(restored.state.saved,[id]);
 await api('/api/auth','POST',{action:'logout'});assert.equal((await api('/api/auth')).user,null);
}
await (await import('node:fs/promises')).writeFile('/tmp/nextscene-account-fixture.json',JSON.stringify({records,password}),{mode:0o600});
const output:Record<string,unknown>={};
for(const name of ['A','B','A']){
 const record=records[name];const login=await api('/api/auth','POST',{action:'login',email:record.email,password});assert.equal(login.user.id,record.id);assert.deepEqual(login.state.saved,record.state.saved);assert.deepEqual(login.state.services,record.state.services);for(const field of ['watched','favorites','dismissed','ratings','liked','disliked','languages','genres'] as const)assert.deepEqual(login.state[field],record.state[field]);assert.deepEqual(login.state.events,record.state.events);assert.ok(login.state.events.every((e:any)=>e.at&&e.surface&&e.sessionId));
 await api('/api/profile','PUT',{owner:record.id,revision:0,state:record.state},409);
 const other=name==='A'?records.B:records.A;
 await api('/api/profile','PUT',{owner:other.id,revision:login.revision,state:other.state},409);
 const recommendation=await api('/api/recommendations','POST',{surface:'home',filters:defaultFilters,sessionId:`test-${name}`,state:other.state,debug:true});
 assert.equal(recommendation.owner,record.id);assert.ok(!recommendation.evidence.some((t:any)=>other.state.saved.includes(t.id)&&!record.state.saved.includes(t.id)));assert.ok(recommendation.debug.taste.positive.some((p:any)=>p.title.id===record.state.saved[0]));assert.ok(!recommendation.debug.taste.positive.some((p:any)=>p.title.id===other.state.saved[0])); // Forged state in body must be ignored for authenticated requests.
 assert.ok(recommendation.ranked.length>0);assert.ok(recommendation.ranked.every((r:any)=>r.title.offers.some((o:any)=>o.type==='subscription'&&o.region==='IN'&&record.state.services.includes(o.provider))));
 const forYou=await api('/api/recommendations','POST',{surface:'for-you',filters:defaultFilters,sessionId:`test-${name}`,debug:true});assert.equal(forYou.owner,record.id);
 output[name]={forYou:forYou.ranked.slice(0,5).map((r:any)=>r.title.name),owner:record.id,top:recommendation.ranked.slice(0,5).map((r:any)=>r.title.name),rows:recommendation.rows.map((r:any)=>r.name),tasteLanguages:Object.keys(recommendation.debug?.taste?.longTerm?.language??{})};
 if(name==='B'){const imported=await api('/api/profile','PUT',{owner:record.id,revision:login.revision,state:{...structuredClone(defaultState),saved:['tmdb:movie:13'],ratings:{[record.state.saved[0]]:2},services:['119']},importAnonymous:true});assert.ok(imported.state.saved.includes('tmdb:movie:13'));assert.equal(imported.state.ratings[record.state.saved[0]],10);assert.deepEqual(imported.state.services,record.state.services);const restored=await api('/api/profile','PUT',{owner:record.id,revision:imported.revision,state:record.state});record.revision=restored.revision;}
 const revoked=cookie;await api('/api/auth','POST',{action:'logout'});cookie=revoked;assert.equal((await api('/api/auth')).user,null);cookie='';
}
assert.notDeepEqual((output.A as any).top,(output.B as any).top);
assert.notDeepEqual((output.A as any).forYou,(output.B as any).forYou);
const anonymous=await api('/api/auth');assert.equal(anonymous.user,null);
await api('/api/profile','PUT',{owner:records.A.id,revision:0,state:records.A.state},401);
const csrf=await fetch(base+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:JSON.stringify({action:'logout'})});assert.equal(csrf.status,403);
console.log(JSON.stringify({passed:true,checks:['signup','login','logout','session restoration','A/B/A switching','persistent watched/favorites/ratings/dismissals/preferences/events','stale revision rejected','revoked session rejected','explicit import preserves account conflicts','forged owner rejected','forged recommendation state ignored','anonymous access','CSRF blocked'],accounts:output},null,2));
// Test records have unique reserved-domain identifiers. Print identifiers only, never passwords or cookies.
await (await import('node:fs/promises')).writeFile('/tmp/nextscene-account-fixture.json',JSON.stringify({records,password}),{mode:0o600});
console.log(JSON.stringify({testAccountIds:[records.A.id,records.B.id],testEmailSuffix:suffix}));
