import 'server-only';
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function privateJson(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control':'private, no-store', 'Vary':'Cookie', 'X-Content-Type-Options':'nosniff' } }); }
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const configured = process.env.APP_ORIGIN ?? 'http://localhost:5000';
  const allowed = new Set([configured]);
  const base = new URL(configured);
  if (['localhost','127.0.0.1'].includes(base.hostname)) { allowed.add(`http://localhost:${base.port}`); allowed.add(`http://127.0.0.1:${base.port}`); }
  if (!origin || !allowed.has(origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403,'This request must come from the application.');
}
export async function readJson(request: Request, limit = 1500000): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415,'JSON is required.');
  const reader = request.body?.getReader(); if (!reader) throw new HttpError(400,'Request body is required.');
  let bytes = 0; const chunks: Uint8Array[] = [];
  while (true) { const {value,done} = await reader.read(); if (done) break; bytes += value.byteLength; if(bytes > limit) { await reader.cancel(); throw new HttpError(413,'Request is too large.'); } chunks.push(value); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400,'Invalid JSON.'); }
}
export function apiError(e: unknown) { return privateJson({ error: e instanceof HttpError ? e.message : 'The service is temporarily unavailable. Please try again.' }, e instanceof HttpError ? e.status : 503); }
