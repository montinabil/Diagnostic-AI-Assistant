import React, { useState } from 'react';
import { useAuth } from '../services/authContext';
import {
  IconUser,
  IconMail,
  IconShield,
  IconKey,
  IconCheckCircle,
  IconAlert,
  IconLogOut,
  IconRefresh
} from './Icons';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenResetPassword?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenResetPassword
}) => {
  const {
    user,
    userProfile,
    logout,
    updateUserProfile,
    resetPassword,
    resendVerificationEmail,
    formatAuthError
  } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(userProfile?.displayName || user?.displayName || '');
  const [specialty, setSpecialty] = useState(userProfile?.specialty || 'Diagnostic Radiology');
  const [institution, setInstitution] = useState(userProfile?.institution || 'Medical Center');
  
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);

  if (!isOpen || !user) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    try {
      await updateUserProfile({
        displayName: displayName.trim(),
        specialty: specialty.trim(),
        institution: institution.trim()
      });
      setIsEditing(false);
      setStatusMessage({ text: 'Clinician profile updated successfully.', type: 'success' });
    } catch (err) {
      setStatusMessage({ text: formatAuthError(err), type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user.email) return;
    setIsSendingReset(true);
    setStatusMessage(null);
    try {
      await resetPassword(user.email);
      setStatusMessage({
        text: `Password reset email dispatched to ${user.email}. Check your inbox to change your password.`,
        type: 'success'
      });
    } catch (err) {
      setStatusMessage({ text: formatAuthError(err), type: 'error' });
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleSendVerification = async () => {
    setIsSendingVerification(true);
    setStatusMessage(null);
    try {
      await resendVerificationEmail();
      setStatusMessage({
        text: 'Verification email has been dispatched. Please check your inbox.',
        type: 'success'
      });
    } catch (err) {
      setStatusMessage({ text: formatAuthError(err), type: 'error' });
    } finally {
      setIsSendingVerification(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      onClose();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const initials = (displayName || user.email || 'Dr')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-medical-900 to-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-medical-500/20 border-2 border-medical-400/40 flex items-center justify-center text-medical-200 text-xl font-bold tracking-wider shadow-inner">
              {initials || 'MD'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white">{displayName || 'Clinician'}</h3>
                {user.emailVerified && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <IconCheckCircle className="w-3 h-3 mr-1" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-medical-200">{specialty}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{institution}</p>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs flex items-start space-x-2 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <IconCheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <IconAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">{statusMessage.text}</div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Account Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <IconUser className="w-3.5 h-3.5 text-medical-600" />
                <span>Clinician Profile Info</span>
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs font-semibold text-medical-600 hover:text-medical-800"
              >
                {isEditing ? 'Cancel Edit' : 'Edit Credentials'}
              </button>
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Display Name / Title
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Medical Specialty
                  </label>
                  <input
                    type="text"
                    required
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Hospital / Affiliated Health System
                  </label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-500 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-1.5 text-xs font-semibold bg-medical-700 hover:bg-medical-800 text-white rounded-lg transition disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-medium text-slate-800">{user.email}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Specialty:</span>
                  <span className="font-medium text-slate-800">{specialty}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Institution:</span>
                  <span className="font-medium text-slate-800">{institution}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Practitioner UID:</span>
                  <span className="font-mono text-[10px] text-slate-600 truncate max-w-[200px]" title={user.uid}>
                    {user.uid}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Security & Password Reset Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <IconShield className="w-3.5 h-3.5 text-medical-600" />
              <span>Password & Security</span>
            </span>

            <div className="space-y-2 text-xs">
              <p className="text-slate-600 text-[11px] leading-relaxed">
                To update your password or regain access credentials, you can request an instant secure reset link sent to your registered clinical email.
              </p>
              
              <div className="pt-1">
                <button
                  type="button"
                  disabled={isSendingReset}
                  onClick={handleSendResetEmail}
                  className="w-full py-2 px-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-medium rounded-lg text-xs transition flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <IconKey className="w-3.5 h-3.5 text-medical-600" />
                  <span>{isSendingReset ? 'Sending Reset Email...' : 'Send Password Reset Email'}</span>
                </button>
              </div>

              {!user.emailVerified && (
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={isSendingVerification}
                    onClick={handleSendVerification}
                    className="w-full py-2 px-3 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800 font-medium rounded-lg text-xs transition flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    <IconMail className="w-3.5 h-3.5 text-amber-600" />
                    <span>{isSendingVerification ? 'Sending...' : 'Send Email Verification Link'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer / Logout */}
        <div className="bg-slate-100 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Logged in via Firebase Auth</span>
          <button
            type="button"
            onClick={handleLogout}
            className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5"
          >
            <IconLogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
