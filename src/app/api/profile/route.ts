import { z } from 'zod';
import { requireUser, accountProfile } from '@/server/auth';
import { database } from '@/server/db';
import { apiError, checkOrigin, HttpError, privateJson, readJson } from '@/server/http';
import { parseState, preserveOnboarding } from '@/modules/library/state';
import { mergeAnonymous } from '@/modules/auth/merge';
const schema=z.object({owner:z.string().uuid(),revision:z.number().int().nonnegative(),state:z.object({version:z.literal(3)}).passthrough(),importAnonymous:z.boolean().optional()}).strict();
export async function PUT(request:Request){try{
 checkOrigin(request);const user=await requireUser();const parsed=schema.safeParse(await readJson(request));if(!parsed.success)throw new HttpError(400,'Invalid profile update.');const body=parsed.data;
 if(body.owner!==user._id)throw new HttpError(409,'The signed-in account changed. Reload before saving.');
 const profile=await accountProfile(user._id);if(profile.revision!==body.revision)return privateJson({error:'Profile changed on another device.',state:profile.state,revision:profile.revision},409);
 // A pre-upgrade tab cannot safely round-trip canonical language IDs or setup status.
 // Keep its unsynced state in the client and require refresh instead of overwriting newer data.
 if(!Object.prototype.hasOwnProperty.call(body.state,'onboarding'))throw new HttpError(409,'This tab uses an older profile format. Reload before saving more changes.');
 const input=parseState(JSON.stringify(body.state));const state=preserveOnboarding(profile.state,body.importAnonymous?mergeAnonymous(profile.state,input):input);
 const {profiles}=await database();const result=await profiles.updateOne({_id:user._id,revision:body.revision},{$set:{state,updatedAt:new Date()},$inc:{revision:1},$unset:{taste:'',tasteRevision:''}});
 if(!result.matchedCount)throw new HttpError(409,'Profile changed. Please reload and retry.');
 return privateJson({state,revision:body.revision+1});
 }catch(e){return apiError(e);}}
