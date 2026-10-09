import { z } from 'zod';
import { accountProfile, authLimit, closeSession, currentUser, newUserId, openSession, publicUser } from '@/server/auth';
import { database } from '@/server/db';
import { apiError, checkOrigin, HttpError, privateJson, readJson } from '@/server/http';
import { hashPassword, verifyPassword } from '@/modules/auth/password';
const schema = z.object({ action:z.enum(['signup','login','logout']), email:z.string().email().max(254).optional(), password:z.string().min(12).max(128).optional(), name:z.string().trim().min(1).max(60).optional() }).strict();
let hashing = 0;
export async function GET(){try{const user=await currentUser();if(!user)return privateJson({user:null});const profile=await accountProfile(user._id);return privateJson({user:publicUser(user),state:profile.state,revision:profile.revision});}catch(e){return apiError(e);}}
export async function POST(request:Request){
 try{
  checkOrigin(request);const parsed=schema.safeParse(await readJson(request,4096));if(!parsed.success)throw new HttpError(400,'Enter a valid email and a password of 12–128 characters.');const body=parsed.data;
  if(body.action==='logout'){await closeSession();return privateJson({user:null});}
  if(!body.email||!body.password)throw new HttpError(400,'Email and password are required.');
  const email=body.email.trim().toLowerCase();await authLimit(email);if(hashing>=2)throw new HttpError(429,'Sign-in is busy. Try again in a moment.');
  hashing++;
  try{
   const {users}=await database();let user=await users.findOne({email});
   if(body.action==='signup'){
    const passwordHash=await hashPassword(body.password);
    if(user)throw new HttpError(409,'An account could not be created with those details. Try signing in.');
    user={_id:newUserId(),email,name:body.name||email.split('@')[0],passwordHash,createdAt:new Date()};
    try{await users.insertOne(user);}catch{throw new HttpError(409,'An account could not be created with those details. Try signing in.');}
   }else{
    // Missing users still incur a full password derivation, reducing trivial timing enumeration.
    const valid=user?await verifyPassword(body.password,user.passwordHash):!!(await hashPassword(body.password))&&false;
    if(!valid||!user)throw new HttpError(401,'Email or password is incorrect.');
   }
   await openSession(user!._id);const profile=await accountProfile(user!._id,body.action==='signup');
   return privateJson({user:publicUser(user!),state:profile.state,revision:profile.revision});
  }finally{hashing--;}
 }catch(e){return apiError(e);}
}
