// =============================================
// Supabase — single instance
// =============================================
const { createClient } = window.supabase;
const supabaseClient = createClient(
  'https://glwncvlpnchxcsngsuhe.supabase.co',
  'sb_publishable_D84XYOx5qE_iGSbKk0WE5g_KJf-qb1J'
);

// =============================================
// Global session
// =============================================
let currentSession = null;
let currentProfile = null;

// =============================================
// Boot
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) { window.location.replace('login.html'); return; }
  if (!session.user.email_confirmed_at) {
    await supabaseClient.auth.signOut();
    window.location.replace('login.html');
    return;
  }

  currentSession = session;

  // Load profile
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .single();

  currentProfile = profile;

  // Redirect admin away from user dashboard
  if (profile?.is_admin) {
    window.location.replace('admin.html');
    return;
  }

  // Greeting
  const displayName =
    `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
    || session.user.email;

  const hour = new Date().getHours();
  const greetWord = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  document.getElementById('timeGreet').textContent = greetWord + ',';
  document.getElementById('userGreet').textContent = displayName;

  // Pre-fill profile form with existing data
  prefillProfileForm(profile, session.user.email);

  // Load application state
  await refreshDashboard();

  // Load notifications
  await loadNotifications();
});

// =============================================
// Refresh overview cards + submit button state
// =============================================
async function refreshDashboard() {
  const { data: app } = await supabaseClient
    .from('applications')
    .select('*')
    .eq('user_id', currentSession.user.id)
    .single();

  if (!app) return;

  const profileDone   = !!app.profile_complete;
  const identityDone  = !!app.identity_complete;
  const paymentDone   = !!app.payment_complete;
  const inReview      = app.application_status === 'in_review';
  const approved      = app.application_status === 'approved';
  const rejected      = app.application_status === 'rejected';

  // Completion percentage (profile, identity, payment = 3 steps)
  // Completion percentage across all 3 steps
  const stepsTotal    = 3;
  const stepsComplete = [profileDone, identityDone, paymentDone].filter(Boolean).length;
  const pct           = Math.round((stepsComplete / stepsTotal) * 100);

  document.getElementById('ovProfileValue').textContent = pct + '%';
  document.getElementById('ovProfileSub').textContent   =
    pct === 100 ? '✓ All sections complete' :
    pct === 0   ? 'Start completing your profile' :
    `${stepsComplete} of ${stepsTotal} sections done`;

  // Overview cards
  document.getElementById('ovVerifValue').textContent    = identityDone ? 'Verified'  : 'Pending';
  document.getElementById('ovVerifSub').textContent      = identityDone ? '✓ Identity confirmed'  : 'Submit your ID docs';
  document.getElementById('ovPaymentValue').textContent  = paymentDone  ? 'Added'     : 'Not Set';
  document.getElementById('ovPaymentSub').textContent    = paymentDone  ? '✓ Payment method saved': 'Add a payment method';

  // Application status card
  if (inReview) {
    document.getElementById('ovStatusValue').textContent = 'In Review';
    document.getElementById('ovStatusSub').textContent   = 'We\'re reviewing your application';
  } else if (approved) {
    document.getElementById('ovStatusValue').textContent = 'Approved';
    document.getElementById('ovStatusSub').textContent   = '✓ Application accepted';
  } else if (rejected) {
    document.getElementById('ovStatusValue').textContent = 'Rejected';
    document.getElementById('ovStatusSub').textContent   = 'See notification for details';
  } else {
    document.getElementById('ovStatusValue').textContent = 'Not Submitted';
    document.getElementById('ovStatusSub').textContent   = 'Complete all sections to apply';
  }

  // Enable submit button only if all 3 sections done and not already submitted
  const submitBtn = document.getElementById('submitApplicationBtn');
if (submitBtn) {
  const allDone          = profileDone && identityDone && paymentDone;
  const lockedStatuses   = ['in_review', 'approved'];
  const alreadyLocked    = lockedStatuses.includes(app.application_status);

  // Rejected users CAN resubmit
  submitBtn.disabled     = !allDone || alreadyLocked;
  submitBtn.textContent  =
    app.application_status === 'approved'  ? '✓ Application Approved' :
    app.application_status === 'in_review' ? 'Application Submitted'  :
    app.application_status === 'rejected'  ? 'Resubmit Application'   :
    allDone ? 'Submit Application' : 'Complete all sections to unlock';

  submitBtn.style.opacity = alreadyLocked ? '0.6' : '1';
  submitBtn.style.cursor  = alreadyLocked ? 'not-allowed' : 'pointer';
}

  // Show in-review banner if submitted
  const reviewBanner = document.getElementById('reviewBanner');
  if (reviewBanner) {
    reviewBanner.style.display = (inReview || approved || rejected) ? 'flex' : 'none';
    if (inReview) {
      reviewBanner.innerHTML = `
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <div>
          <strong>Application under review</strong>
          <div style="font-size:.82rem;opacity:.8;margin-top:2px;">
            Our team is reviewing your submission. You'll be notified by email of the outcome.
          </div>
        </div>`;
    } else if (approved) {
      reviewBanner.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
      reviewBanner.innerHTML = `
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <div><strong>Application approved!</strong>
          <div style="font-size:.82rem;opacity:.8;margin-top:2px;">Welcome aboard. Check your email for next steps.</div>
        </div>`;
    } else if (rejected) {
      reviewBanner.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)';
      reviewBanner.innerHTML = `
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <div><strong>Application not accepted</strong>
          <div style="font-size:.82rem;opacity:.8;margin-top:2px;">Check your notifications and email for details.</div>
        </div>`;
    }
  }
}

// =============================================
// Load notifications
// =============================================
async function loadNotifications() {
  const { data: notifs } = await supabaseClient
    .from('notifications')
    .select('*')
    .eq('user_id', currentSession.user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const list  = document.getElementById('notifList');
  const badge = document.getElementById('notifBadge');
  if (!list) return;

  const unread = (notifs || []).filter(n => !n.read).length;
  if (badge) badge.textContent = unread > 0 ? `${unread} new` : 'All read';

  if (!notifs || notifs.length === 0) {
    list.innerHTML = `
      <li class="notif-item">
        <div class="notif-body">
          <div class="notif-title">No notifications yet</div>
          <div class="notif-desc">You're all caught up.</div>
        </div>
      </li>`;
    return;
  }

  list.innerHTML = notifs.map(n => `
    <li class="notif-item" style="${!n.read ? 'background:rgba(19,99,198,.04);border-radius:10px;' : ''}">
      <div class="notif-icon ${n.type}">
        ${notifIcon(n.type)}
      </div>
      <div class="notif-body">
        <div class="notif-title">${n.title}</div>
        <div class="notif-desc">${n.description || ''}</div>
        <div class="notif-time">${timeAgo(n.created_at)}</div>
      </div>
    </li>`).join('');

  // Mark all as read after viewing
  await supabaseClient
    .from('notifications')
    .update({ read: true })
    .eq('user_id', currentSession.user.id)
    .eq('read', false);
}

function notifIcon(type) {
  if (type === 'success') return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
  if (type === 'warn')    return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  return `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`;
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

// =============================================
// Insert a notification (called internally)
// =============================================
async function addNotification(title, description, type = 'info') {
  await supabaseClient.from('notifications').insert({
    user_id:     currentSession.user.id,
    title,
    description,
    type
  });
  await loadNotifications();
}

// =============================================
// Pre-fill profile form
// =============================================
function prefillProfileForm(profile, email) {
  if (!profile) return;
  const f = document.getElementById('personalForm');
  if (!f) return;
  const set = (name, val) => { if (f.elements[name] && val) f.elements[name].value = val; };
  set('full_name',  `${profile.first_name || ''} ${profile.last_name || ''}`.trim());
  set('dob',         profile.dob);
  set('gender',      profile.gender);
  set('email',       profile.email || email);
  set('address',     profile.full_address);
  set('country',     profile.country);
  set('zip',         profile.zip_code);
  set('city',        profile.city);
  set('education',   profile.education_level);
  set('employment',  profile.employment_status);
  set('languages',   profile.additional_languages);
  set('experience',  profile.experience);
  set('equipment',   profile.available_equipment);
  set('phone',       profile.phone_number);

  // Trigger state dropdown if country pre-filled
  if (profile.country) {
    document.getElementById('country')?.dispatchEvent(new Event('change'));
    setTimeout(() => set('state', profile.state), 50);
  }
}

// =============================================
// Profile form submit
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('personalForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f    = e.target;
    const btn  = f.querySelector('button[type="submit"]');
    btn.textContent = 'Saving…';
    btn.disabled    = true;

    const nameParts = (f.elements['full_name'].value || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName  = nameParts.slice(1).join(' ') || '';

    const { error } = await supabaseClient
      .from('profiles')
      .update({
        first_name:           firstName,
        last_name:            lastName,
        email:                f.elements['email'].value,
        dob:                  f.elements['dob'].value || null,
        gender:               f.elements['gender'].value,
        full_address:         f.elements['address'].value,
        country:              f.elements['country'].value,
        state:                f.elements['state'].value,
        zip_code:             f.elements['zip'].value,
        city:                 f.elements['city'].value,
        education_level:      f.elements['education'].value,
        employment_status:    f.elements['employment'].value,
        additional_languages: f.elements['languages'].value,
        experience:           f.elements['experience'].value,
        available_equipment:  f.elements['equipment'].value,
        phone_number:         f.elements['areacode'].value + f.elements['phone'].value,
        referral_code:        document.getElementById('referral_hidden').value || null,
        profile_complete:     true
      })
      .eq('user_id', currentSession.user.id);

    if (error) {
      alert('Error saving profile: ' + error.message);
    } else {
      // Mark complete in applications table
      await supabaseClient
        .from('applications')
        .update({ profile_complete: true })
        .eq('user_id', currentSession.user.id);

      await addNotification('Profile complete', 'Your profile information has been saved.', 'success');
      await refreshDashboard();

      btn.textContent = '✓ Saved!';
      setTimeout(() => { btn.textContent = 'Save Profile'; btn.disabled = false; }, 2000);
      return;
    }

    btn.textContent = 'Save Profile';
    btn.disabled    = false;
  });

  // =============================================
  // Identity form submit (step 3 button)
  // =============================================
  document.getElementById('submitIdentityBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('submitIdentityBtn');
    btn.textContent = 'Submitting…';
    btn.disabled    = true;

    const { error } = await supabaseClient
      .from('applications')
      .update({ identity_complete: true })
      .eq('user_id', currentSession.user.id);

    if (error) {
      alert('Error: ' + error.message);
      btn.textContent = 'Submit for Verification';
      btn.disabled    = false;
      return;
    }

    await addNotification('Identity submitted', 'Your identity documents have been submitted for review.', 'info');
    await refreshDashboard();
    btn.textContent = '✓ Submitted';
  });

  // =============================================
  // Payment form submit
  // =============================================
  document.getElementById('paymentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.textContent = 'Saving…';
    btn.disabled    = true;

    const { error } = await supabaseClient
      .from('applications')
      .update({ payment_complete: true })
      .eq('user_id', currentSession.user.id);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      await addNotification('Payment method saved', 'Your payment details have been recorded.', 'success');
      await refreshDashboard();
      btn.textContent = '✓ Saved!';
      setTimeout(() => { btn.textContent = 'Save Payment Details'; btn.disabled = false; }, 2000);
      return;
    }

    btn.textContent = 'Save Payment Details';
    btn.disabled    = false;
  });

  // =============================================
  // Opportunities / final submit
  // =============================================
  document.getElementById('opportunityForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const selected = e.target.elements['opportunity'].value;
    if (!selected) { alert('Please select an opportunity.'); return; }

    const btn = document.getElementById('submitApplicationBtn');
    btn.textContent = 'Submitting…';
    btn.disabled    = true;

    const { error } = await supabaseClient
      .from('applications')
      .update({
        selected_opportunity: selected,
        opportunity_selected: true,
        application_status:   'in_review',
        updated_at:           new Date().toISOString()
      })
      .eq('user_id', currentSession.user.id);

    if (error) {
      alert('Submission error: ' + error.message);
      btn.textContent = 'Submit Application';
      btn.disabled    = false;
      return;
    }

    await addNotification(
      'Application submitted',
      'Your application is now under review. We\'ll notify you by email of the outcome.',
      'info'
    );
    await refreshDashboard();
  });
});

// =============================================
// Card navigation helper
// =============================================
function navigateTo(view) {
  document.querySelectorAll('#sidebarNav a').forEach(l => l.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  const link = document.querySelector(`#sidebarNav a[data-view="${view}"]`);
  if (link) link.classList.add('active');

  const viewEl = document.getElementById(`view-${view}`);
  if (viewEl) viewEl.classList.add('active');

  // Scroll to top of content
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// Sidebar toggle
// =============================================
const sidebar   = document.getElementById('apexSidebar');
const mainEl    = document.getElementById('apexMain');
const overlay   = document.getElementById('sidebarOverlay');
const toggleBtn = document.getElementById('sidebarToggle');

function isMobile() { return window.innerWidth < 769; }

toggleBtn.addEventListener('click', () => {
  if (isMobile()) {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  } else {
    sidebar.classList.toggle('collapsed');
    mainEl.classList.toggle('expanded');
  }
});

overlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
});

// =============================================
// View navigation
// =============================================
document.querySelectorAll('#sidebarNav a').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const view = link.dataset.view;
    document.querySelectorAll('#sidebarNav a').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`)?.classList.add('active');
    if (isMobile()) { sidebar.classList.remove('open'); overlay.classList.remove('show'); }
  });
});

// =============================================
// Identity sub-steps
// =============================================
function idGoTo(step) {
  [1, 2, 3].forEach(i => {
    document.getElementById(`idStep${i}`)?.classList.toggle('active', i === step);
    const pill = document.getElementById(`idPill${i}`);
    if (!pill) return;
    pill.classList.remove('active', 'done');
    if (i === step) pill.classList.add('active');
    else if (i < step) pill.classList.add('done');
  });
}

// =============================================
// Logout
// =============================================
async function logout() {
  await supabaseClient.auth.signOut({ scope: 'local' });
  // Clear all supabase keys from localStorage to prevent stale sessions
  Object.keys(localStorage)
    .filter(k => k.startsWith('sb-'))
    .forEach(k => localStorage.removeItem(k));
  window.location.replace('login.html');
}
