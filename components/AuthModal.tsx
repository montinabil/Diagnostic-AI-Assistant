import React, { useState } from 'react';
import { useAuth } from '../services/authContext';
import {
  IconLock,
  IconMail,
  IconKey,
  IconShield,
  IconEye,
  IconEyeOff,
  IconCheckCircle,
  IconAlert,
  IconGoogle,
  IconRefresh
} from './Icons';

export type AuthMode = 'login' | 'register' | 'reset';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  initialMode?: AuthMode;
  allowDismiss?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  allowDismiss = true
}) => {
  const { login, register, loginWithGoogle, resetPassword, formatAuthError } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [specialty, setSpecialty] = useState('Diagnostic Radiology');
  const [institution, setInstitution] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSentEmail, setResetSentEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  if (!isOpen) return null;

  // Password strength calculation
  const calculatePasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 6) score += 25;
    if (pass.length >= 10) score += 25;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 25;
    if (/[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score += 25;
    return score;
  };

  const passScore = calculatePasswordStrength(password);
  const getStrengthLabel = () => {
    if (password.length === 0) return '';
    if (passScore < 50) return 'Weak (Add letters, numbers & symbols)';
    if (passScore < 100) return 'Moderate (Good for clinical use)';
    return 'Strong (Meets high clinical standards)';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      if (onClose) onClose();
    } catch (err) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Please enter email and a secure password.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter your password.');
      return;
    }

    if (!termsAccepted) {
      setErrorMsg('Please confirm your clinical practice agreement to proceed.');
      return;
    }

    setIsLoading(true);
    try {
      await register(
        email,
        password,
        displayName.trim() || (email.split('@')[0]),
        specialty,
        institution.trim() || 'Medical Imaging Department'
      );
      if (onClose) onClose();
    } catch (err) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await loginWithGoogle();
      if (onClose) onClose();
    } catch (err) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim()) {
      setErrorMsg('Please enter your account email address.');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(email);
      setResetSentEmail(email.trim());
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-medical-900 via-slate-900 to-medical-800 text-white p-6 relative">
          {allowDismiss && onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}

          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-medical-500/20 border border-medical-400/30 flex items-center justify-center text-medical-300">
              <IconShield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">UltraVision Clinical Auth</h2>
              <p className="text-xs text-medical-200">Secure Medical Imaging & Diagnostic Intelligence</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-medical-300 bg-black/25 px-2.5 py-1 rounded-md mt-3 w-fit border border-medical-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Zero-Trust ABAC Security &bull; End-to-End Encryption</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/75 px-6 pt-2">
          <button
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            className={`pb-3 pt-2 text-sm font-semibold border-b-2 px-3 transition-colors ${
              mode === 'login'
                ? 'border-medical-600 text-medical-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            className={`pb-3 pt-2 text-sm font-semibold border-b-2 px-3 transition-colors ${
              mode === 'register'
                ? 'border-medical-600 text-medical-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Register Clinician
          </button>
          <button
            onClick={() => {
              setMode('reset');
              setErrorMsg(null);
            }}
            className={`pb-3 pt-2 text-sm font-semibold border-b-2 px-3 transition-colors ${
              mode === 'reset'
                ? 'border-medical-600 text-medical-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Reset Password
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2.5 animate-shake">
              <IconAlert className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span className="font-semibold block mb-0.5">Authentication Notice</span>
                {errorMsg}
              </div>
            </div>
          )}

          {/* MODE: LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Clinician Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <IconMail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@hospital.org"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setErrorMsg(null);
                    }}
                    className="text-xs text-medical-600 hover:text-medical-800 font-medium transition"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <IconLock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-medical-700 hover:bg-medical-800 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <IconLock className="w-4 h-4" />
                    <span>Secure Sign In</span>
                  </>
                )}
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 font-medium">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-lg shadow-sm transition flex items-center justify-center space-x-2.5 disabled:opacity-60"
              >
                <IconGoogle className="w-4 h-4" />
                <span>Google Workspace Sign In</span>
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-slate-500">Need a clinical account? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg(null);
                  }}
                  className="text-xs text-medical-600 hover:text-medical-800 font-semibold"
                >
                  Create one now
                </button>
              </div>
            </form>
          )}

          {/* MODE: REGISTER */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Clinician Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Dr. Alex Morgan, MD"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Primary Specialty
                  </label>
                  <select
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent transition"
                  >
                    <option value="Diagnostic Radiology">Diagnostic Radiology</option>
                    <option value="Emergency Medicine">Emergency Medicine</option>
                    <option value="Ultrasound / Sonography">Ultrasound / Sonography</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Obstetrics & Gynecology">Obstetrics & Gynecology</option>
                    <option value="Internal Medicine">Internal Medicine</option>
                    <option value="Pulmonology">Pulmonology</option>
                    <option value="Resident / Fellow">Resident / Fellow</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Hospital / Clinical Affiliation
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="St. Jude Diagnostic Hospital"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Clinical Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <IconMail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex.morgan@healthsystem.org"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Create Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <IconLock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 chars with letters & numbers"
                    className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password strength meter */}
                {password.length > 0 && (
                  <div className="mt-1.5">
                    <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          passScore < 50
                            ? 'bg-amber-500 w-1/3'
                            : passScore < 100
                            ? 'bg-medical-500 w-2/3'
                            : 'bg-emerald-500 w-full'
                        }`}
                      ></div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 flex justify-between">
                      <span>{getStrengthLabel()}</span>
                      <span className="font-mono">{passScore}%</span>
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <IconKey className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className={`w-full pl-9 pr-10 py-2 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-medical-500 transition ${
                      confirmPassword && confirmPassword !== password
                        ? 'border-rose-400 bg-rose-50/30'
                        : 'border-slate-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-start space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="clinical-terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-medical-600 focus:ring-medical-500"
                />
                <label htmlFor="clinical-terms" className="text-xs text-slate-600 leading-snug">
                  I confirm that I am a medical professional using this diagnostic intelligence system in compliance with institutional patient safety and data privacy protocols.
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-medical-700 hover:bg-medical-800 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Creating Clinician Account...</span>
                  </>
                ) : (
                  <>
                    <IconCheckCircle className="w-4 h-4" />
                    <span>Register & Access Platform</span>
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <span className="text-xs text-slate-500">Already registered? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                  }}
                  className="text-xs text-medical-600 hover:text-medical-800 font-semibold"
                >
                  Sign in here
                </button>
              </div>
            </form>
          )}

          {/* MODE: RESET PASSWORD */}
          {mode === 'reset' && (
            <div className="space-y-4">
              {resetSentEmail ? (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center space-x-3 text-emerald-800">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <IconCheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">Password Reset Email Dispatched</h4>
                      <p className="text-xs text-emerald-700">Instructions sent to your clinical inbox</p>
                    </div>
                  </div>

                  <p className="text-xs text-emerald-900 leading-relaxed bg-white/70 p-3 rounded-lg border border-emerald-100">
                    We have dispatched a secure password reset link to <strong className="font-semibold">{resetSentEmail}</strong>. Please check your inbox and follow the link to choose a new password. If you don't see it within a couple minutes, verify your spam folder.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || isLoading}
                      onClick={handlePasswordReset}
                      className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg border border-emerald-300 text-emerald-800 bg-emerald-100/60 hover:bg-emerald-100 transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
                    >
                      <IconRefresh className="w-3.5 h-3.5" />
                      <span>
                        {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend Email'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setResetSentEmail(null);
                        setErrorMsg(null);
                      }}
                      className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg bg-medical-700 text-white hover:bg-medical-800 transition text-center"
                    >
                      Return to Sign In
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div className="p-3.5 bg-medical-50 border border-medical-200 rounded-xl text-xs text-medical-900 leading-relaxed flex items-start space-x-2.5">
                    <IconKey className="w-4 h-4 text-medical-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block mb-0.5">Need to recover your account?</strong>
                      Enter your clinical registration email. A cryptographically signed password reset link will be sent directly to your inbox.
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                      Registered Clinician Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <IconMail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="doctor@hospital.org"
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-medical-700 hover:bg-medical-800 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Sending Reset Instructions...</span>
                      </>
                    ) : (
                      <>
                        <IconMail className="w-4 h-4" />
                        <span>Send Password Reset Link</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setErrorMsg(null);
                      }}
                      className="text-xs text-slate-600 hover:text-slate-900 font-semibold"
                    >
                      &larr; Back to Secure Sign In
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>Encrypted with TLS 1.3 &bull; Firebase Auth</span>
          {allowDismiss && onClose && (
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 underline"
            >
              Explore Demo Mode
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
