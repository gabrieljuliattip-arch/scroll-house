/* Núcleo das páginas de agenda: conexão com o Supabase + utilidades */
import { createClient } from '@supabase/supabase-js';

// Chave pública (publishable): pode ficar no navegador. A segurança vem das regras (RLS) no banco.
export const SUPABASE_URL = 'https://bjkjisiskxplgontmozd.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_tLvnJ-GYik2SJeY_GSUF6A_a0Cri79G';
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const TZ = 'America/Sao_Paulo';
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Datas (horário de Brasília, sem horário de verão) ---------- */
export const pad = (n) => String(n).padStart(2, '0');
export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); // AAAA-MM-DD
}
export function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}
export const dayStart = (iso) => `${iso}T00:00:00-03:00`;
export const fmtTime = (ts) => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
export const fmtDay = (iso, opts = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, ...opts }).format(new Date(`${iso}T12:00:00-03:00`));
export const fmtDateTime = (ts) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
export const weekdayOf = (iso) => new Date(`${iso}T12:00:00-03:00`).getUTCDay();
export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase() || '?';

/* ---------- Mensagens ---------- */
export function toast(msg, type = 'ok') {
  let box = $('#toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast';
    box.setAttribute('role', 'status');
    document.body.appendChild(box);
  }
  box.textContent = msg;
  box.className = `toast toast--${type} is-on`;
  clearTimeout(box._t);
  box._t = setTimeout(() => box.classList.remove('is-on'), 4200);
}
export const errMsg = (e) => {
  const m = e?.message || String(e);
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/User already registered/i.test(m)) return 'Esse e-mail já tem cadastro. Use a aba Entrar.';
  if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/rate limit/i.test(m)) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  if (/no_overlap/i.test(m)) return 'Esse horário acabou de ser ocupado. Escolha outro.';
  return m;
};

/* ---------- Sessão e perfil ---------- */
export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}
export async function getProfile() {
  const s = await getSession();
  if (!s) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
  return data ? { ...data, email: s.user.email } : null;
}

/* ---------- Fotos ---------- */
// Recorta no centro, quadrado 512px, JPEG — leve para subir pelo celular
export function squareImage(file, size = 512) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível ler a foto.'))), 'image/jpeg', 0.86);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
    img.src = URL.createObjectURL(file);
  });
}
export async function uploadAvatar(userId, blob) {
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { error: e2 } = await sb.from('profiles').update({ avatar_path: path }).eq('id', userId);
  if (e2) throw e2;
  return path;
}
export async function signedUrls(paths) {
  const list = [...new Set(paths.filter(Boolean))];
  if (!list.length) return {};
  const { data } = await sb.storage.from('avatars').createSignedUrls(list, 3600);
  return Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}
export function avatarEl(url, name, cls = 'avatar') {
  return url
    ? `<img class="${cls}" src="${url}" alt="Foto de ${escapeHtml(name)}" loading="lazy" />`
    : `<span class="${cls} ${cls}--empty" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
}
export const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Cabeçalho: muda conforme login ---------- */
export async function mountHeader(active) {
  const nav = $('#appNav');
  if (!nav) return;
  const p = await getProfile();
  const staff = p && ['barber', 'owner'].includes(p.role);
  nav.innerHTML = `
    <a href="agendar.html" ${active === 'agendar' ? 'aria-current="page"' : ''}>Agendar</a>
    <a href="conta.html" ${active === 'conta' ? 'aria-current="page"' : ''}>${p ? 'Minha conta' : 'Entrar / Cadastro'}</a>
    ${staff ? `<a href="painel.html" ${active === 'painel' ? 'aria-current="page"' : ''}>Painel</a>` : ''}`;
}
