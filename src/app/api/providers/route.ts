import { getCatalogSource } from '@/server/catalog';
export async function GET(){try{return Response.json({providers:await getCatalogSource().providers()},{headers:{'Cache-Control':'public, max-age=3600'}});}catch{return Response.json({error:'Streaming services could not be loaded.'},{status:503});}}
