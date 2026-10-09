import { discoveryFeeds } from '@/server/discovery-feed';
import { moods } from '@/modules/discovery/moods';
import { database } from '@/server/db';
import { z } from 'zod';
import { accountProfile, currentUser } from '@/server/auth';
import { recommend } from '@/server/recommendations';
import { checkOrigin, readJson, privateJson, apiError, HttpError } from '@/server/http';
import { parseState, defaultState } from '@/modules/library/state';
import { defaultFilters } from '@/modules/recommendations/rank';
const schema=z.object({surface:z.enum(['home','for-you','discover','related','swipe']),sessionId:z.string().max(80),page:z.number().int().min(1).max(100).default(1),anchorId:z.string().regex(/^tmdb:(movie|tv):\d+$/).optional(),state:z.unknown().optional(),feed:z.object({requestId:z.string().uuid(),cursor:z.object({id:z.string().uuid(),batch:z.number().int().min(1).max(6)}).optional()}).optional(),debug:z.boolean().optional(),filters:z.object({query:z.string().max(120),kind:z.enum(['all','movie','series']),language:z.string().max(30),genre:z.string().max(50),mood:z.custom<typeof defaultFilters.mood>(v=>moods.includes(v as typeof defaultFilters.mood)),provider:z.string().regex(/^$|^[1-9]\d{0,8}$/).default(''),minRuntime:z.number().min(0).max(600).default(0),maxRuntime:z.number().min(0).max(600),minRating:z.number().min(0).max(10),year:z.number().int().min(0).max(2100),sort:z.enum(['picks','rating','newest','alphabetical']),onlyServices:z.boolean(),excludeWatched:z.boolean()}).default({...defaultFilters,provider:'',minRuntime:0})}).strict();
export async function POST(request:Request){try{
 checkOrigin(request);const parsed=schema.safeParse(await readJson(request));if(!parsed.success)throw new HttpError(400,'Invalid recommendation request.');const body=parsed.data;
 const user=await currentUser();const profile=user?await accountProfile(user._id):null;
 // Authenticated personalization inputs always come from the session owner's database record.
 const state=profile?parseState(JSON.stringify(profile.state)):body.state?parseState(JSON.stringify(body.state)):structuredClone(defaultState);
 if(body.feed){
  if(body.surface!=='discover')throw new HttpError(400,'Progressive rows are only available in Discover.');
  const {diagnostics,...batch}=await discoveryFeeds.next({owner:user?user._id:'anonymous',sessionId:body.sessionId,requestId:body.feed.requestId,cursor:body.feed.cursor,state,filters:body.filters});
  return privateJson({...batch,owner:user?user._id:null,...(body.debug&&process.env.NODE_ENV==='development'?{debug:{rows:diagnostics}}:{})});
 }
 const result=await recommend(state,body.filters,body.surface,body.sessionId,body.page,body.anchorId);
 const {profile:taste,generators,rowDiagnostics,...publicResult}=result;
 if(user&&profile){const {profiles}=await database();await profiles.updateOne({_id:user._id,revision:profile.revision},{$set:{taste:{version:taste.version,longTerm:taste.longTerm,recent:taste.recent,confidence:taste.confidence,evidenceCount:taste.evidenceCount,generatedAt:taste.generatedAt},tasteRevision:profile.revision}});}
 return privateJson({...publicResult,rows:publicResult.rows.map(({diagnostics,...row})=>row),owner:user?user._id:null,revision:profile?.revision??state.revision,...(body.debug&&process.env.NODE_ENV==='development'?{debug:{taste,generators,rows:rowDiagnostics}}:{})});
 }catch(e){return apiError(e);}}
