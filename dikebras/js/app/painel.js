/* Painel da equipe: agenda do dia por barbeiro, com foto do cliente */
import {
  sb, $, $$, toast, errMsg, getProfile, signedUrls, avatarEl, fmtTime, fmtDay, todayISO, addDays, dayStart,
  weekdayOf, mountHeader, escapeHtml,
} from './core.js';

const STATUS = { confirmed: 'Confirmado', cancelled: 'Cancelado', done: 'Concluído', no_show: 'Faltou' };
let me = null, barbers = [], current = 'all', day = todayISO();

function myBarbers() {
  return me.role === 'owner' ? barbers : barbers.filter((b) => b.user_id === me.id);
}

function renderTabs() {
  const list = myBarbers();
  const tabs = me.role === 'owner' && list.length > 1 ? [{ id: 'all', name: 'Todos' }, ...list] : list;
  if (!tabs.some((t) => t.id === current)) current = tabs[0]?.id;
  $('#barberTabs').innerHTML = tabs.map((t) => `<button class="chip" data-id="${t.id}" aria-pressed="${t.id === current}">${escapeHtml(t.name)}</button>`).join('');
  $$('#barberTabs .chip').forEach((el) => el.addEventListener('click', () => { current = el.dataset.id; renderTabs(); load(); }));
  $('#blockBarber').innerHTML = list.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
  $('#blockBarberWrap').hidden = list.length < 2;
}

async function load() {
  $('#dayInput').value = day;
  $('#blockDay').value = day;
  const closed = ![2, 3, 4, 5, 6].includes(weekdayOf(day));
  $('#dayLabel').textContent = `${fmtDay(day)}${closed ? ' · barbearia fechada' : ''}`;
  const ids = current === 'all' ? myBarbers().map((b) => b.id) : [current];
  const from = dayStart(day), to = dayStart(addDays(day, 1));

  const [ra, rt] = await Promise.all([
    sb.from('appointments')
      .select('id, barber_id, starts_at, ends_at, status, services(name, price_label), profiles(full_name, phone, avatar_path)')
      .in('barber_id', ids).gte('starts_at', from).lt('starts_at', to).order('starts_at'),
    sb.from('time_off').select('id, barber_id, starts_at, ends_at, reason').in('barber_id', ids).lt('starts_at', to).gt('ends_at', from).order('starts_at'),
  ]);
  if (ra.error || rt.error) { toast(errMsg(ra.error || rt.error), 'err'); return; }
  const urls = await signedUrls(ra.data.map((a) => a.profiles?.avatar_path));

  $('#board').innerHTML = ids.map((bid) => {
    const b = barbers.find((x) => x.id === bid);
    const appts = ra.data.filter((a) => a.barber_id === bid);
    const blocks = rt.data.filter((t) => t.barber_id === bid);
    const active = appts.filter((a) => a.status !== 'cancelled').length;
    const tickets = appts.map((a) => {
      const p = a.profiles || {};
      const wa = (p.phone || '').replace(/\D/g, '');
      return `<article class="ticket is-${a.status}">
        <div>${avatarEl(urls[p.avatar_path], p.full_name || '?')}</div>
        <div>
          <div class="t">${fmtTime(a.starts_at)} – ${fmtTime(a.ends_at)}</div>
          <div class="who"><div><b>${escapeHtml(p.full_name || 'Cliente')}</b>
            <small>${escapeHtml(a.services?.name || '')} · ${escapeHtml(a.services?.price_label || '')}</small></div></div>
          <span class="pill pill--${a.status}">${STATUS[a.status]}</span>
        </div>
        <div class="acts">
          ${wa ? `<a class="btn btn--ghost btn--small" href="https://wa.me/55${wa.replace(/^55/, '')}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          ${a.status === 'confirmed' ? `
            <button class="btn btn--small" data-st="done" data-id="${a.id}">Concluído</button>
            <button class="btn btn--ghost btn--small" data-st="no_show" data-id="${a.id}">Faltou</button>
            <button class="btn btn--ghost btn--small" data-st="cancelled" data-id="${a.id}">Cancelar</button>`
            : `<button class="btn btn--ghost btn--small" data-st="confirmed" data-id="${a.id}">Reabrir</button>`}
        </div>
      </article>`;
    }).join('');
    const blockHtml = blocks.map((t) => `<div class="block"><span>⛔ ${fmtTime(t.starts_at)} – ${fmtTime(t.ends_at)} · ${escapeHtml(t.reason || 'Bloqueado')}</span>
      <button class="btn btn--ghost btn--small" data-unblock="${t.id}">Liberar</button></div>`).join('');
    return `<section class="card col">
      <h2>${escapeHtml(b?.name || '')} <small>${active} ${active === 1 ? 'cliente' : 'clientes'}</small></h2>
      ${blockHtml}${tickets || '<p class="empty">Nenhum agendamento nesse dia.</p>'}
    </section>`;
  }).join('');

  $$('[data-st]').forEach((el) => el.addEventListener('click', () => setStatus(el)));
  $$('[data-unblock]').forEach((el) => el.addEventListener('click', async () => {
    const { error } = await sb.from('time_off').delete().eq('id', el.dataset.unblock);
    if (error) return toast(errMsg(error), 'err');
    toast('Horário liberado.'); load();
  }));
}

// Cancelar pede um segundo toque; os outros status são imediatos
async function setStatus(el) {
  if (el.dataset.st === 'cancelled' && !el.dataset.armed) {
    el.dataset.armed = '1'; el.textContent = 'Confirmar cancelamento';
    setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = 'Cancelar'; } }, 4000);
    return;
  }
  const { error } = await sb.rpc('set_appointment_status', { p_id: el.dataset.id, p_status: el.dataset.st });
  if (error) return toast(errMsg(error), 'err');
  load();
}

$('#prevDay').addEventListener('click', () => { day = addDays(day, -1); load(); });
$('#nextDay').addEventListener('click', () => { day = addDays(day, 1); load(); });
$('#today').addEventListener('click', () => { day = todayISO(); load(); });
$('#dayInput').addEventListener('change', (e) => { if (e.target.value) { day = e.target.value; load(); } });

$('#blockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = $('#blockDay').value, f = $('#blockFrom').value, t = $('#blockTo').value;
  if (!d || !f || !t || t <= f) return toast('Confira o horário: o fim precisa ser depois do início.', 'err');
  const barber = myBarbers().length > 1 ? $('#blockBarber').value : myBarbers()[0].id;
  const { error } = await sb.from('time_off').insert({
    barber_id: barber, starts_at: `${d}T${f}:00-03:00`, ends_at: `${d}T${t}:00-03:00`,
    reason: $('#blockReason').value.trim() || null, created_by: me.id,
  });
  if (error) return toast(errMsg(error), 'err');
  toast('Horário bloqueado.');
  day = d; load();
});

(async function init() {
  mountHeader('painel');
  me = await getProfile();
  if (!me || !['barber', 'owner'].includes(me.role)) {
    $('#noAccess').hidden = false;
    if (me) $('#noAccessTxt').textContent = 'Este painel é só para a equipe da barbearia.';
    return;
  }
  const { data, error } = await sb.from('barbers').select('id, name, user_id').order('sort');
  if (error) return toast(errMsg(error), 'err');
  barbers = data;
  if (!myBarbers().length) {
    $('#noAccess').hidden = false;
    $('#noAccessTxt').textContent = 'Sua conta de barbeiro ainda não está ligada a uma cadeira. Fale com o dono.';
    return;
  }
  $('#panel').hidden = false;
  renderTabs();
  load();

  // Atualiza sozinho quando alguém agenda ou cancela
  sb.channel('agenda').on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => load()).subscribe();
})();
