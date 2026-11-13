import { useState } from 'react';
import { Link } from 'react-router-dom';
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

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const validate = () => {
    if (!email.trim()) {
      setFieldError('Email address is required.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError('Please enter a valid email address.');
      return false;
    }
    setFieldError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError('');
    try {
      await api.post('/api/v1/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
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
          {submitted ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[var(--karya-text-primary)]">Check your email</h2>
              <p className="text-[var(--karya-text-secondary)] mt-2 text-sm leading-relaxed">
                If an account exists for <strong>{email}</strong>, we've sent a link to reset your password. The link expires in 1 hour.
              </p>
              <Link to="/login" className="inline-block mt-6 font-semibold text-karya-blue hover:underline text-sm">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-[var(--karya-text-primary)]">Forgot your password?</h2>
                <p className="text-[var(--karya-text-secondary)] mt-1 text-sm">
                  Enter your email and we'll send you a link to reset it.
                </p>
              </div>

              {error && (
                <div className="mb-5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl px-4 py-3.5" role="alert">
                  <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">{error}</p>
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
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldError) setFieldError('');
                      if (error) setError('');
                    }}
                    placeholder="you@example.com"
                    className={`karya-input w-full${fieldError ? ' !border-red-400 dark:!border-red-600 focus:!ring-red-100 dark:focus:!ring-red-900/20 focus:!border-red-400' : ''}`}
                    autoComplete="email"
                    autoFocus
                  />
                  <FieldError message={fieldError} />
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
                      <span>Sending...</span>
                    </span>
                  ) : 'Send reset link'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-[var(--karya-text-secondary)]">
                Remembered your password?{' '}
                <Link to="/login" className="font-semibold text-karya-blue hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
