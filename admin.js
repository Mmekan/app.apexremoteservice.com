// =============================================
// Supabase
// =============================================
const { createClient } = window.supabase;
const supabaseClient = createClient(
  'https://glwncvlpnchxcsngsuhe.supabase.co',
  'sb_publishable_D84XYOx5qE_iGSbKk0WE5g_KJf-qb1J'
);

let allApplicants = [];
let currentFilter = 'all';
let activeApplicant = null;

// =============================================
// Boot — verify admin
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) { window.location.replace('login.html'); return; }

  // Check admin flag
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('first_name, last_name, is_admin')
    .eq('user_id', session.user.id)
    .single();

  if (!profile?.is_admin) {
    // Not an admin — send back to user dashboard
    window.location.replace('dashboard.html');
    return;
  }

  const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || session.user.email;
  document.getElementById('adminGreet').textContent = name;

  await loadAllData();
  bindEvents();
});

// =============================================
// Load all applicants
// =============================================
async function loadAllData() {
  // Fetch all profiles + their applications in one go
  const { data: profiles, error } = await supabaseClient
    .from('profiles')
    .select(`
      user_id, first_name, last_name, email,
      country, city, phone_number, education_level,
      employment_status, available_equipment,
      additional_languages, experience, referral_code,
      created_at, is_admin,
      applications (
        application_status, profile_complete, identity_complete,
        payment_complete, opportunity_selected, selected_opportunity,
        updated_at
      )
    `)
    .eq('is_admin', false)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }

  // Flatten
  allApplicants = (profiles || []).map(p => ({
    ...p,
    app: p.applications?.[0] || {}
  }));

  renderStats();
  renderRecentTable();
  renderApplicantsTable(allApplicants);
}

// =============================================
// Stats
// =============================================
function renderStats() {
  const total    = allApplicants.length;
  const inReview = allApplicants.filter(a => a.app.application_status === 'in_review').length;
  const approved = allApplicants.filter(a => a.app.application_status === 'approved').length;
  const rejected = allApplicants.filter(a => a.app.application_status === 'rejected').length;

  document.getElementById('statTotal').textContent    = total;
  document.getElementById('statReview').textContent   = inReview;
  document.getElementById('statApproved').textContent = approved;
  document.getElementById('statRejected').textContent = rejected;
}

// =============================================
// Recent table (overview page — top 5 submitted)
// =============================================
function renderRecentTable() {
  const recent = allApplicants
    .filter(a => a.app.application_status && a.app.application_status !== 'draft')
    .slice(0, 5);

  const tbody = document.getElementById('recentTable');
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#a0aec0;padding:30px;">No submissions yet</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(a => `
    <tr onclick="openModal('${a.user_id}')">
      <td><strong>${fullName(a)}</strong></td>
      <td>${a.email || '—'}</td>
      <td>${a.app.selected_opportunity || '—'}</td>
      <td>${statusPill(a.app.application_status)}</td>
      <td>${formatDate(a.app.updated_at)}</td>
    </tr>`).join('');
}

// =============================================
// Applicants table (filtered)
// =============================================
function renderApplicantsTable(list) {
  const tbody = document.getElementById('applicantsTable');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#a0aec0;padding:30px;">No applicants found</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(a => {
    const steps    = [a.app.profile_complete, a.app.identity_complete, a.app.payment_complete];
    const done     = steps.filter(Boolean).length;
    const pct      = Math.round((done / 3) * 100);
    return `
      <tr onclick="openModal('${a.user_id}')">
        <td><strong>${fullName(a)}</strong></td>
        <td>${a.country || '—'}</td>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${a.app.selected_opportunity || '—'}
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="progress-mini"><div class="progress-mini-fill" style="width:${pct}%"></div></div>
            <span style="font-size:.78rem;color:#8a95ab;">${pct}%</span>
          </div>
        </td>
        <td>${statusPill(a.app.application_status || 'draft')}</td>
        <td>${formatDate(a.created_at)}</td>
      </tr>`;
  }).join('');
}

// =============================================
// Modal
// =============================================
function openModal(userId) {
  const a = allApplicants.find(x => x.user_id === userId);
  if (!a) return;
  activeApplicant = a;

  document.getElementById('modalName').textContent = fullName(a);

  // Detail grid
  document.getElementById('modalDetails').innerHTML = [
    ['Email',       a.email],
    ['Country',     a.country],
    ['City',        a.city],
    ['Phone',       a.phone_number],
    ['Education',   a.education_level],
    ['Employment',  a.employment_status],
    ['Equipment',   a.available_equipment],
    ['Languages',   a.additional_languages || 'None'],
    ['Referral',    a.referral_code || 'None'],
    ['Opportunity', a.app.selected_opportunity || 'Not selected'],
    ['Joined',      formatDate(a.created_at)],
    ['Last Update', formatDate(a.app.updated_at)],
  ].map(([label, val]) => `
    <div class="detail-item">
      <label>${label}</label>
      <span>${val || '—'}</span>
    </div>`).join('');

  // Checklist
  document.getElementById('modalChecklist').innerHTML = [
    ['Profile',  a.app.profile_complete],
    ['Identity', a.app.identity_complete],
    ['Payment',  a.app.payment_complete],
    ['Opportunity', a.app.opportunity_selected],
  ].map(([label, done]) => `
    <div style="
      display:flex;align-items:center;gap:6px;
      padding:5px 12px;border-radius:20px;font-size:.8rem;font-weight:600;
      background:${done ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.08)'};
      color:${done ? '#16a34a' : '#ef4444'};
    ">
      ${done ? '✓' : '✗'} ${label}
    </div>`).join('');

  // Show/hide action buttons based on current status
  const status = a.app.application_status;
  const actions = document.getElementById('modalActions');
  if (status === 'approved' || status === 'rejected') {
    actions.innerHTML = `
      <div style="font-size:.88rem;color:#8a95ab;padding:8px 0;">
        This application has already been <strong>${status}</strong>.
      </div>
      <button class="btn-neutral" id="modalClose2">Close</button>`;
    document.getElementById('modalClose2').onclick = closeModal;
  } else {
    document.getElementById('modalActions').innerHTML = `
      <button class="btn-approve" id="btnApprove">✓ Approve</button>
      <button class="btn-reject"  id="btnRejectToggle">✕ Reject</button>
      <button class="btn-neutral" id="modalClose2">Cancel</button>`;
    document.getElementById('btnApprove').onclick      = approveApplicant;
    document.getElementById('btnRejectToggle').onclick = toggleRejectReason;
    document.getElementById('modalClose2').onclick     = closeModal;
  }

  // Reset reject reason
  document.getElementById('rejectReason').style.display = 'none';
  document.getElementById('rejectMessage').value        = '';

  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  activeApplicant = null;
}

function toggleRejectReason() {
  const el = document.getElementById('rejectReason');
  el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

// =============================================
// Call Edge Function to send email
// =============================================
async function sendNotificationEmail(type, applicant) {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    await fetch(
      'https://glwncvlpnchxcsngsuhe.supabase.co/functions/v1/notify-applicant',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          type,
          email:        applicant.email,
          firstName:    applicant.first_name || 'Applicant',
          dashboardUrl: 'https://app.apexremoteservices.com/dashboard.html'
        })
      }
    );
  } catch (err) {
    console.error('Email send failed:', err);
  }
}

// =============================================
// Approve
// =============================================
async function approveApplicant() {
  if (!activeApplicant) return;
  const btn = document.getElementById('btnApprove');
  btn.textContent = 'Approving…';
  btn.disabled    = true;

  const { error } = await supabaseClient
    .from('applications')
    .update({
      application_status: 'approved',
      updated_at:         new Date().toISOString()
    })
    .eq('user_id', activeApplicant.user_id);

  if (error) {
    alert('Error: ' + error.message);
    btn.textContent = '✓ Approve';
    btn.disabled    = false;
    return;
  }

  // In-app notification
  await supabaseClient.from('notifications').insert({
    user_id:     activeApplicant.user_id,
    title:       'Application approved! 🎉',
    description: 'Congratulations! Your application has been reviewed and approved. Welcome to the Apex Remote Services network. Check your email for further details.',
    type:        'success'
  });

  // Email notification
  await sendNotificationEmail('approved', activeApplicant);

  closeModal();
  await loadAllData();
}

// =============================================
// Reject
// =============================================
async function confirmReject() {
  if (!activeApplicant) return;
  const btn    = document.getElementById('btnRejectConfirm');
  const reason = document.getElementById('rejectMessage').value.trim();
  btn.textContent = 'Rejecting…';
  btn.disabled    = true;

  const { error } = await supabaseClient
    .from('applications')
    .update({
      application_status: 'rejected',
      updated_at:         new Date().toISOString()
    })
    .eq('user_id', activeApplicant.user_id);

  if (error) {
    alert('Error: ' + error.message);
    btn.textContent = 'Confirm Rejection';
    btn.disabled    = false;
    return;
  }

  // In-app notification
  await supabaseClient.from('notifications').insert({
    user_id:     activeApplicant.user_id,
    title:       'Application not accepted',
    description: reason
      ? `Your application was not accepted. Reason: ${reason} — Please review your application and resubmit within 72 hours. Keep in mind that you have a limited number of revisions, so review carefully before resubmitting.`
      : 'Your application was reviewed but could not be accepted at this time. Please review your application and resubmit within 72 hours. Keep in mind that you have a limited number of revisions, so review carefully before resubmitting.',
    type: 'warn'
  });

  // Email notification
  await sendNotificationEmail('rejected', activeApplicant);

  closeModal();
  await loadAllData();
}

// =============================================
// Filter tabs
// =============================================
function applyFilter(filter) {
  currentFilter = filter;
  const filtered = filter === 'all'
    ? allApplicants
    : allApplicants.filter(a => (a.app.application_status || 'draft') === filter);
  renderApplicantsTable(filtered);
}

// =============================================
// Bind all events
// =============================================
function bindEvents() {
  // Sidebar nav
  document.querySelectorAll('#adminNav a').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const view = link.dataset.view;
      document.querySelectorAll('#adminNav a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(`view-${view}`)?.classList.add('active');
    });
  });

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      applyFilter(tab.dataset.filter);
    });
  });

  // Modal close
  document.getElementById('modalClose').onclick  = closeModal;
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  // Reject confirm/cancel
  document.getElementById('btnRejectConfirm').onclick = confirmReject;
  document.getElementById('btnRejectCancel').onclick  = () => {
    document.getElementById('rejectReason').style.display = 'none';
  };

  // Logout
 document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut({ scope: 'local' });
  Object.keys(localStorage)
    .filter(k => k.startsWith('sb-'))
    .forEach(k => localStorage.removeItem(k));
  window.location.replace('login.html');
});
}

// =============================================
// Helpers
// =============================================
function fullName(a) {
  return `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email || 'Unknown';
}

function statusPill(status) {
  const labels = { draft: 'Incomplete', in_review: 'In Review', approved: 'Approved', rejected: 'Rejected' };
  return `<span class="status-pill ${status || 'draft'}">${labels[status] || 'Incomplete'}</span>`;
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}
