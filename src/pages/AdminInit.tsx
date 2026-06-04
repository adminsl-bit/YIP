import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

type Mode = 'idle' | 'loading' | 'needs_token' | 'done' | 'error';

const AdminInit = () => {
  const navigate = useNavigate();
  const [loginId, setLoginId]       = useState('Super_admin');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [mode, setMode]             = useState<Mode>('idle');
  const [errorMsg, setErrorMsg]     = useState('');
  const [action, setAction]         = useState<'created' | 'reset' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.'); return;
    }
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.'); return;
    }

    setMode('loading');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/setup-super-admin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ loginId: loginId.trim(), password, resetToken: resetToken.trim() || undefined }),
        }
      );

      const result = await res.json();

      if (result.requiresToken) {
        setMode('needs_token');
        return;
      }

      if (!result.success) {
        setErrorMsg(result.error || 'Something went wrong.');
        setMode('error');
        return;
      }

      setAction(result.action);
      setMode('done');
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error. Check your connection.');
      setMode('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f4f6] flex items-center justify-center px-4 py-12">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>shield_person</span>
          </div>
          <h1 className="text-2xl font-black font-headline text-on-surface tracking-tight">Super Admin Setup</h1>
          <p className="text-xs text-on-surface-variant font-medium mt-1">One-time account initialisation utility</p>
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl shadow-primary/5 p-8 border border-outline-variant/10">

          {/* ── Done ── */}
          {mode === 'done' ? (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 bg-tertiary-fixed/20 rounded-full flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-tertiary-container text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  verified_user
                </span>
              </div>
              <div>
                <h2 className="text-xl font-black font-headline text-on-surface">
                  {action === 'created' ? 'Super Admin Created' : 'Password Reset'}
                </h2>
                <p className="text-sm text-on-surface-variant font-body mt-2 leading-relaxed">
                  {action === 'created'
                    ? 'Your super admin account is ready. Use the credentials below to sign in.'
                    : 'Password updated successfully. You can now sign in with your new credentials.'}
                </p>
              </div>

              <div className="bg-surface-container rounded-2xl p-4 text-left space-y-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Login ID</p>
                  <p className="font-bold text-primary font-mono text-sm mt-0.5">{loginId.trim()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Password</p>
                  <p className="font-bold text-on-surface font-mono text-sm mt-0.5">{'•'.repeat(password.length)}</p>
                </div>
              </div>

              {action === 'created' && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-left">
                  <p className="text-[11px] text-amber-800 font-bold leading-relaxed">
                    <span className="material-symbols-outlined text-[13px] align-middle mr-1">info</span>
                    Reset token for future password changes: <span className="font-mono bg-amber-100 px-1 rounded">YIP-RESET-2026</span>
                    <br />Store this somewhere safe — you'll need it to reset the password again.
                  </p>
                </div>
              )}

              <button
                onClick={() => navigate('/login')}
                className="w-full py-3.5 bg-gradient-to-r from-primary to-primary-container text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/10 hover:scale-[1.01] transition-all"
              >
                Go to Login
              </button>
            </div>
          ) : (
            /* ── Form ── */
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Info banner */}
              <div className="bg-primary/5 rounded-xl px-4 py-3 flex gap-2">
                <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">info</span>
                <p className="text-[11px] text-on-surface-variant font-body leading-relaxed">
                  {mode === 'needs_token'
                    ? 'A super admin account already exists. Enter the reset token to update the password.'
                    : 'Creates or resets the super admin account. Only accessible from the source codebase.'}
                </p>
              </div>

              {/* Login ID */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Login ID</label>
                <input
                  type="text"
                  required
                  value={loginId}
                  onChange={e => setLoginId(e.target.value)}
                  disabled={mode === 'needs_token'}
                  className="w-full px-4 py-3.5 bg-surface-container border-none rounded-xl text-sm font-bold text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50"
                  placeholder="Super_admin"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 pr-11 bg-surface-container border-none rounded-xl text-sm font-bold text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Min 6 characters"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-[18px]">{showPw ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Confirm Password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full px-4 py-3.5 bg-surface-container border-none rounded-xl text-sm font-bold text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Repeat password"
                />
              </div>

              {/* Reset Token (shown only when super admin already exists) */}
              {mode === 'needs_token' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">
                    Reset Token <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={e => setResetToken(e.target.value)}
                    className="w-full px-4 py-3.5 bg-surface-container border border-error/20 rounded-xl text-sm font-bold font-mono text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="e.g. YIP-RESET-2026"
                  />
                </div>
              )}

              {/* Error */}
              {(mode === 'error' || errorMsg) && (
                <div className="bg-error/8 border border-error/20 rounded-xl px-4 py-3 flex items-start gap-2">
                  <span className="material-symbols-outlined text-error text-[16px] shrink-0 mt-0.5">error</span>
                  <p className="text-[12px] text-error font-bold">{errorMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={mode === 'loading'}
                className="w-full flex justify-center items-center gap-2 py-3.5 bg-gradient-to-r from-primary to-primary-container text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/10 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-70"
              >
                {mode === 'loading' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                ) : mode === 'needs_token' ? (
                  <><span className="material-symbols-outlined text-base">lock_reset</span> Reset Password</>
                ) : (
                  <><span className="material-symbols-outlined text-base">shield_person</span> Initialise Super Admin</>
                )}
              </button>

              <p className="text-center text-[10px] text-on-surface-variant/50 font-body">
                This page is not linked anywhere in the app.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminInit;
