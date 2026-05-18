// ===============================
// Initialize Supabase FIRST
// ===============================
const { createClient } = window.supabase;

const supabaseClient = createClient(
  'https://glwncvlpnchxcsngsuhe.supabase.co',
  'sb_publishable_D84XYOx5qE_iGSbKk0WE5g_KJf-qb1J'
);

// Redirect already-logged-in users
(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    // Check if already-logged-in user is admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_admin')
      .eq('user_id', session.user.id)
      .single();

    window.location.href = profile?.is_admin ? 'admin.html' : 'dashboard.html';
  }
})();

// ===============================
// Alpine Component
// ===============================
function authForm() {
  return {
    mode: 'login',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    loading: false,

    async handleSubmit() {
      this.loading = true;

      try {
        // === SIGNUP ===
        if (this.mode === 'signup') {
          const { data, error } = await supabaseClient.auth.signUp({
            email: this.email,
            password: this.password,
            options: {
              data: {
                first_name: this.firstName,
                last_name: this.lastName
              }
            }
          });

          if (error) {
            alert(error.message);
            console.error(error);
            return;
          }

          alert('Signup successful! Check your email to confirm.');
          this.mode = 'login';
          this.password = '';
          return;
        }

        // === LOGIN ===
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: this.email,
          password: this.password
        });

        if (error) {
          alert(error.message);
          return;
        }

        // Check admin status before redirecting
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('is_admin')
          .eq('user_id', data.user.id)
          .single();

        window.location.href = profile?.is_admin ? 'admin.html' : 'dashboard.html';

      } catch (err) {
        console.error(err);
        alert('An unexpected error occurred. Please try again.');
      } finally {
        this.loading = false;
      }
    },

    async forgotPassword() {
      if (!this.email) {
        alert('Please enter your email first.');
        return;
      }

      const { error } = await supabaseClient.auth.resetPasswordForEmail(
        this.email,
        { redirectTo: `${window.location.origin}/reset-password.html` }
      );

      if (error) {
        alert(error.message);
        return;
      }

      alert('Password reset email sent. Check your inbox.');
    }
  };
}