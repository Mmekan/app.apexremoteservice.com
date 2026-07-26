const { createClient } = window.supabase;
const supabaseClient = createClient(
  'https://glwncvlpnchxcsngsuhe.supabase.co',
  'sb_publishable_D84XYOx5qE_iGSbKk0WE5g_KJf-qb1J'
);

function showToast(message, type = 'info') {
  const colors = {
    info:    'linear-gradient(135deg, #1363C6, #15ACE1)',
    success: 'linear-gradient(135deg, #22c55e, #16a34a)',
    warn:    'linear-gradient(135deg, #ef4444, #dc2626)'
  };

  const icons = {
    info:    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
    success: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
    warn:    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  };

  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%) translateY(-10px);
    background: ${colors[type] || colors.info};
    color: #fff;
    padding: 14px 20px;
    border-radius: 14px;
    font-family: 'Inter', sans-serif;
    font-size: 0.88rem;
    font-weight: 600;
    box-shadow: 0 12px 32px rgba(0,0,0,.2);
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 10px;
    width: max-content;
    max-width: calc(100vw - 32px);
    opacity: 0;
    transition: all 0.3s ease;
  `;
  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// =============================================
// Handle auth redirects from email links
// =============================================
(async () => {
  const hash = window.location.hash;
  
  // Handle password recovery redirect
  if (hash.includes('type=recovery')) {
    window.location.replace('reset-password.html' + hash);
    return;
  }

  // Handle email confirmation
  if (hash.includes('type=signup') || hash.includes('access_token')) {
    await new Promise(r => setTimeout(r, 1000)); // Give Supabase time to process
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      history.replaceState(null, '', window.location.pathname); // Clean URL
      await redirectByRole(session);
    }
    return;
  }

  // Clean up bad localStorage tokens
  Object.keys(localStorage)
    .filter(k => k.startsWith('sb-'))
    .forEach(k => localStorage.removeItem(k));

  // Check if user is already logged in
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  if (session?.user?.email_confirmed_at) {
    await redirectByRole(session);
  }
})();

// =============================================
// Smart redirect based on user role
// =============================================
async function redirectByRole(session) {
  try {
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('is_admin')
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      console.error('Profile fetch error:', error);
      // Fallback: assume normal user
      window.location.replace('dashboard.html');
      return;
    }

    if (profile?.is_admin) {
      window.location.replace('admin.html');
    } else {
      window.location.replace('dashboard.html');
    }
  } catch (err) {
    console.error(err);
    window.location.replace('dashboard.html'); // Safe fallback
  }
}

// =============================================
// Tab switching
// =============================================
let currentMode = 'login';

function switchTab(mode) {
  currentMode = mode;
  const isSignup = mode === 'signup';
  
  document.getElementById('signupFields').style.display = isSignup ? 'grid' : 'none';
  document.getElementById('forgotRow').style.display = isSignup ? 'none' : 'block';
  document.getElementById('btnText').textContent = isSignup ? 'Create Account' : 'Sign In';
  
  document.getElementById('firstName').required = isSignup;
  document.getElementById('lastName').required = isSignup;

  document.getElementById('tabLogin').classList.toggle('tab-active', !isSignup);
  document.getElementById('tabSignup').classList.toggle('tab-active', isSignup);
  
  document.getElementById('password').value = '';
}

// =============================================
// Password visibility
// =============================================
function togglePassword() {
  const input = document.getElementById('password');
  const icon = document.getElementById('eyeIcon');
  const showing = input.type === 'text';
  
  input.type = showing ? 'password' : 'text';
  
  icon.innerHTML = showing
    ? `<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>`
    : `<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7 a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243 M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29 m7.532 7.532l3.29 3.29M3 3l3.59 3.59 m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7 a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>`;
}

// =============================================
// Form submit
// =============================================
async function handleSubmit(e) {
  e.preventDefault();
  
  const btn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const spinner = document.getElementById('btnSpinner');

  btn.disabled = true;
  btnText.style.display = 'none';
  spinner.style.display = 'flex';

  try {
    if (currentMode === 'signup') {
      const { error } = await supabaseClient.auth.signUp({
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
        options: {
          data: {
            first_name: document.getElementById('firstName').value.trim(),
            last_name: document.getElementById('lastName').value.trim()
          }
        }
      });

      if (error) throw error;

      showToast('Signup successful! Please check your email to confirm your account.', 'success');
      switchTab('login');
      return;
    }

    // Login
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value
    });

    if (error) throw error;

    await redirectByRole(data.session);

  } catch (err) {
    console.error(err);
    showToast(err.message || 'An error occurred. Please try again.', 'warn');
  } finally {
    btn.disabled = false;
    btnText.style.display = 'inline';
    spinner.style.display = 'none';
  }
}

// =============================================
// Forgot password
// =============================================
async function forgotPassword() {
  const email = document.getElementById('email').value.trim();
  if (!email) {
    showToast('Please enter your email address first.', 'warn');
    return;
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password.html`
  });

  if (error) {
    showToast(error.message, 'warn');
  } else {
    showToast('Password reset link has been sent to your email.', 'success');
  }
}
