const { createClient } = window.supabase;
const supabaseClient = createClient(
  'https://glwncvlpnchxcsngsuhe.supabase.co',
  'sb_publishable_D84XYOx5qE_iGSbKk0WE5g_KJf-qb1J'
);

// =============================================
// Handle auth redirects from email links
// =============================================
(async () => {
  // Check if this page load came from an email link
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.replace('#', '?'));
  const type = params.get('type');
  const accessToken = params.get('access_token');

  // Password recovery link — go to reset page
  if (type === 'recovery' && accessToken) {
    window.location.replace('reset-password.html' + window.location.hash);
    return;
  }

  // Email confirmation link — let Supabase exchange the token
  if (type === 'signup' && accessToken) {
    // Supabase auto-exchanges hash tokens, just wait briefly then redirect
    await new Promise(r => setTimeout(r, 800));
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      // Clear the hash from URL cleanly
      history.replaceState(null, '', window.location.pathname);
      await redirectByRole(session);
    }
    return;
  }

  // Normal page load — clear broken tokens first
  Object.keys(localStorage)
    .filter(k => k.startsWith('sb-'))
    .forEach(k => {
      try {
        const val = JSON.parse(localStorage.getItem(k));
        if (!val || !val.access_token) localStorage.removeItem(k);
      } catch { localStorage.removeItem(k); }
    });

  // Redirect if already logged in
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user?.email_confirmed_at) {
    await redirectByRole(session);
  }
})();

async function redirectByRole(session) {
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('is_admin')
    .eq('user_id', session.user.id)
    .single();
  window.location.replace(profile?.is_admin ? 'admin.html' : 'dashboard.html');
}

// =============================================
// Tab switching
// =============================================
let currentMode = 'login';

function switchTab(mode) {
  currentMode = mode;
  const isSignup = mode === 'signup';
  document.getElementById('signupFields').style.display = isSignup ? 'grid'  : 'none';
  document.getElementById('forgotRow').style.display    = isSignup ? 'none'  : 'block';
  document.getElementById('btnText').textContent        = isSignup ? 'Create Account' : 'Sign In';
  document.getElementById('firstName').required         = isSignup;
  document.getElementById('lastName').required          = isSignup;
  document.getElementById('tabLogin').classList.toggle('tab-active',  !isSignup);
  document.getElementById('tabSignup').classList.toggle('tab-active',  isSignup);
  document.getElementById('password').value = '';
}

// =============================================
// Password visibility
// =============================================
function togglePassword() {
  const input   = document.getElementById('password');
  const icon    = document.getElementById('eyeIcon');
  const showing = input.type === 'text';
  input.type    = showing ? 'password' : 'text';
  icon.innerHTML = showing
    ? `<path stroke-linecap="round" stroke-linejoin="round"
         d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
       <path stroke-linecap="round" stroke-linejoin="round"
         d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943
            9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>`
    : `<path stroke-linecap="round" stroke-linejoin="round"
         d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7
            a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243
            M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29
            m7.532 7.532l3.29 3.29M3 3l3.59 3.59
            m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7
            a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>`;
}

// =============================================
// Form submit
// =============================================
async function handleSubmit(e) {
  e.preventDefault();
  const btn     = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const spinner = document.getElementById('btnSpinner');

  btn.disabled          = true;
  btnText.style.display = 'none';
  spinner.style.display = 'flex';

  try {
    if (currentMode === 'signup') {
      const { error } = await supabaseClient.auth.signUp({
        email:    document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
        options: {
          data: {
            first_name: document.getElementById('firstName').value.trim(),
            last_name:  document.getElementById('lastName').value.trim()
          }
        }
      });
      if (error) { alert(error.message); return; }
      alert('Signup successful! Check your email to confirm your account before signing in.');
      switchTab('login');
      return;
    }

    // LOGIN
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email:    document.getElementById('email').value.trim(),
      password: document.getElementById('password').value
    });
    if (error) { alert(error.message); return; }
    await redirectByRole(data.session);

  } catch (err) {
    console.error(err);
    alert('An unexpected error occurred. Please try again.');
  } finally {
    btn.disabled          = false;
    btnText.style.display = 'inline';
    spinner.style.display = 'none';
  }
}

// =============================================
// Forgot password
// =============================================
async function forgotPassword() {
  const email = document.getElementById('email').value.trim();
  if (!email) { alert('Please enter your email address first.'); return; }
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login.html`
  });
  if (error) { alert(error.message); return; }
  alert('Password reset email sent. Check your inbox.');
}
