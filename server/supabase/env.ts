import { AsyncLocalStorage } from 'node:async_hooks';
import { database } from './sql';

export const requestDatabase = new AsyncLocalStorage<ReturnType<typeof database>>();
const storageUrl = () => Deno.env.get('SUPABASE_URL') + '/storage/v1/object/coc-materials/';
function storageHeaders() {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw Error('Storage service credentials unavailable');
  return { Authorization: `Bearer ${key}`, apikey: key };
}
const objectUrl = (key: string) => storageUrl() + key.split('/').map(encodeURIComponent).join('/');
export const env = {
  get DB() { const db = requestDatabase.getStore(); if (!db) throw Error('Database request context unavailable'); return db; },
  BUCKET: {
    async put(key: string, data: Uint8Array, options: any) {
      const r = await fetch(objectUrl(key), { method: 'POST', headers: { ...storageHeaders(), 'Content-Type': options.httpMetadata.contentType }, body: data });
      if (!r.ok) throw Error('素材上传失败');
    },
    async get(key: string) {
      const r = await fetch(objectUrl(key), { headers: storageHeaders() });
      if (r.status === 404) return null;
      if (!r.ok) throw Error('素材读取失败');
      return { body: r.body, size: Number(r.headers.get('content-length')) };
    },
    async delete(key: string) {
      const r = await fetch(objectUrl(key), { method: 'DELETE', headers: storageHeaders() });
      if (!r.ok && r.status !== 404) throw Error('素材删除失败');
    },
  },
};
