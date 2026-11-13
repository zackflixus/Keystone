import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import Logo from '../../components/Logo';

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

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    if (error) setError('');
  };

  const validate = () => {
    const errs = { password: '', confirmPassword: '' };
    let valid = true;
    if (!formData.password) {
      errs.password = 'Password is required.';
      valid = false;
    } else if (formData.password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
      valid = false;
    } else if (!/\d/.test(formData.password)) {
      errs.password = 'Password must contain a number.';
      valid = false;
    }
    if (formData.password && formData.confirmPassword !== formData.password) {
      errs.confirmPassword = 'Passwords do not match.';
      valid = false;
    }
    setFieldErrors(errs);
    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError('');
    try {
      await api.post('/api/v1/auth/reset-password', { token, password: formData.password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

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
          {success ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[var(--karya-text-primary)]">Password reset</h2>
              <p className="text-[var(--karya-text-secondary)] mt-2 text-sm leading-relaxed">
                Your password has been changed. Redirecting you to sign in...
              </p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-[var(--karya-text-primary)]">Set a new password</h2>
                <p className="text-[var(--karya-text-secondary)] mt-1 text-sm">Choose a new password for your account.</p>
              </div>

              {error && (
                <div className="mb-5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl px-4 py-3.5" role="alert">
                  <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--karya-text-primary)] mb-1.5" htmlFor="password">
                    New password
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
                      autoComplete="new-password"
                      autoFocus
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--karya-text-primary)] mb-1.5" htmlFor="confirmPassword">
                    Confirm new password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={`karya-input w-full${fieldErrors.confirmPassword ? ' !border-red-400 dark:!border-red-600 focus:!ring-red-100 dark:focus:!ring-red-900/20 focus:!border-red-400' : ''}`}
                    autoComplete="new-password"
                  />
                  <FieldError message={fieldErrors.confirmPassword} />
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
                      <span>Resetting...</span>
                    </span>
                  ) : 'Reset password'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-[var(--karya-text-secondary)]">
                <Link to="/login" className="font-semibold text-karya-blue hover:underline">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
