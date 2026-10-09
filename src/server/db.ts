import 'server-only';
import { MongoClient, type Db, type Collection } from 'mongodb';
import type { LocalState } from '@/modules/library/state';
export interface Account { _id: string; email: string; name: string; passwordHash: string; createdAt: Date }
export interface Session { _id: string; userId: string; expiresAt: Date }
export interface Profile { taste?: unknown; tasteRevision?: number; _id: string; state: LocalState; revision: number; updatedAt: Date }
interface Database { users: Collection<Account>; sessions: Collection<Session>; profiles: Collection<Profile>; db: Db }
const globalDb = globalThis as typeof globalThis & { nextsceneDb?: Promise<Database> };
export async function database(): Promise<Database> {
  if (!globalDb.nextsceneDb) globalDb.nextsceneDb = (async () => {
    if (!process.env.MONGODB_URI) throw new Error('Database is not configured');
    const client = new MongoClient(process.env.MONGODB_URI, { ignoreUndefined: true, maxPoolSize: 10, serverSelectionTimeoutMS: 8000 });
    try {
      await client.connect();
      const db = client.db(process.env.MONGODB_DB || undefined);
      const users = db.collection<Account>('nextscene_users');
      const sessions = db.collection<Session>('nextscene_sessions');
      const profiles = db.collection<Profile>('nextscene_profiles');
      await Promise.all([users.createIndex({email:1},{unique:true}), sessions.createIndex({expiresAt:1},{expireAfterSeconds:0}), db.collection('nextscene_limits').createIndex({expiresAt:1},{expireAfterSeconds:0})]);
      return { db, users, sessions, profiles };
    } catch { await client.close(); throw new Error('Database unavailable'); }
  })().catch(e => { delete globalDb.nextsceneDb; throw e; });
  return globalDb.nextsceneDb;
}
