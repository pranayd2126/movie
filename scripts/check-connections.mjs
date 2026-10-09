import env from '@next/env';
import { MongoClient } from 'mongodb';
env.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
// Print only status codes and error classes. Never print vendor URLs, credentials or error messages.
const token = process.env.TMDB_READ_ACCESS_TOKEN || process.env.TMDB_ACCESS_TOKEN;
const url = new URL('https://api.themoviedb.org/3/configuration');
if (!token && process.env.TMDB_API_KEY) url.searchParams.set('api_key', process.env.TMDB_API_KEY);
try {
  const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(12000) });
  console.log(JSON.stringify({ service: 'TMDB', connected: r.ok, status: r.status }));
} catch { console.log(JSON.stringify({ service: 'TMDB', connected: false, error: 'Network timeout or failure' })); }
if (process.env.MONGODB_URI) {
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 6000, maxPoolSize: 2 });
  try { await client.connect(); await client.db().command({ ping: 1 }); console.log(JSON.stringify({ service: 'MongoDB', connected: true, recordsChanged: false })); }
  catch (e) { console.log(JSON.stringify({ service: 'MongoDB', connected: false, errorType: e.name, recordsChanged: false })); }
  finally { await client.close(); }
} else console.log(JSON.stringify({ service: 'MongoDB', configured: false }));
