/* Página de agendamento: barbeiro → serviço → dia → horário → confirmar */
import {
  sb, $, $$, todayISO, addDays, fmtDay, fmtTime, weekdayOf, initials, toast, errMsg, getSession, mountHeader, escapeHtml,
} from './core.js';

const DAYS_AHEAD = 21;
const OPEN_DAYS = [2, 3, 4, 5, 6]; // terça a sábado
const state = { barber: null, service: null, day: null, slot: null, cat: null };
let barbers = [], services = [];

/* Guarda a escolha para voltar depois do login */
const SAVE_KEY = 'dk-booking';
const save = () => { try { sessionStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (_) {} };
const restore = () => { try { return JSON.parse(sessionStorage.getItem(SAVE_KEY) || 'null'); } catch (_) { return null; } };

function lock(id, locked) { $(id).classList.toggle('is-locked', locked); }

/* ---------- 1. Barbeiros ---------- */
function renderBarbers() {
  $('#barbers').innerHTML = barbers.map((b) => `
    <button class="pick barber-pick" data-id="${b.id}" aria-pressed="${state.barber === b.id}">
      <span class="pole">${escapeHtml(initials(b.name).slice(0, 1))}</span><b>${escapeHtml(b.name)}</b>
    </button>`).join('');
  $$('#barbers .pick').forEach((el) => el.addEventListener('click', () => {
    state.barber = el.dataset.id; state.slot = null;
    renderBarbers(); lock('#stepService', false);
    if (state.service) loadDays();
    update();
    if (!state.service) $('#stepService').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

/* ---------- 2. Serviços ---------- */
function renderServices() {
  const cats = [...new Set(services.map((s) => s.category))];
  if (!state.cat) state.cat = services.find((s) => s.id === state.service)?.category || cats[0];
  $('#cats').innerHTML = cats.map((c) => `<button class="chip" data-cat="${escapeHtml(c)}" aria-pressed="${c === state.cat}">${escapeHtml(c)}</button>`).join('');
  $$('#cats .chip').forEach((el) => el.addEventListener('click', () => { state.cat = el.dataset.cat; renderServices(); }));
  $('#services').innerHTML = services.filter((s) => s.category === state.cat).map((s) => `
    <button class="pick svc" data-id="${s.id}" aria-pressed="${state.service === s.id}">
      <b>${escapeHtml(s.name)}</b><small>${s.duration_min} min</small><span class="price">${escapeHtml(s.price_label)}</span>
    </button>`).join('');
  $$('#services .pick').forEach((el) => el.addEventListener('click', () => {
    state.service = el.dataset.id; state.slot = null;
    renderServices(); lock('#stepDay', false);
    loadDays(); update();
    $('#stepDay').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

/* ---------- 3. Dias ---------- */
async function loadDays() {
  const from = todayISO(), to = addDays(from, DAYS_AHEAD - 1);
  const list = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(from, i));
  renderDays(list, null);
  const { data, error } = await sb.rpc('available_days', { p_barber: state.barber, p_service: state.service, p_from: from, p_to: to });
  if (error) { toast(errMsg(error), 'err'); return; }
  const free = Object.fromEntries((data || []).map((d) => [d.day, d.free]));
  renderDays(list, free);
  if (state.day && !free[state.day]) { state.day = null; state.slot = null; }
  if (state.day) loadSlots();
  update();
}
function renderDays(list, free) {
  $('#days').innerHTML = list.map((iso) => {
    const open = OPEN_DAYS.includes(weekdayOf(iso));
    const n = free ? free[iso] || 0 : null;
    const disabled = !open || (free && n === 0);
    const status = !open ? 'Fechado' : free === null ? '…' : n === 0 ? 'Lotado' : `${n} livres`;
    return `<button class="day" data-day="${iso}" aria-pressed="${state.day === iso}" ${disabled ? 'disabled' : ''}>
      <span class="wd">${fmtDay(iso, { weekday: 'short' }).replace('.', '')}</span>
      <span class="dn">${fmtDay(iso, { day: 'numeric' })}</span>
      <span class="mo">${fmtDay(iso, { month: 'short' }).replace('.', '')}</span>
      <span class="st">${status}</span></button>`;
  }).join('');
  $$('#days .day:not([disabled])').forEach((el) => el.addEventListener('click', () => {
    state.day = el.dataset.day; state.slot = null;
    $$('#days .day').forEach((d) => d.setAttribute('aria-pressed', String(d === el)));
    lock('#stepTime', false); loadSlots(); update();
    $('#stepTime').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

/* ---------- 4. Horários ---------- */
async function loadSlots() {
  lock('#stepTime', false);
  $('#slots').innerHTML = '<p class="loading">Buscando horários livres…</p>';
  const { data, error } = await sb.rpc('available_slots', { p_barber: state.barber, p_day: state.day, p_service: state.service });
  if (error) { toast(errMsg(error), 'err'); return; }
  const slots = (data || []).map((r) => r.slot_start);
  if (!slots.length) { $('#slots').innerHTML = '<p class="empty">Sem horários livres nesse dia. Tenta outro dia ou outro barbeiro.</p>'; return; }
  const hour = (ts) => Number(fmtTime(ts).slice(0, 2));
  const groups = [['Manhã', (h) => h < 12], ['Tarde', (h) => h >= 12 && h < 17], ['Fim de tarde', (h) => h >= 17]];
  $('#slots').innerHTML = groups.map(([label, fn]) => {
    const g = slots.filter((s) => fn(hour(s)));
    if (!g.length) return '';
    return `<p class="slot-group">${label}</p><div class="slots">${g.map((s) =>
      `<button class="slot" data-ts="${s}" aria-pressed="${state.slot === s}">${fmtTime(s)}</button>`).join('')}</div>`;
  }).join('');
  $$('#slots .slot').forEach((el) => el.addEventListener('click', () => {
    state.slot = el.dataset.ts;
    $$('#slots .slot').forEach((s) => s.setAttribute('aria-pressed', String(s === el)));
    update();
  }));
}

/* ---------- Resumo ---------- */
async function update() {
  const b = barbers.find((x) => x.id === state.barber);
  const s = services.find((x) => x.id === state.service);
  $('#sBarber').textContent = b?.name || '—';
  $('#sService').textContent = s ? `${s.name} (${s.duration_min} min)` : '—';
  $('#sDay').textContent = state.day ? fmtDay(state.day) : '—';
  $('#sTime').textContent = state.slot ? fmtTime(state.slot) : '—';
  $('#sPrice').textContent = s?.price_label || '—';
  const ready = Boolean(b && s && state.day && state.slot);
  $('#miniTxt').innerHTML = ready
    ? `<b>${escapeHtml(b.name)}</b> · ${escapeHtml(s.name)} · ${fmtDay(state.day, { weekday: 'short', day: 'numeric' })} às <b>${fmtTime(state.slot)}</b>`
    : 'Escolha barbeiro, serviço, dia e horário';
  const logged = Boolean(await getSession());
  $('#confirm').disabled = !ready;
  $('#confirm').textContent = logged ? 'Confirmar agendamento' : 'Entrar para confirmar';
  save();
}

$('#confirm').addEventListener('click', async () => {
  const session = await getSession();
  if (!session) { save(); location.href = 'conta.html?next=agendar'; return; }
  const btn = $('#confirm');
  btn.disabled = true; btn.textContent = 'Marcando…';
  const { error } = await sb.rpc('book_appointment', { p_barber: state.barber, p_service: state.service, p_start: state.slot });
  if (error) {
    toast(errMsg(error), 'err');
    btn.disabled = false; update(); loadSlots(); loadDays();
    return;
  }
  const b = barbers.find((x) => x.id === state.barber), s = services.find((x) => x.id === state.service);
  $('#doneTxt').textContent = `${s.name} com ${b.name}, ${fmtDay(state.day)} às ${fmtTime(state.slot)}.`;
  try { sessionStorage.removeItem(SAVE_KEY); } catch (_) {}
  $('#book').hidden = true; $('#done').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ---------- Início ---------- */
(async function init() {
  mountHeader('agendar');
  const [rb, rs] = await Promise.all([
    sb.from('barbers').select('id,name').order('sort'),
    sb.from('services').select('id,name,category,price_label,duration_min').order('sort'),
  ]);
  if (rb.error || rs.error) { toast('Não foi possível carregar a agenda. Recarregue a página.', 'err'); return; }
  barbers = rb.data; services = rs.data;

  const saved = restore();
  if (saved) Object.assign(state, saved);
  if (!barbers.some((b) => b.id === state.barber)) state.barber = null;
  if (!services.some((s) => s.id === state.service)) state.service = null;

  renderBarbers(); renderServices();
  if (state.barber) lock('#stepService', false);
  if (state.barber && state.service) { lock('#stepDay', false); await loadDays(); }
  update();
})();
