const STATUSES = ['Open', 'In Progress', 'Blocked', 'Done'];
const POLL_MS = 10000;

const state = {
  data: null,
  epicFilter: '',
  healthFilter: '',
  search: '',
};

const el = (sel) => document.querySelector(sel);

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(raw) {
  let s = escapeHtml(raw ?? '');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

async function loadTracker() {
  const res = await fetch('/api/tracker', { cache: 'no-store' });
  if (!res.ok) throw new Error(`tracker fetch failed: ${res.status}`);
  return res.json();
}

function allTickets(data) {
  const out = [];
  for (const epic of data.epics) {
    for (const ticket of epic.tickets) {
      out.push({ ...ticket, epicId: epic.id, epicTitle: epic.title });
    }
  }
  return out;
}

function matchesFilters(t) {
  if (state.epicFilter && t.epicId !== state.epicFilter) return false;
  if (state.healthFilter && t.health !== state.healthFilter) return false;
  if (state.search) {
    const q = state.search.toLowerCase();
    const hay = `${t.id} ${t.title} ${t.note}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function renderSummary(tickets) {
  const counts = { Open: 0, 'In Progress': 0, Blocked: 0, Done: 0 };
  for (const t of tickets) {
    if (counts[t.status] !== undefined) counts[t.status]++;
  }
  el('#summary').innerHTML = `
    <div class="summary-stat"><div class="n">${tickets.length}</div><div class="l">Tickets shown</div></div>
    ${STATUSES.map((s) => `<div class="summary-stat"><div class="n">${counts[s]}</div><div class="l">${s}</div></div>`).join('')}
  `;
}

function cardHtml(t) {
  return `
    <div class="card" data-id="${t.id}">
      <div class="card-top">
        <span class="card-id">${t.id}</span>
        <span class="card-epic">${t.epicId}</span>
      </div>
      <div class="card-title">${renderInline(t.title)}</div>
      <div class="card-bottom">
        <span>${t.health || ''}</span>
        <span>${t.lastUpdated || ''}</span>
      </div>
    </div>
  `;
}

function renderBoard(tickets) {
  const board = el('#board');
  board.innerHTML = STATUSES.map((status) => {
    const col = tickets.filter((t) => t.status === status);
    const body = col.length
      ? col.map(cardHtml).join('')
      : '<div class="empty-col">No tickets</div>';
    return `
      <div class="column" data-status="${status}">
        <div class="column-head">
          <span><span class="dot"></span>${status}</span>
          <span class="count">${col.length}</span>
        </div>
        <div class="column-body">${body}</div>
      </div>
    `;
  }).join('');

  board.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => openTicketPanel(card.dataset.id));
  });
}

function populateEpicFilter(data) {
  const sel = el('#epic-filter');
  const current = sel.value;
  sel.innerHTML =
    '<option value="">All epics</option>' +
    data.epics.map((e) => `<option value="${e.id}">${e.id} — ${escapeHtml(e.title)}</option>`).join('');
  sel.value = current;
}

function findTicket(id) {
  for (const epic of state.data.epics) {
    const t = epic.tickets.find((x) => x.id === id);
    if (t) return { ticket: t, epic };
  }
  return null;
}

function changeLogEntriesFor(id) {
  return state.data.changeLog.filter(
    (entry) => entry.title.includes(id) || entry.body.includes(id),
  );
}

function openTicketPanel(id) {
  const found = findTicket(id);
  if (!found) return;
  const { ticket, epic } = found;
  const entries = changeLogEntriesFor(id);

  el('#panel-content').innerHTML = `
    <div class="panel-content">
      <h2>${ticket.id} — ${renderInline(ticket.title)}</h2>
      <div class="panel-meta">
        <span class="pill">${epic.id} · ${escapeHtml(epic.title)}</span>
        <span class="pill">${ticket.status}</span>
        <span class="pill">${ticket.health}</span>
        <span class="pill">Updated ${ticket.lastUpdated}</span>
      </div>
      <div class="panel-section">
        <h3>Note</h3>
        <div class="panel-note">${renderInline(ticket.note)}</div>
      </div>
      <div class="panel-section">
        <h3>Change Log mentions (${entries.length})</h3>
        ${
          entries.length
            ? entries
                .map(
                  (e) => `
          <details class="log-entry">
            <summary><span class="log-date">${e.date}</span>${renderInline(e.title)}</summary>
            <div class="log-body">${renderInline(e.body)}</div>
          </details>`,
                )
                .join('')
            : '<div class="subtle">No change log entry mentions this ticket ID.</div>'
        }
      </div>
    </div>
  `;
  el('#ticket-panel').classList.remove('hidden');
}

function closePanel() {
  el('#ticket-panel').classList.add('hidden');
}

function renderChangeLog(data) {
  el('#changelog').innerHTML = data.changeLog
    .map(
      (e, i) => `
    <details class="log-entry" ${i === 0 ? 'open' : ''}>
      <summary><span class="log-date">${e.date}</span>${renderInline(e.title)}</summary>
      <div class="log-body">${renderInline(e.body)}</div>
    </details>`,
    )
    .join('');
}

function renderAll() {
  if (!state.data) return;
  const tickets = allTickets(state.data).filter(matchesFilters);
  renderSummary(tickets);
  renderBoard(tickets);
  renderChangeLog(state.data);
  el('#generated-at').textContent = `Synced ${new Date(state.data.generatedAt).toLocaleTimeString()}`;
}

async function refresh() {
  try {
    const data = await loadTracker();
    const firstLoad = !state.data;
    state.data = data;
    if (firstLoad) populateEpicFilter(data);
    renderAll();
    el('#status-text').textContent = `${data.sourceFile} · ${data.epics.length} epics · ${allTickets(data).length} tickets · ${data.changeLog.length} change log entries`;
  } catch (err) {
    el('#status-text').textContent = `Error loading tracker: ${err.message}`;
  }
}

function wireControls() {
  el('#search').addEventListener('input', (e) => {
    state.search = e.target.value.trim();
    renderAll();
  });
  el('#epic-filter').addEventListener('change', (e) => {
    state.epicFilter = e.target.value;
    renderAll();
  });
  el('#health-filter').addEventListener('change', (e) => {
    state.healthFilter = e.target.value;
    renderAll();
  });
  el('#panel-close').addEventListener('click', closePanel);
  el('#panel-backdrop').addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });

  el('#view-board').addEventListener('click', () => {
    el('#view-board').classList.add('active');
    el('#view-log').classList.remove('active');
    el('#board-view').classList.remove('hidden');
    el('#log-view').classList.add('hidden');
  });
  el('#view-log').addEventListener('click', () => {
    el('#view-log').classList.add('active');
    el('#view-board').classList.remove('active');
    el('#log-view').classList.remove('hidden');
    el('#board-view').classList.add('hidden');
  });
}

wireControls();
refresh();
setInterval(refresh, POLL_MS);
