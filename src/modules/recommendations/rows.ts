import { languageName, sameLanguage, type Title } from '../catalog/types';
import { genreMatches } from '../catalog/preferences';
import type { LocalState } from '../library/state';
import { moodLabel } from '../discovery/moods';
import { CONFIG } from './config';
import { FEED } from './feed-context';
import { buildTasteProfile } from './taste';
import { defaultFilters, getRecommendations, similarity, type Filters } from './rank';
export type RankedTitle=ReturnType<typeof getRecommendations>[number];
export interface RowDiagnostic { id:string; name:string; reason:string; evidence:number; candidateCount:number; score:number; overlapPenalty:number; themePenalty:number; selected:boolean; exclusion?:string; components:Record<string,number> }
export interface RecommendationRow { id:string; name:string; theme:string; reason:string; score:number; items:RankedTitle[]; evidence:number; anchorId?:string; diagnostics:RowDiagnostic }
export interface RowBatchOptions { previous:RecommendationRow[]; batch:number; limit:number }
type Surface='home'|'discover'|'for-you';
export function composeRowPlan(titles:Title[],state:LocalState,evidence:Title[],surface:Surface,sessionId='',filters:Filters=defaultFilters,progressive?:RowBatchOptions){
 const profile=buildTasteProfile(state,evidence,sessionId);
 const ranked=getRecommendations({titles,state,evidence,surface,sessionId,filters});
 const base=progressive?ranked.filter(r=>r.components.quality>=FEED.minimumQuality&&r.title.votes>=20):ranked;
 const previous=progressive?.previous??[];
 const explorationBoost=progressive?Math.min(FEED.maxExplorationBonus,progressive.batch*FEED.explorationStep):0;
 const proposals:RecommendationRow[]=[],diagnostics:RowDiagnostic[]=[];
 const average=(items:RankedTitle[],key?:keyof RankedTitle['components'])=>items.slice(0,8).reduce((sum,r)=>sum+(key?r.components[key]:r.score),0)/Math.max(1,Math.min(8,items.length));
 const add=(id:string,name:string,theme:string,reason:string,items:RankedTitle[],support:number,bonus=0,anchorId?:string)=>{
  const seen=state.events.filter(e=>e.type==='row_impression'&&e.row===id&&e.sessionId!==sessionId).length;
  const clicks=state.events.filter(e=>e.type==='click'&&e.row===id).length;
  const components={relevance:average(items),evidence:CONFIG.rows.evidenceBonus*Math.min(support,4),intent:bonus,engagement:CONFIG.rows.engagementBonus*Math.min(1,clicks/(seen+3)),exposure:-CONFIG.rows.exposurePenalty*Math.min(seen,3),mood:average(items,'mood'),language:average(items,'language'),genre:average(items,'genre'),provider:average(items,'availability'),recent:average(items,'recent'),session:average(items,'session')};
  const exploration=['exploration','exploration-language','exploration-gems'].includes(theme)?explorationBoost:0;
  Object.assign(components,{exploration});
  const score=exploration+components.relevance+components.evidence+components.intent+components.engagement+components.exposure;
  const diagnostic:RowDiagnostic={id,name,reason,evidence:support,candidateCount:items.length,score,components,overlapPenalty:0,themePenalty:0,selected:false};diagnostics.push(diagnostic);
  if(progressive&&previous.some(r=>r.id===id)){diagnostic.exclusion='Already shown in this feed';return;}
  if(items.length<CONFIG.rows.minimumTitles){diagnostic.exclusion='Too few eligible candidates';return;}
  proposals.push({id,name,theme,reason,score,items,evidence:support,anchorId,diagnostics:diagnostic});
 };
 add('top','Top picks for you','top',profile.evidenceCount?'Your feedback, balanced with quality and discovery.':'A starting mix from your preferences and TMDB audience ratings.',base,Math.min(profile.evidenceCount,3),.22);
 for(const seed of profile.positive.slice(0,progressive?10:6)){
  const rating=state.ratings[seed.title.id]??0;
  const action=rating>=8?'rated highly':state.liked.includes(seed.title.id)?'liked':state.favorites.includes(seed.title.id)?'favorited':null;
  if(!action)continue;
  const items=getRecommendations({titles:progressive?base.map(r=>r.title):titles,state,evidence,surface,sessionId,anchor:seed.title,filters}).filter(r=>similarity(r.title,seed.title)>.24);
  const name=rating>=8?`Because you rated ${seed.title.name} highly`:`Because you ${action} ${seed.title.name}`;
  add(`seed:${seed.title.id}`,name,'anchor',`Shared story traits with a title you ${action}, ranked for your wider taste.`,items,seed.strength,.06,seed.title.id);
 }
 const learnedGenres=Object.entries(profile.longTerm.genre).filter(([,v])=>v.positiveCount>=2&&v.positive>v.negative).sort((a,b)=>b[1].positive-a[1].positive);
 const genreChoices=[...new Set([...learnedGenres.map(([g])=>g),...state.genres])].slice(0,progressive?6:3);
 const learnedLanguages=Object.entries(profile.longTerm.language).filter(([,v])=>v.positiveCount>=2&&v.positive>v.negative).sort((a,b)=>b[1].positive-a[1].positive);
 const languageChoices=[...new Set([...learnedLanguages.map(([l])=>l),...state.languages.map(languageName)])].slice(0,progressive?5:3);
 for(const genre of genreChoices){
  const support=profile.longTerm.genre[genre]?.positiveCount??1;
  add(`genre:${genre}`,`${genre} for you`,`affinity:${genre}`,state.genres.includes(genre)?'From a genre you selected.':`Positive feedback on ${support} ${genre} titles.`,base.filter(r=>genreMatches(r.title.genres,genre)),support);
  for(const lang of languageChoices){
   const combination=profile.longTerm.combination[`${lang}:${genre}`];
   const prior=state.languages.some(l=>sameLanguage(l,lang))&&state.genres.includes(genre);
   if(!prior&&(!combination||combination.positiveCount<2||combination.positive<=combination.negative))continue;
   add(`combination:${lang}:${genre}`,`${lang} ${genre} for you`,`affinity:${genre}`,prior?'A combination of your selected language and genre preferences.':`Supported by ${combination.positiveCount} titles you enjoyed.`,base.filter(r=>sameLanguage(r.title.language,lang)&&genreMatches(r.title.genres,genre)),combination?.positiveCount??1,.05);
  }
 }
 for(const lang of languageChoices)add(`language:${lang}`,`${lang} picks for you`,'language','From your language preferences and positive feedback.',base.filter(r=>sameLanguage(r.title.language,lang)),profile.longTerm.language[lang]?.positiveCount??1);
 for(const [creator,ev] of Object.entries(profile.longTerm.creator).filter(([,v])=>v.positiveCount>=2&&v.positive>v.negative).sort((a,b)=>b[1].positive-a[1].positive).slice(0,2))add(`creator:${creator}`,`Because you like ${creator}`,'creator',`Positive evidence from ${ev.positiveCount} titles by this creator.`,base.filter(r=>r.title.creators?.includes(creator)),ev.positiveCount);
 for(const [actor,ev] of Object.entries(profile.longTerm.actor).filter(([,v])=>v.positiveCount>=CONFIG.taste.actorMinimum&&v.positive>v.negative).sort((a,b)=>b[1].positive-a[1].positive).slice(0,2))add(`actor:${actor}`,`More with ${actor}`,'actor',`Positive evidence from ${ev.positiveCount} titles with this actor.`,base.filter(r=>r.title.credits?.some(c=>c.name===actor&&c.role!=='Director')),ev.positiveCount);
 const saved=profile.positive.filter(p=>p.kind==='saved');
 if(saved.length)add('watchlist','Similar to your watchlist','watchlist','Following stories you chose to save.',base.filter(r=>!state.saved.includes(r.title.id)&&saved.some(p=>similarity(r.title,p.title)>.24)).map(r=>({...r,score:r.score+.2*Math.max(...saved.map(p=>similarity(r.title,p.title)))})).sort((a,b)=>b.score-a.score),saved.length);
 const exposed=new Set(state.events.filter(e=>e.type==='impression').map(e=>e.titleId));
 add('gems','Hidden gems for you','gems','Less-popular discoveries with vote-supported audience ratings, ordered by fit.',base.filter(r=>r.title.popularity<30&&r.components.quality>=.67&&r.title.votes>=80&&!exposed.has(r.title.id)).map(r=>({...r,score:r.score+.08*(1-r.components.popularity)})).sort((a,b)=>b.score-a.score),1);
 if(profile.evidenceCount>=2)add('explore','Try something different','exploration','Quality-controlled picks outside your strongest repeated patterns.',base.filter(r=>r.components.taste<.12&&r.components.penalty<.04&&r.components.quality>=CONFIG.rerank.explorationQuality&&r.title.votes>=CONFIG.rerank.explorationVotes&&(!languageChoices.length||!languageChoices.slice(0,1).some(l=>sameLanguage(l,r.title.language))||!genreChoices.slice(0,1).some(g=>genreMatches(r.title.genres,g)))).sort((a,b)=>b.score-a.score),1,.07);
 const recentlyPositive=profile.positive.filter(p=>Date.now()-Date.parse(p.at)<14*86400000);
 if(recentlyPositive.length)add('recent-interests','Based on your recent interests','temporal','Responding to positive feedback from the last two weeks.',base.filter(r=>r.components.recent>.01).sort((a,b)=>(b.score+.3*b.components.recent)-(a.score+.3*a.components.recent)),recentlyPositive.length,CONFIG.rows.recentBonus);
 const sessionEvents=state.events.filter(e=>e.sessionId===sessionId&&['click','title_open','trailer','like','rating','favorite','watchlist_add'].includes(e.type));
 if(new Set(sessionEvents.map(e=>e.titleId)).size>=2)add('session','Continue exploring','temporal','Following interests from this visit; your long-term taste stays intact.',base.filter(r=>r.components.session>.005).sort((a,b)=>(b.score+.5*b.components.session)-(a.score+.5*a.components.session)),1,.12);
 if(state.services.length){
  const included=base.filter(r=>r.components.availability>0);
  add('services','Top picks on your services','provider','Reported India subscription offers on services you selected. Rentals and add-ons are excluded.',included,1,.06);
  add('new-services','Recent releases on your services','freshness','Recent releases currently included; this does not claim when a service added them.',included.filter(r=>r.title.year>=new Date().getFullYear()-2).sort((a,b)=>(b.score+.14*b.components.freshness)-(a.score+.14*a.components.freshness)),1);
  for(const id of state.services.slice(0,progressive?6:3)){
   const offer=included.flatMap(r=>r.title.offers).find(o=>o.provider===id&&o.type==='subscription'&&o.region==='IN');if(!offer?.name)continue;
   add(`provider:${id}`,`Popular on ${offer.name}`,'provider','Popular titles with an included India offer; not service viewing statistics.',included.filter(r=>r.title.offers.some(o=>o.provider===id&&o.type==='subscription'&&o.region==='IN')).sort((a,b)=>(b.score+.1*b.components.popularity)-(a.score+.1*a.components.popularity)),1);
  }
 }
 if(filters.mood!=='All moods')add(`mood:${filters.mood}`,`${moodLabel(filters.mood)} picks for tonight`,'intent','Inferred from genres and keywords, shaped by your current filters and taste.',base,1,CONFIG.rows.moodBonus);
 add('quick','Quick watch picks','runtime','Films or reported TV episodes under 90 minutes; unknown runtimes excluded.',base.filter(r=>r.title.runtime>0&&r.title.runtime<90),1,filters.maxRuntime?.1:0);
 add('quality','Highly rated, chosen for you','quality','Confidence-adjusted TMDB audience scores; not professional critic reviews.',base.filter(r=>r.components.quality>=.75&&r.title.votes>=150),1);
 add('trending','Trending stories to explore','trending','Weekly global trends, filtered for your current India watch options.',base.filter(r=>r.title.provenance?.some(p=>p.startsWith('trending:'))),0);
 add('popular','Popular stories to explore','popular','Popular titles with your current India availability filters.',[...base].sort((a,b)=>b.title.popularity-a.title.popularity),0);
 for(const kind of ['movie','series'] as const)add(`kind:${kind}`,kind==='movie'?'Movies for you':'Shows for you',`kind:${kind}`,'Your personalized mix, within this format.',base.filter(r=>r.title.kind===kind),0);
 if(progressive){
  const watched=new Set(state.watched.map(w=>w.titleId));
  const unseen=base.filter(r=>!watched.has(r.title.id)&&!exposed.has(r.title.id));
  add('quality-unseen','Highly rated movies you may have missed','quality-unseen','Vote-supported audience favorites you have not marked watched or seen in this session.',unseen.filter(r=>r.title.kind==='movie'&&r.components.quality>=.75&&r.title.votes>=150),1);
  add('under-two-hours','A good story in under two hours','runtime-medium','Films from 90 minutes to under two hours, ranked around your taste.',base.filter(r=>r.title.kind==='movie'&&r.title.runtime>=90&&r.title.runtime<120),1);
  add('recent-movies','Recent movies matching your taste','recent-movies','Released in the last two years, ranked with your feedback and preferences.',base.filter(r=>r.title.kind==='movie'&&r.title.year>=new Date().getFullYear()-2),1);
  for(const [era,ev] of Object.entries(profile.longTerm.era).filter(([,v])=>v.positiveCount>=2&&v.positive>v.negative).slice(0,3))add(`era:${era}`,`${era} stories for you`,`era:${era}`,`Supported by ${ev.positiveCount} titles you enjoyed from this decade.`,base.filter(r=>`${Math.floor(r.title.year/10)*10}s`===era),ev.positiveCount);
  const strongest=languageChoices[0];
  const explorers=unseen.filter(r=>r.components.quality>=CONFIG.rerank.explorationQuality&&r.title.votes>=80&&r.components.penalty<.04);
  if(profile.evidenceCount>=2&&strongest)add('another-language','Another language you might enjoy','exploration-language','Strong audience evidence and personal fit beyond your most established language.',explorers.filter(r=>!sameLanguage(r.title.language,strongest)),1);
  if(profile.evidenceCount>=2&&genreChoices.length)add('outside-gems','Hidden gems outside your usual genres','exploration-gems','Less-popular, vote-supported discoveries outside your leading genre.',explorers.filter(r=>r.title.popularity<30&&!genreMatches(r.title.genres,genreChoices[0])),1);
  for(const [genre,ev] of Object.entries(profile.session.genre).filter(([,v])=>v.positiveCount>=2&&v.positive>v.negative).slice(0,2))add(`session-genre:${genre}`,`Continue exploring ${genre}`,`affinity:${genre}`,'Following positive interests from this visit.',base.filter(r=>genreMatches(r.title.genres,genre)),ev.positiveCount,.05);
 }
 const selected:RecommendationRow[]=[],used=new Set(previous.flatMap(r=>r.items.map(i=>i.title.id)));

 const maximum=progressive?.limit??(surface==='home'?CONFIG.rows.homeRows:surface==='discover'?CONFIG.rows.discoverRows:CONFIG.rows.maximumRows);
 const utility=(row:RecommendationRow)=>{
  row.diagnostics.overlapPenalty=CONFIG.rows.overlapPenalty*row.items.slice(0,8).filter(i=>used.has(i.title.id)).length/Math.min(8,row.items.length);
  row.diagnostics.themePenalty=CONFIG.rows.themePenalty*[...previous,...selected].filter(s=>s.theme===row.theme).length;
  return row.score-row.diagnostics.overlapPenalty-row.diagnostics.themePenalty;
 };
 while(proposals.length&&selected.length<maximum){
  proposals.sort((a,b)=>utility(b)-utility(a)||a.id.localeCompare(b.id));
  const row=proposals.shift()!;const score=utility(row);
  if(row.theme.startsWith('affinity:')&&[...previous,...selected].some(s=>s.theme===row.theme)){row.diagnostics.exclusion='Overlapping genre theme';continue;}
  const items=row.items.filter(i=>!used.has(i.title.id)).slice(0,progressive?FEED.titlesPerRow:CONFIG.rows.titlesPerRow);
  if(items.length<CONFIG.rows.minimumTitles){row.diagnostics.exclusion='Too few titles after cross-row deduplication';continue;}
  row.diagnostics.selected=true;selected.push({...row,score,items});items.forEach(i=>used.add(i.title.id));
 }
 for(const row of proposals)row.diagnostics.exclusion='Below surface row budget';
 return {rows:selected,diagnostics};
}
export const composeRows=(...args:Parameters<typeof composeRowPlan>)=>composeRowPlan(...args).rows;
