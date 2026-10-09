import 'server-only';
import { cookies } from 'next/headers';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { database, type Account } from './db';
import { defaultState, parseState } from '@/modules/library/state';
import { HttpError } from './http';
export const COOKIE = 'nextscene_session';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const publicUser = (user: Account) => ({ id:user._id, email:user.email, name:user.name });
export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { sessions,users } = await database();
  const session = await sessions.findOne({_id:digest(token),expiresAt:{$gt:new Date()}});
  return session ? users.findOne({_id:session.userId}) : null;
}
export async function requireUser() { const user = await currentUser(); if(!user)throw new HttpError(401,'Please sign in again.'); return user; }
export async function accountProfile(userId: string, isNew = false) {
  const {profiles} = await database();
  await profiles.updateOne({_id:userId},{$setOnInsert:{state:{...structuredClone(defaultState),onboarding:isNew?'pending':'legacy'},revision:0,updatedAt:new Date()}},{upsert:true});
  const profile=(await profiles.findOne({_id:userId}))!;
  return {...profile,state:parseState(JSON.stringify(profile.state))};
}
export async function openSession(userId: string) {
  const jar = await cookies(); const {sessions} = await database();
  const previous = jar.get(COOKIE)?.value;
  if(previous)await sessions.deleteOne({_id:digest(previous)});
  const token = randomBytes(32).toString('hex'); const maxAge = 60*60*24*30;
  await sessions.insertOne({_id:digest(token),userId,expiresAt:new Date(Date.now()+maxAge*1000)});
  jar.set(COOKIE,token,{httpOnly:true,sameSite:'lax',secure:(process.env.APP_ORIGIN ?? '').startsWith('https:'),path:'/',maxAge});
}
export async function closeSession() {
  const jar = await cookies(); const token = jar.get(COOKIE)?.value;
  if(token){const {sessions}=await database();await sessions.deleteOne({_id:digest(token)});}
  jar.set(COOKIE,'',{httpOnly:true,sameSite:'lax',secure:(process.env.APP_ORIGIN ?? '').startsWith('https:'),path:'/',maxAge:0});
}
export async function authLimit(email: string) {
  const {db} = await database(); const window = Math.floor(Date.now()/900000);
  for(const [key,max] of [[digest(email),12],['global',120]] as const) {
    const result = await db.collection<{_id:string;count:number;expiresAt:Date}>('nextscene_limits').findOneAndUpdate({_id:`${key}:${window}`},{$inc:{count:1},$setOnInsert:{expiresAt:new Date((window+2)*900000)}},{upsert:true,returnDocument:'after'});
    if((result?.count ?? 0)>max)throw new HttpError(429,'Too many sign-in attempts. Please try again in 15 minutes.');
  }
}
export const newUserId = () => randomUUID();
