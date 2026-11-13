import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { login, clearError } from '../../store/slices/authSlice';
import Logo from '../../components/Logo';

const INVITE_TOKEN_KEY = 'pendingInviteToken';

function friendlyLoginError(raw) {
  if (!raw) return null;
  if (raw === 'Invalid credentials' || /invalid credential|unauthorized/i.test(raw)) {
    return 'Incorrect email or password. Double-check and try again.';
  }
  if (/network error|failed to fetch|econnrefused|network request failed/i.test(raw)) {
    return 'Unable to connect. Check your internet connection and try again.';
  }
  if (/too many|rate limit/i.test(raw)) {
    return 'Too many sign-in attempts. Please wait a few minutes and try again.';
  }
  if (/timed?\s?out/i.test(raw)) {
    return 'The request timed out. Check your connection and try again.';
  }
  if (/internal server|server error|something went wrong/i.test(raw)) {
    return "We're experiencing issues right now. Please try again in a moment.";
  }
  return 'Sign-in failed. Please try again.';
}

function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      {message}
    </p>
  );
}

function Login() {
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: location.state?.email || '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [errorKey, setErrorKey] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading, error } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (error) {
      setErrorKey((k) => k + 1);
      setDismissed(false);
    }
  }, [error]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    if (error) dispatch(clearError());
  };

  const validate = () => {
    const errs = { email: '', password: '' };
    let valid = true;
    if (!formData.email.trim()) {
      errs.email = 'Email address is required.';
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = 'Please enter a valid email address.';
      valid = false;
    }
    if (!formData.password) {
      errs.password = 'Password is required.';
      valid = false;
    }
    setFieldErrors(errs);
    return valid;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    dispatch(login(formData)).then((result) => {
      const inviteToken = localStorage.getItem(INVITE_TOKEN_KEY);
      if (result.payload && !result.error && inviteToken) {
        navigate(`/invite/accept/${inviteToken}`, { replace: true });
      }
    });
  };

  const friendlyError = friendlyLoginError(error);
  const showBanner = !dismissed && !!friendlyError;

  return (
    <div className="min-h-screen flex bg-[var(--karya-bg)]">
      {/* Left panel – brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#1E1B4B] flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute top-20 left-20 w-64 h-64 bg-karya-saffron/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-karya-blue/15 rounded-full blur-3xl" />

        <div className="relative z-10 text-center max-w-sm">
          <Logo size={64} className="rounded-2xl mx-auto mb-6 shadow-2xl" />
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Your work, <br />organized.
          </h1>
          <p className="text-white/60 text-base leading-relaxed">
            Manage projects, track tasks, and collaborate with your team — all in one place.
          </p>

          <div className="mt-10 space-y-3 text-left">
            {[
              'Kanban boards & list views',
              'Real-time collaboration',
              'Task assignments & due dates',
            ].map((f) => (
              <div key={f} className="flex items-center space-x-3">
                <div className="w-5 h-5 rounded-full bg-karya-saffron/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-karya-saffron" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-white/70 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center space-x-3 mb-8">
          <Logo size={40} className="rounded-xl shadow" />
          <span className="text-xl font-bold text-[var(--karya-text-primary)]">Keystone</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[var(--karya-text-primary)]">Welcome back</h2>
            <p className="text-[var(--karya-text-secondary)] mt-1 text-sm">Sign in to your account</p>
          </div>

          {showBanner && (
            <div
              key={errorKey}
              className="animate-shake mb-5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl px-4 py-3.5"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/60 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="flex-1 text-sm text-red-700 dark:text-red-300 leading-relaxed">
                  {friendlyError}
                </p>
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  className="flex-shrink-0 p-0.5 rounded text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors -mt-0.5 -mr-1"
                  aria-label="Dismiss error"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--karya-text-primary)] mb-1.5" htmlFor="email">
                Email address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className={`karya-input w-full${fieldErrors.email ? ' !border-red-400 dark:!border-red-600 focus:!ring-red-100 dark:focus:!ring-red-900/20 focus:!border-red-400' : ''}`}
                autoComplete="email"
              />
              <FieldError message={fieldErrors.email} />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--karya-text-primary)] mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`karya-input w-full pr-10${fieldErrors.password ? ' !border-red-400 dark:!border-red-600 focus:!ring-red-100 dark:focus:!ring-red-900/20 focus:!border-red-400' : ''}`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-[var(--karya-text-secondary)] hover:text-[var(--karya-text-primary)] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <FieldError message={fieldErrors.password} />
              <div className="text-right mt-1.5">
                <Link to="/forgot-password" className="text-xs font-medium text-karya-blue hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full karya-button-primary py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center space-x-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Signing in...</span>
                </span>
              ) : 'Continue'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--karya-text-secondary)]">
            Don't have an account?{' '}
            <Link to="/register" state={location.state} className="font-semibold text-karya-blue hover:underline">
              Sign up for free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
