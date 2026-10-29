/* Minha conta: cadastro com foto, login, dados e agendamentos do cliente */
import {
  sb, $, $$, toast, errMsg, getSession, getProfile, squareImage, uploadAvatar, signedUrls,
  fmtTime, fmtDay, TZ, mountHeader, escapeHtml, initials,
} from './core.js';

const params = new URLSearchParams(location.search);
const next = params.get('next');
const PENDING = 'dk-pending-photo';
let photoBlob = null;

/* ---------- Abas ---------- */
function showTab(which) {
  $('#tabSignup').setAttribute('aria-selected', String(which === 'signup'));
  $('#tabLogin').setAttribute('aria-selected', String(which === 'login'));
  $('#signup').hidden = which !== 'signup';
  $('#login').hidden = which !== 'login';
}
$('#tabSignup').addEventListener('click', () => showTab('signup'));
$('#tabLogin').addEventListener('click', () => showTab('login'));

/* ---------- Foto no cadastro ---------- */
$('#suPhoto').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    photoBlob = await squareImage(f);
    $('#suPreview').innerHTML = `<img src="${URL.createObjectURL(photoBlob)}" alt="" />`;
  } catch (err) { toast(errMsg(err), 'err'); }
});

const blobToDataURL = (b) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
const dataURLToBlob = async (u) => (await fetch(u)).blob();

/* ---------- Criar conta ---------- */
$('#signup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#suName').value.trim(), phone = $('#suPhone').value.trim();
  const email = $('#suEmail').value.trim(), pass = $('#suPass').value;
  if (!photoBlob) return toast('Coloca uma foto sua para o barbeiro te reconhecer.', 'err');
  if (name.split(/\s+/).length < 2) return toast('Escreve nome e sobrenome.', 'err');
  if (phone.replace(/\D/g, '').length < 10) return toast('Confere o número do WhatsApp com DDD.', 'err');
  if (pass.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres.', 'err');
  const btn = e.submitter; btn.disabled = true; btn.textContent = 'Criando…';
  const { data, error } = await sb.auth.signUp({
    email, password: pass,
    options: { data: { full_name: name, phone }, emailRedirectTo: `${location.origin}${location.pathname}${next ? `?next=${next}` : ''}` },
  });
  btn.disabled = false; btn.textContent = 'Criar conta';
  if (error) return toast(errMsg(error), 'err');
  if (data.session) {
    try { await uploadAvatar(data.user.id, photoBlob); } catch (err) { toast(`Conta criada, mas a foto não subiu: ${errMsg(err)}`, 'err'); }
    afterLogin();
  } else {
    // Confirmação por e-mail ligada: guarda a foto e sobe no primeiro login
    try { localStorage.setItem(PENDING, await blobToDataURL(photoBlob)); } catch (_) {}
    toast('Conta criada! Enviamos um link para o seu e-mail. Confirme e depois entre.');
    showTab('login');
    $('#liEmail').value = email;
  }
});

/* ---------- Entrar ---------- */
$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter; btn.disabled = true; btn.textContent = 'Entrando…';
  const { error } = await sb.auth.signInWithPassword({ email: $('#liEmail').value.trim(), password: $('#liPass').value });
  btn.disabled = false; btn.textContent = 'Entrar';
  if (error) return toast(errMsg(error), 'err');
  afterLogin();
});

$('#forgot').addEventListener('click', async () => {
  const email = $('#liEmail').value.trim();
  if (!email) return toast('Digite seu e-mail no campo acima primeiro.', 'err');
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${location.pathname}` });
  if (error) return toast(errMsg(error), 'err');
  toast('Enviamos um link para criar uma nova senha.');
});

sb.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    $('#guest').hidden = false; $('#member').hidden = true;
    $('#signup').hidden = true; $('#login').hidden = true; $('#newpass').hidden = false;
  }
});
$('#newpass').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { error } = await sb.auth.updateUser({ password: $('#npPass').value });
  if (error) return toast(errMsg(error), 'err');
  toast('Senha alterada.');
  afterLogin();
});

async function afterLogin() {
  const s = await getSession();
  // foto guardada de um cadastro com confirmação por e-mail
  try {
    const pending = localStorage.getItem(PENDING);
    if (pending && s) {
      const prof = await getProfile();
      if (!prof?.avatar_path) await uploadAvatar(s.user.id, await dataURLToBlob(pending));
      localStorage.removeItem(PENDING);
    }
  } catch (_) {}
  if (next === 'agendar') { location.href = 'agendar.html'; return; }
  render();
}

/* ---------- Área do cliente ---------- */
const STATUS = { confirmed: 'Confirmado', cancelled: 'Cancelado', done: 'Concluído', no_show: 'Faltou' };

async function render() {
  const p = await getProfile();
  mountHeader('conta');
  if (!p) { $('#guest').hidden = false; $('#member').hidden = true; return; }
  $('#guest').hidden = true; $('#member').hidden = false;

  const urls = await signedUrls([p.avatar_path]);
  $('#meAvatar').innerHTML = urls[p.avatar_path] ? `<img src="${urls[p.avatar_path]}" alt="Sua foto" />` : escapeHtml(initials(p.full_name));
  $('#meName').textContent = p.full_name || 'Sem nome';
  $('#meMeta').textContent = `${p.phone || 'sem WhatsApp'} · ${p.email}`;
  $('#meRole').textContent = p.role === 'owner' ? 'Acesso de dono: vê a agenda de todos.' : p.role === 'barber' ? 'Acesso de barbeiro.' : '';
  $('#toPanel').hidden = !['barber', 'owner'].includes(p.role);
  $('#edName').value = p.full_name; $('#edPhone').value = p.phone;

  const { data, error } = await sb.from('appointments')
    .select('id, starts_at, ends_at, status, barbers(name), services(name, price_label)')
    .eq('client_id', p.id).order('starts_at', { ascending: false }).limit(30);
  if (error) { toast(errMsg(error), 'err'); return; }
  const now = Date.now();
  const up = data.filter((a) => a.status === 'confirmed' && new Date(a.starts_at) > now).reverse();
  const past = data.filter((a) => !(a.status === 'confirmed' && new Date(a.starts_at) > now)).slice(0, 10);
  const row = (a, canCancel) => {
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(a.starts_at));
    return `<div class="appt">
      <div class="when"><b>${fmtTime(a.starts_at)}</b>${fmtDay(iso, { day: '2-digit', month: 'short' })}</div>
      <div class="what"><b>${escapeHtml(a.services?.name || '')}</b><small>com ${escapeHtml(a.barbers?.name || '')} · ${fmtDay(iso, { weekday: 'long' })} · ${escapeHtml(a.services?.price_label || '')}</small></div>
      ${canCancel ? `<button class="btn btn--ghost btn--small" data-cancel="${a.id}">Cancelar</button>` : `<span class="pill pill--${a.status}">${STATUS[a.status]}</span>`}
    </div>`;
  };
  $('#upcoming').innerHTML = up.length ? up.map((a) => row(a, true)).join('') : '<p class="empty">Nenhum horário marcado. <a href="agendar.html">Marcar agora</a></p>';
  $('#history').innerHTML = past.length ? past.map((a) => row(a, false)).join('') : '<p class="empty">Ainda sem histórico.</p>';
  $$('[data-cancel]').forEach((b) => b.addEventListener('click', () => askCancel(b)));
}

// Confirmação dentro do próprio botão (sem pop-up do navegador)
function askCancel(btn) {
  if (btn.dataset.armed) return doCancel(btn.dataset.cancel);
  btn.dataset.armed = '1';
  btn.textContent = 'Toque de novo para cancelar';
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = 'Cancelar'; } }, 4000);
}
async function doCancel(id) {
  const { error } = await sb.rpc('cancel_appointment', { p_id: id });
  if (error) return toast(errMsg(error), 'err');
  toast('Horário cancelado.');
  render();
}

$('#mePhoto').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const s = await getSession();
    await uploadAvatar(s.user.id, await squareImage(f));
    toast('Foto atualizada.');
    render();
  } catch (err) { toast(errMsg(err), 'err'); }
});

$('#editForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const s = await getSession();
  const { error } = await sb.from('profiles').update({ full_name: $('#edName').value.trim(), phone: $('#edPhone').value.trim() }).eq('id', s.user.id);
  if (error) return toast(errMsg(error), 'err');
  toast('Dados salvos.');
  render();
});

$('#logout').addEventListener('click', async () => { await sb.auth.signOut(); render(); });

if (params.get('tab') === 'login') showTab('login');
afterLoginIfReturning();
async function afterLoginIfReturning() {
  const s = await getSession();
  if (s && next === 'agendar') { await afterLogin(); return; }
  if (s) { await afterLogin(); return; }
  render();
}
