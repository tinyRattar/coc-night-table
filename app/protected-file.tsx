import { useEffect, useState, type ComponentProps } from 'react';
import { apiFetch } from './backend';

// Attach credentials in a header, never in an image URL or shared download link.
export function ProtectedImage({ src, ...props }: ComponentProps<'img'> & {src: string}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true, objectUrl = ''; const controller = new AbortController();
    setUrl('');
    apiFetch(src, { signal: controller.signal }).then(async r => {
      if (!r.ok) throw Error('无法读取素材');
      const blob = await r.blob(); if (!active) return;
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(() => {});
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);
  return url ? <img {...props} src={url}/> : <span role="status">图片载入中…</span>;
}

export function ProtectedLink({ href, children, download, ...props }: ComponentProps<'a'> & {href: string}) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <><a {...props} href={href} aria-busy={busy} onClick={async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const r = await apiFetch(href); if (!r.ok) throw Error('素材不可用，可能已被 KP 撤回');
      const url = URL.createObjectURL(await r.blob()); const link = document.createElement('a');
      link.href = url; link.download = typeof download === 'string' ? download : '素材'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setError(e instanceof Error ? e.message : '下载失败'); } finally { setBusy(false); }
  }}>{busy ? '正在读取…' : children}</a>{error && <span role="alert">{error}</span>}</>;
}
