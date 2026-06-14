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

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('first_name, last_name, is_admin')
    .eq('user_id', session.user.id)
    .single();

  if (!profile?.is_admin) {
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
  // First get profiles
  const { data: profiles, error: profileError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('is_admin', false)
    .order('created_at', { ascending: false });

  if (profileError) {
    console.error('Profile load error:', profileError);
    return;
  }

  // Then get all applications
 const { data: applications } = await supabaseClient
    .from('applications')
    .select('*')
    .in('user_id', userIds);

  const { data: payments } = await supabaseClient
    .from('payment_info')
    .select('*')
    .in('user_id', userIds);

  // Merge all three
  allApplicants = profiles.map(profile => ({
    ...profile,
    app:     applications?.find(a => a.user_id === profile.user_id) || {},
    payment: payments?.find(p => p.user_id === profile.user_id) || null
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
// Admin card navigation
// =============================================
function adminNavigate(view, filter) {
  document.querySelectorAll('#adminNav a').forEach(l => l.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  const link = document.querySelector(`#adminNav a[data-view="${view}"]`);
  if (link) link.classList.add('active');
  document.getElementById(`view-${view}`)?.classList.add('active');

  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  const tab = document.querySelector(`.filter-tab[data-filter="${filter}"]`);
  if (tab) tab.classList.add('active');
  applyFilter(filter);
}

// =============================================
// Recent table
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
// Applicants table
// =============================================
function renderApplicantsTable(list) {
  const tbody = document.getElementById('applicantsTable');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#a0aec0;padding:30px;">No applicants found</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(a => {
    const steps = [a.app.profile_complete, a.app.identity_complete, a.app.payment_complete];
    const done  = steps.filter(Boolean).length;
    const pct   = Math.round((done / 3) * 100);
    return `
      <tr onclick="openModal('${a.user_id}')">
        <td><strong>${fullName(a)}</strong></td>
        <td>${a.country || '—'}</td>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${a.app.selected_opportunity || '—'}
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="progress-mini">
              <div class="progress-mini-fill" style="width:${pct}%"></div>
            </div>
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

 document.getElementById('modalDetails').innerHTML = [
    ['Email',          a.email],
    ['Country',        a.country],
    ['City',           a.city],
    ['Phone',          a.phone_number],
    ['Education',      a.education_level],
    ['Employment',     a.employment_status],
    ['Equipment',      a.available_equipment],
    ['Languages',      a.additional_languages || 'None'],
    ['Referral',       a.referral_code || 'None'],
    ['Opportunity',    a.app.selected_opportunity || 'Not selected'],
    ['Joined',         formatDate(a.created_at)],
    ['Last Update',    formatDate(a.app.updated_at)],
    // ── Payment info ──
    ['Bank Name',      a.payment?.bank_name || '—'],
    ['Account Holder', a.payment?.account_holder || '—'],
    ['Account No.',    a.payment?.account_number || '—'],
    ['Routing/SWIFT',  a.payment?.routing_swift || '—'],
    ['SSN / TIN',      a.payment?.ssn_tin || '—'],
  ].map(([label, val]) => `
    <div class="detail-item">
      <label>${label}</label>
      <span>${val || '—'}</span>
    </div>`).join('');

  document.getElementById('modalChecklist').innerHTML = [
    ['Profile',     a.app.profile_complete],
    ['Identity',    a.app.identity_complete],
    ['Payment',     a.app.payment_complete],
    ['Opportunity', a.app.opportunity_selected],
  ].map(([label, done]) => `
    <div style="display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;
      font-size:.8rem;font-weight:600;
      background:${done ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.08)'};
      color:${done ? '#16a34a' : '#ef4444'};">
      ${done ? '✓' : '✗'} ${label}
    </div>`).join('');

  // Documents section
  loadApplicantDocuments(a.user_id);

  const status  = a.app.application_status;
  const actions = document.getElementById('modalActions');

  if (status === 'approved' || status === 'rejected') {
    actions.innerHTML = `
      <div style="font-size:.88rem;color:#8a95ab;padding:8px 0;">
        This application has already been <strong>${status}</strong>.
      </div>
      <button class="btn-neutral" id="modalClose2">Close</button>`;
    document.getElementById('modalClose2').onclick = closeModal;
  } else {
    actions.innerHTML = `
      <button class="btn-approve" id="btnApprove">✓ Approve</button>
      <button class="btn-reject"  id="btnRejectToggle">✕ Reject</button>
      <button class="btn-neutral" id="modalClose2">Cancel</button>`;
    document.getElementById('btnApprove').onclick      = approveApplicant;
    document.getElementById('btnRejectToggle').onclick = toggleRejectReason;
    document.getElementById('modalClose2').onclick     = closeModal;
  }

  document.getElementById('rejectReason').style.display = 'none';
  document.getElementById('rejectMessage').value        = '';
  document.getElementById('modalOverlay').classList.add('open');
}

// =============================================
// Load applicant documents from Storage
// =============================================
async function loadApplicantDocuments(userId) {
  const docsEl = document.getElementById('modalDocuments');
  if (!docsEl) return;

  docsEl.innerHTML = '<div style="color:#a0aec0;font-size:.82rem;">Loading documents…</div>';

  const folders  = ['cv', 'identity', 'selfie'];
  const allFiles = [];

  for (const folder of folders) {
    const { data: files } = await supabaseClient.storage
      .from('documents')
      .list(`${userId}/${folder}`);

    if (files && files.length > 0) {
      for (const file of files) {
        // Use createSignedUrl instead of getPublicUrl for private buckets
        const { data: signedData } = await supabaseClient.storage
          .from('documents')
          .createSignedUrl(`${userId}/${folder}/${file.name}`, 3600); // 1 hour expiry

        if (signedData?.signedUrl) {
          allFiles.push({
            name:   file.name,
            folder: folder,
            url:    signedData.signedUrl
          });
        }
      }
    }
  }

  if (!allFiles.length) {
    docsEl.innerHTML = '<div style="color:#a0aec0;font-size:.82rem;">No documents uploaded yet.</div>';
    return;
  }

  docsEl.innerHTML = allFiles.map(f => `
    <a href="${f.url}" target="_blank" style="
      display:inline-flex;align-items:center;gap:6px;
      padding:6px 12px;border-radius:8px;
      background:rgba(19,99,198,.08);color:var(--primary);
      font-size:.8rem;font-weight:600;text-decoration:none;
      border:1px solid rgba(19,99,198,.15);margin:4px 4px 4px 0;">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
      </svg>
      ${f.folder}: ${f.name}
    </a>`).join('');
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
// Email notification
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
// Approve + Reject Applicants
// =============================================
async function approveApplicant() {
  if (!activeApplicant) return;
  const btn = document.getElementById('btnApprove');
  btn.textContent = 'Approving…';
  btn.disabled = true;

  const { error } = await supabaseClient
    .from('applications')
    .update({ 
      application_status: 'approved', 
      updated_at: new Date().toISOString() 
    })
    .eq('user_id', activeApplicant.user_id);

  if (error) {
    alert('Error: ' + error.message);
    btn.textContent = '✓ Approve';
    btn.disabled = false;
    return;
  }

  await supabaseClient.from('notifications').insert({
    user_id: activeApplicant.user_id,
    title: 'Application approved! 🎉',
    description: 'Congratulations! Your application has been reviewed and approved. Welcome to the Apex Remote Services network. Check your email for further details.',
    type: 'success'
  });

  await sendNotificationEmail('approved', activeApplicant);

  closeModal();
  showActionFeedback('✓ Application approved successfully!', '#22c55e');
}

// =============================================
// Reject
// =============================================
async function confirmReject() {
  if (!activeApplicant) return;

  const btn = document.getElementById('btnRejectConfirm');
  const reason = document.getElementById('rejectMessage').value.trim();

  btn.textContent = 'Rejecting…';
  btn.disabled = true;

  const { error } = await supabaseClient
    .from('applications')
    .update({
      application_status: 'rejected',
      updated_at: new Date().toISOString(),
      profile_complete: false,
      identity_complete: false,
      payment_complete: false,
      opportunity_selected: false
    })
    .eq('user_id', activeApplicant.user_id);

  if (error) {
    alert('Error: ' + error.message);
    btn.textContent = 'Confirm Rejection';
    btn.disabled = false;
    return;
  }

  // Improved notification with reason
  const notifDesc = reason 
    ? `Your application was not accepted. Reason from reviewer: "${reason}". Please review your documents and information carefully, then resubmit within 72 hours. You have a limited number of resubmissions.`
    : 'Your application was reviewed but could not be accepted at this time. Please review and resubmit within 72 hours.';

  await supabaseClient.from('notifications').insert({
    user_id: activeApplicant.user_id,
    title: 'Application Not Accepted',
    description: notifDesc,
    type: 'warn'
  });

  await sendNotificationEmail('rejected', activeApplicant);

  btn.textContent = '✗ Rejected';
  closeModal();
  showActionFeedback('Application rejected successfully.', '#ef4444');
}
// =============================================
// Feedback banner then reload
// =============================================
function showActionFeedback(message, color) {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed; top:80px; left:50%; transform:translateX(-50%);
    background:${color}; color:#fff; padding:16px 32px; border-radius:12px;
    font-family:'Sora',sans-serif; font-size:1rem; font-weight:600;
    box-shadow:0 10px 30px rgba(0,0,0,.25); z-index:9999;
  `;
  banner.textContent = message;
  document.body.appendChild(banner);

  setTimeout(() => {
    banner.style.opacity = '0';
    setTimeout(() => window.location.reload(), 600);
  }, 1400);
}

// =============================================
// Filter
// =============================================
function applyFilter(filter) {
  currentFilter = filter;
  const filtered = filter === 'all'
    ? allApplicants
    : allApplicants.filter(a => (a.app.application_status || 'draft') === filter);
  renderApplicantsTable(filtered);
}

// =============================================
// Bind events
// =============================================
function bindEvents() {
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

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      applyFilter(tab.dataset.filter);
    });
  });

  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  document.getElementById('btnRejectConfirm').onclick = confirmReject;
  document.getElementById('btnRejectCancel').onclick  = () => {
    document.getElementById('rejectReason').style.display = 'none';
  };

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
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
