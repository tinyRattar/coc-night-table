import postgres from 'npm:postgres@3.4.7';
import * as identity from '../../app/api/identity/route';
import * as table from '../../app/api/table/route';
import * as materials from '../../app/api/materials/route';
import * as file from '../../app/api/materials/file/route';
import { database } from './sql';
import { requestDatabase } from './env';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, {
  prepare: false, max: 3, idle_timeout: 20, connect_timeout: 15,
  types: { bigint: { to: 20, from: [20], serialize: String, parse: Number } },
});
const origins = new Set((Deno.env.get('COC_ALLOWED_ORIGINS') || 'https://tinyrattar.github.io,http://127.0.0.1:5173,http://localhost:5173').split(','));
const routes: Record<string, any> = { identity, table, materials, 'materials/file': file };

export async function handle(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && !origins.has(origin)) return Response.json({ error: '请求来源不匹配' }, { status: 403 });
  const cors = { 'Access-Control-Allow-Origin': origin || 'https://tinyrattar.github.io', 'Access-Control-Allow-Headers': 'content-type,x-coc-session,apikey,authorization', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const url = new URL(request.url);
  const path = url.pathname.split('/table/')[1] || '';
  if (path === 'health') {
    try { await sql`select 1 from rooms limit 1`; return Response.json({ ok: true }, { headers: cors }); }
    catch { return Response.json({ error: '数据库尚未就绪' }, { status: 503, headers: cors }); }
  }
  const handler = routes[path]?.[request.method];
  if (!handler) return Response.json({ error: '接口不存在' }, { status: 404, headers: cors });
  try {
    let room = url.searchParams.get('room') || '';
    if (request.method === 'POST' && (path === 'identity' || path === 'table')) {
      if (Number(request.headers.get('content-length') || 0) > 50000) return Response.json({error:'请求过大'}, {status:413, headers:cors});
      const input = await request.clone().json(); room = String(input.room || '');
      if (path === 'table' && input.action === 'create') return Response.json({error:'请通过登录页面创建房间'}, {status:400, headers:cors});
    }
    const headers = new Headers(request.headers);
    headers.delete('cookie');
    const token = request.headers.get('x-coc-session') || '';
    headers.set('cookie', `coc_login_${room}=${/^[a-f0-9]{64}$/.test(token) ? token : 'out'}`);
    // The external Origin was checked above. Existing handlers see a same-origin internal request.
    headers.set('origin', url.origin);
    const internal = new Request(request, { headers });
    const response: Response = await sql.begin(async (tx: any) => {
      if (request.method !== 'GET' && /^[a-f0-9]{32}$/.test(room)) await tx`select id from rooms where id=${room} for update`;
      return requestDatabase.run(database(tx), () => handler(internal));
    });
    const outputHeaders = new Headers(response.headers);
    Object.entries(cors).forEach(([k,v]) => outputHeaders.set(k,v));
    outputHeaders.delete('set-cookie');
    if (path === 'identity' && request.method === 'POST' && response.ok) {
      const data = await response.json();
      const cookie = response.headers.get('set-cookie') || '';
      data.session = cookie.match(/coc_login_[a-f0-9]+=([^;]+)/)?.[1] || null;
      return Response.json(data, { status: response.status, headers: outputHeaders });
    }
    return new Response(response.body, { status: response.status, headers: outputHeaders });
  } catch (e) {
    console.error('Backend request failed', e instanceof Error ? e.message : 'unknown');
    return Response.json({ error: '服务暂时不可用，请稍后重试' }, { status: 500, headers: cors });
  }
}
Deno.serve(handle);
