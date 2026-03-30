/* ── T&M Ticket Tracker ── */

const STORAGE_KEY = 'tm_tracker_data';

/* ── State ── */
let state = {
  projects: [],        // [{ id, name, description, createdAt }]
  tickets: [],         // [{ id, projectId, number, description, date, hours, rate, materials, status, notes, createdAt }]
  activeProjectId: null,
};

/* ── Persistence ── */
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load data', e);
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ── Helpers ── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function currency(val) {
  return '$' + Number(val || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function laborCost(ticket) {
  return (Number(ticket.hours) || 0) * (Number(ticket.rate) || 0);
}

function ticketTotal(ticket) {
  return laborCost(ticket) + (Number(ticket.materials) || 0);
}

function projectTickets(projectId) {
  return state.tickets.filter(t => t.projectId === projectId);
}

function statusBadge(status) {
  return `<span class="badge badge-${status}">${status}</span>`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ── Render ── */
function render() {
  renderSidebar();
  renderContent();
}

function renderSidebar() {
  const ul = document.getElementById('project-list');
  ul.innerHTML = '';

  if (state.projects.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No projects yet.';
    li.style.color = 'var(--text-muted)';
    li.style.cursor = 'default';
    ul.appendChild(li);
    return;
  }

  state.projects.forEach(proj => {
    const li = document.createElement('li');
    li.textContent = proj.name;
    li.title = proj.name;
    if (proj.id === state.activeProjectId) li.classList.add('active');
    li.addEventListener('click', () => selectProject(proj.id));
    ul.appendChild(li);
  });
}

function renderContent() {
  const emptyState = document.getElementById('empty-state');
  const projectView = document.getElementById('project-view');

  if (!state.activeProjectId) {
    emptyState.classList.remove('hidden');
    projectView.classList.add('hidden');
    return;
  }

  const proj = state.projects.find(p => p.id === state.activeProjectId);
  if (!proj) {
    state.activeProjectId = null;
    emptyState.classList.remove('hidden');
    projectView.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  projectView.classList.remove('hidden');

  document.getElementById('project-title').textContent = proj.name;
  const descEl = document.getElementById('project-description');
  descEl.textContent = proj.description || '';
  descEl.classList.toggle('hidden', !proj.description);

  renderSummary(proj.id);
  renderTickets(proj.id);
}

function renderSummary(projectId) {
  const tickets = projectTickets(projectId);
  const totalLabor = tickets.reduce((s, t) => s + laborCost(t), 0);
  const totalMaterials = tickets.reduce((s, t) => s + (Number(t.materials) || 0), 0);
  const grandTotal = totalLabor + totalMaterials;

  document.getElementById('summary-tickets').textContent = tickets.length;
  document.getElementById('summary-labor').textContent = currency(totalLabor);
  document.getElementById('summary-materials').textContent = currency(totalMaterials);
  document.getElementById('summary-grand').textContent = currency(grandTotal);
}

function renderTickets(projectId) {
  const tickets = projectTickets(projectId);
  const tbody = document.getElementById('ticket-tbody');
  const noMsg = document.getElementById('no-tickets-msg');
  const table = document.getElementById('ticket-table');

  tbody.innerHTML = '';

  if (tickets.length === 0) {
    table.classList.add('hidden');
    noMsg.classList.remove('hidden');
    return;
  }

  table.classList.remove('hidden');
  noMsg.classList.add('hidden');

  // Sort by date descending, then by ticket number
  const sorted = [...tickets].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return a.number.localeCompare(b.number);
  });

  sorted.forEach(ticket => {
    const labor = laborCost(ticket);
    const total = ticketTotal(ticket);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="ticket-number" data-id="${ticket.id}">${escHtml(ticket.number)}</span></td>
      <td>${escHtml(ticket.description)}</td>
      <td style="white-space:nowrap">${ticket.date}</td>
      <td>${Number(ticket.hours || 0).toFixed(2)}</td>
      <td>${currency(ticket.rate)}</td>
      <td>${currency(labor)}</td>
      <td>${currency(ticket.materials)}</td>
      <td style="font-weight:600">${currency(total)}</td>
      <td>${statusBadge(ticket.status)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-edit" data-id="${ticket.id}">Edit</button>
          <button class="btn btn-icon-danger btn-delete-ticket" data-id="${ticket.id}">✕</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Bind row events
  tbody.querySelectorAll('.ticket-number').forEach(el => {
    el.addEventListener('click', () => openDetailModal(el.dataset.id));
  });
  tbody.querySelectorAll('.btn-edit').forEach(el => {
    el.addEventListener('click', () => openEditTicketModal(el.dataset.id));
  });
  tbody.querySelectorAll('.btn-delete-ticket').forEach(el => {
    el.addEventListener('click', () => deleteTicket(el.dataset.id));
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Project actions ── */
function selectProject(id) {
  state.activeProjectId = id;
  save();
  render();
}

function openNewProjectModal() {
  document.getElementById('modal-project-title').textContent = 'New Project';
  document.getElementById('project-name-input').value = '';
  document.getElementById('project-desc-input').value = '';
  document.getElementById('modal-project').classList.remove('hidden');
  document.getElementById('project-name-input').focus();
}

function closeProjectModal() {
  document.getElementById('modal-project').classList.add('hidden');
}

function saveProject() {
  const name = document.getElementById('project-name-input').value.trim();
  if (!name) {
    alert('Project name is required.');
    return;
  }

  const newProject = {
    id: uid(),
    name,
    description: document.getElementById('project-desc-input').value.trim(),
    createdAt: new Date().toISOString(),
  };

  state.projects.push(newProject);
  state.activeProjectId = newProject.id;
  save();
  closeProjectModal();
  render();
}

function deleteProject() {
  if (!state.activeProjectId) return;
  const proj = state.projects.find(p => p.id === state.activeProjectId);
  if (!proj) return;

  const tickets = projectTickets(state.activeProjectId);
  const msg = tickets.length > 0
    ? `Delete project "${proj.name}" and its ${tickets.length} ticket(s)? This cannot be undone.`
    : `Delete project "${proj.name}"? This cannot be undone.`;

  if (!confirm(msg)) return;

  state.projects = state.projects.filter(p => p.id !== state.activeProjectId);
  state.tickets = state.tickets.filter(t => t.projectId !== state.activeProjectId);
  state.activeProjectId = state.projects.length > 0 ? state.projects[0].id : null;
  save();
  render();
}

/* ── Ticket actions ── */
let editingTicketId = null;

function openAddTicketModal() {
  editingTicketId = null;
  document.getElementById('modal-ticket-title').textContent = 'Add Ticket';

  // Auto-suggest next ticket number
  const tickets = projectTickets(state.activeProjectId);
  const nextNum = tickets.length + 1;
  document.getElementById('ticket-number').value = `TM-${String(nextNum).padStart(3, '0')}`;
  document.getElementById('ticket-date').value = today();
  document.getElementById('ticket-desc').value = '';
  document.getElementById('ticket-hours').value = '';
  document.getElementById('ticket-rate').value = '';
  document.getElementById('ticket-materials').value = '';
  document.getElementById('ticket-status').value = 'open';
  document.getElementById('ticket-notes').value = '';

  document.getElementById('modal-ticket').classList.remove('hidden');
  document.getElementById('ticket-number').focus();
}

function openEditTicketModal(ticketId) {
  const ticket = state.tickets.find(t => t.id === ticketId);
  if (!ticket) return;

  editingTicketId = ticketId;
  document.getElementById('modal-ticket-title').textContent = 'Edit Ticket';

  document.getElementById('ticket-number').value = ticket.number;
  document.getElementById('ticket-date').value = ticket.date;
  document.getElementById('ticket-desc').value = ticket.description;
  document.getElementById('ticket-hours').value = ticket.hours || '';
  document.getElementById('ticket-rate').value = ticket.rate || '';
  document.getElementById('ticket-materials').value = ticket.materials || '';
  document.getElementById('ticket-status').value = ticket.status;
  document.getElementById('ticket-notes').value = ticket.notes || '';

  document.getElementById('modal-ticket').classList.remove('hidden');
  document.getElementById('modal-detail').classList.add('hidden');
  document.getElementById('ticket-desc').focus();
}

function closeTicketModal() {
  document.getElementById('modal-ticket').classList.add('hidden');
  editingTicketId = null;
}

function saveTicket() {
  const number = document.getElementById('ticket-number').value.trim();
  const date = document.getElementById('ticket-date').value;
  const description = document.getElementById('ticket-desc').value.trim();

  if (!number) { alert('Ticket number is required.'); return; }
  if (!date)   { alert('Date is required.'); return; }
  if (!description) { alert('Description is required.'); return; }

  // Check for duplicate ticket number within same project (excluding self when editing)
  const duplicate = state.tickets.find(t =>
    t.projectId === state.activeProjectId &&
    t.number === number &&
    t.id !== editingTicketId
  );
  if (duplicate) {
    alert(`Ticket number "${number}" already exists in this project.`);
    return;
  }

  const data = {
    number,
    date,
    description,
    hours: document.getElementById('ticket-hours').value || 0,
    rate: document.getElementById('ticket-rate').value || 0,
    materials: document.getElementById('ticket-materials').value || 0,
    status: document.getElementById('ticket-status').value,
    notes: document.getElementById('ticket-notes').value.trim(),
  };

  if (editingTicketId) {
    const idx = state.tickets.findIndex(t => t.id === editingTicketId);
    if (idx !== -1) {
      state.tickets[idx] = { ...state.tickets[idx], ...data };
    }
  } else {
    state.tickets.push({
      id: uid(),
      projectId: state.activeProjectId,
      createdAt: new Date().toISOString(),
      ...data,
    });
  }

  save();
  closeTicketModal();
  render();
}

function deleteTicket(ticketId) {
  const ticket = state.tickets.find(t => t.id === ticketId);
  if (!ticket) return;
  if (!confirm(`Delete ticket "${ticket.number}"? This cannot be undone.`)) return;

  state.tickets = state.tickets.filter(t => t.id !== ticketId);
  save();
  render();
}

/* ── Detail modal ── */
let detailTicketId = null;

function openDetailModal(ticketId) {
  const ticket = state.tickets.find(t => t.id === ticketId);
  if (!ticket) return;
  detailTicketId = ticketId;

  const labor = laborCost(ticket);
  const total = ticketTotal(ticket);

  document.getElementById('detail-content').innerHTML = `
    <div class="detail-grid">
      <div class="detail-row">
        <span class="detail-label">Ticket #</span>
        <span class="detail-value">${escHtml(ticket.number)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date</span>
        <span class="detail-value">${ticket.date}</span>
      </div>
      <div class="detail-row" style="grid-column:1/-1">
        <span class="detail-label">Description</span>
        <span class="detail-value">${escHtml(ticket.description)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Labor Hours</span>
        <span class="detail-value">${Number(ticket.hours || 0).toFixed(2)} hrs</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Hourly Rate</span>
        <span class="detail-value">${currency(ticket.rate)}/hr</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Labor Cost</span>
        <span class="detail-value">${currency(labor)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Materials</span>
        <span class="detail-value">${currency(ticket.materials)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Total</span>
        <span class="detail-value" style="color:var(--primary);font-size:1.1rem">${currency(total)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="detail-value">${statusBadge(ticket.status)}</span>
      </div>
      ${ticket.notes ? `
      <div style="grid-column:1/-1;margin-top:.5rem">
        <span class="detail-label">Notes</span>
        <div class="detail-notes">${escHtml(ticket.notes)}</div>
      </div>` : ''}
    </div>
  `;

  document.getElementById('modal-detail').classList.remove('hidden');
}

function closeDetailModal() {
  document.getElementById('modal-detail').classList.add('hidden');
  detailTicketId = null;
}

/* ── Event wiring ── */
function bindEvents() {
  // Header
  document.getElementById('btn-new-project').addEventListener('click', openNewProjectModal);

  // Project modal
  document.getElementById('btn-cancel-project').addEventListener('click', closeProjectModal);
  document.getElementById('btn-save-project').addEventListener('click', saveProject);
  document.getElementById('project-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveProject();
  });

  // Project view
  document.getElementById('btn-add-ticket').addEventListener('click', openAddTicketModal);
  document.getElementById('btn-delete-project').addEventListener('click', deleteProject);

  // Ticket modal
  document.getElementById('btn-cancel-ticket').addEventListener('click', closeTicketModal);
  document.getElementById('btn-save-ticket').addEventListener('click', saveTicket);

  // Detail modal
  document.getElementById('btn-close-detail').addEventListener('click', closeDetailModal);
  document.getElementById('btn-edit-from-detail').addEventListener('click', () => {
    if (detailTicketId) openEditTicketModal(detailTicketId);
  });

  // Close modals on backdrop click
  ['modal-project', 'modal-ticket', 'modal-detail'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target === e.currentTarget) {
        e.currentTarget.classList.add('hidden');
      }
    });
  });

  // Keyboard: Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
      editingTicketId = null;
      detailTicketId = null;
    }
  });
}

/* ── Init ── */
load();
bindEvents();
render();
