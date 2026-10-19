const endpoint = import.meta.env?.VITE_COC_API_URL as string | undefined;
const storageKey = (room: string) => `coc-session-v2-${room}`;

/** Same-origin on Sites; explicit room session on the standalone Pages build. */
export async function apiFetch(path: string, options: RequestInit = {}) {
  if (!endpoint) return fetch(path, options);
  const url = new URL(path, location.origin);
  let room = url.searchParams.get('room') || '';
  let action = '';
  if (typeof options.body === 'string') {
    try { const data = JSON.parse(options.body); room = data.room || room; action = data.action || ''; } catch {}
  }
  const headers = new Headers(options.headers);
  const session = localStorage.getItem(storageKey(room));
  if (session) headers.set('x-coc-session', session);
  const response = await fetch(endpoint.replace(/\/$/, '') + path.replace(/^\/api/, ''), { ...options, headers, credentials: 'omit' });
  if (url.pathname === '/api/identity' && options.method === 'POST' && response.ok) {
    const data: any = await response.clone().json();
    if (action === 'logout') localStorage.removeItem(storageKey(room));
    else if (data.session) localStorage.setItem(storageKey(data.room || room), data.session);
  }
  return response;
}

export function invitationUrl(room: string) {
  const url = new URL(location.href); url.search = ''; url.hash = `room=${room}`; return url.href;
}
