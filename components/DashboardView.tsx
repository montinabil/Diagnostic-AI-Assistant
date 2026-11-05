
import React, { useRef, useState } from 'react';
import { View, CaseRecord } from '../types';
import { IconActivity, IconUpload, IconBook, IconXRay, IconShield, IconLock, IconUser, IconKey } from './Icons';
import { XRayAnalysisSection } from './XRayAnalysisSection';
import { useAuth } from '../services/authContext';
import { AuthModal, AuthMode } from './AuthModal';

interface DashboardProps {
  onNavigate: (view: View) => void;
  recentCases: CaseRecord[];
  onViewCase: (caseRecord: CaseRecord) => void;
  onSaveCase?: (caseRecord: CaseRecord) => void;
}

export const DashboardView: React.FC<DashboardProps> = ({ onNavigate, recentCases, onViewCase, onSaveCase }) => {
  const xraySectionRef = useRef<HTMLDivElement>(null);
  const { user, userProfile } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  const scrollToXRay = () => {
    xraySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <div className="p-8 bg-slate-50 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Clinician Welcome or Auth Prompt Card */}
        {user ? (
          <div className="bg-gradient-to-r from-medical-900 via-slate-900 to-medical-800 text-white rounded-2xl p-5 shadow-sm border border-medical-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-cyan-300 font-bold text-lg">
                {(userProfile?.displayName || user.displayName || 'Dr')[0]?.toUpperCase() || 'D'}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-white">
                    Welcome back, {userProfile?.displayName || user.displayName || 'Clinician'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Cloud Synced
                  </span>
                </div>
                <p className="text-xs text-medical-200 mt-0.5">
                  {userProfile?.specialty || 'Diagnostic Specialist'} &bull; {user.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuth('reset')}
                className="px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition flex items-center space-x-1.5"
              >
                <IconKey className="w-3.5 h-3.5 text-cyan-300" />
                <span>Security / Reset</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-xl bg-medical-50 text-medical-700 border border-medical-200 flex items-center justify-center flex-shrink-0">
                <IconShield className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-slate-900">Clinician Account Authentication</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                    Encrypted Cloud
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sign in or register to securely store, synchronize, and retrieve patient imaging cases and ACR reports across devices.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => openAuth('login')}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-medical-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center space-x-1.5"
              >
                <IconLock className="w-3.5 h-3.5 text-slate-500" />
                <span>Sign In</span>
              </button>
              <button
                onClick={() => openAuth('register')}
                className="px-3.5 py-1.5 text-xs font-semibold bg-medical-700 hover:bg-medical-800 text-white rounded-lg shadow-sm transition flex items-center space-x-1.5"
              >
                <IconUser className="w-3.5 h-3.5" />
                <span>Register</span>
              </button>
              <button
                onClick={() => openAuth('reset')}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition"
                title="Forgot Password"
              >
                Forgot Password?
              </button>
            </div>
          </div>
        )}

        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">UltraVision AI Diagnostic Studio</h1>
            <p className="text-slate-500 mt-1">Multi-modal AI assistance for Ultrasound sonography and Plain Radiography (X-Ray)</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Gemini 3.8 Flash Active
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
              Grounding & Deep Thinking
            </span>
          </div>
        </header>

        {/* Auth Modal for Quick Access */}
        <AuthModal
          isOpen={authModalOpen}
          initialMode={authMode}
          onClose={() => setAuthModalOpen(false)}
          allowDismiss={true}
        />


        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Ultrasound Scan */}
          <button 
            onClick={() => onNavigate(View.ANALYZE)}
            className="group bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-medical-400 hover:shadow-md transition-all text-left flex flex-col justify-between"
          >
            <div>
              <div className="bg-medical-100 w-11 h-11 rounded-xl flex items-center justify-center text-medical-600 mb-3 group-hover:scale-105 transition-transform">
                <IconUpload />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">Ultrasound Scan</h3>
              <p className="text-slate-500 text-xs">Cine-loop video or multi-frame abdominal & vascular sonography analysis.</p>
            </div>
            <span className="text-xs font-semibold text-medical-600 mt-4 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Launch scan &rarr;
            </span>
          </button>

          {/* X-Ray Radiography */}
          <button 
            onClick={scrollToXRay}
            className="group bg-gradient-to-br from-slate-900 to-medical-950 p-5 rounded-2xl shadow-sm border border-slate-800 hover:border-cyan-400 hover:shadow-md transition-all text-left flex flex-col justify-between text-white"
          >
            <div>
              <div className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <IconXRay className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-white">X-Ray Analysis</h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-400 text-slate-900 uppercase">New</span>
              </div>
              <p className="text-slate-300 text-xs">Chest, skeletal, abdominal & trauma radiographs with ACR report generation.</p>
            </div>
            <span className="text-xs font-semibold text-cyan-300 mt-4 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Analyze radiograph &darr;
            </span>
          </button>

          {/* Consult AI */}
          <button 
            onClick={() => onNavigate(View.CHAT)}
            className="group bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-purple-400 hover:shadow-md transition-all text-left flex flex-col justify-between"
          >
            <div>
              <div className="bg-purple-100 w-11 h-11 rounded-xl flex items-center justify-center text-purple-600 mb-3 group-hover:scale-105 transition-transform">
                <IconActivity />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">Consult AI</h3>
              <p className="text-slate-500 text-xs">Complex differential diagnoses, clinical guidelines, and deep reasoning.</p>
            </div>
            <span className="text-xs font-semibold text-purple-600 mt-4 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Open chat &rarr;
            </span>
          </button>

          {/* Medical Resources */}
          <button 
            onClick={() => onNavigate(View.RESOURCES)}
            className="group bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all text-left flex flex-col justify-between"
          >
            <div>
              <div className="bg-teal-100 w-11 h-11 rounded-xl flex items-center justify-center text-teal-600 mb-3 group-hover:scale-105 transition-transform">
                <IconBook />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">Reference Library</h3>
              <p className="text-slate-500 text-xs">Sonography textbooks, normal measurement criteria, and protocols.</p>
            </div>
            <span className="text-xs font-semibold text-teal-600 mt-4 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Browse docs &rarr;
            </span>
          </button>
        </div>

        {/* X-Ray Radiography Analysis Section */}
        <div ref={xraySectionRef} className="pt-2">
          <XRayAnalysisSection onCaseSaved={onSaveCase} onViewCase={onViewCase} />
        </div>

        {/* Recent Activity Table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Recent Diagnostic Activity</h2>
              <p className="text-xs text-slate-500">Historical records of analyzed cases and generated reports</p>
            </div>
            {recentCases.length > 0 && (
              <span className="text-xs font-medium text-slate-500">
                {recentCases.length} {recentCases.length === 1 ? 'case' : 'cases'} recorded
              </span>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {recentCases.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                <p className="text-base font-medium text-slate-700">No recent analysis activity yet.</p>
                <p className="text-xs text-slate-400 mt-1">Upload an X-ray above or start an ultrasound scan to generate your first professional clinical report.</p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button 
                    onClick={scrollToXRay}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Analyze X-Ray Above
                  </button>
                  <button 
                    onClick={() => onNavigate(View.ANALYZE)}
                    className="px-4 py-2 bg-medical-50 hover:bg-medical-100 text-medical-700 border border-medical-200 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Start Ultrasound Scan
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-800 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-4">Case ID</th>
                      <th className="p-4">Modality / Type</th>
                      <th className="p-4">Clinical Indication / Summary</th>
                      <th className="p-4">Date</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCases.map((record) => (
                      <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 font-mono text-xs font-semibold text-slate-700">{record.id}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold uppercase ${
                            record.type === 'xray' || record.modality === 'xray'
                              ? 'bg-slate-900 text-cyan-300 border border-cyan-800/60' :
                            record.type === 'video'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                            record.type === 'mixed'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                              'bg-sky-50 text-sky-700 border border-sky-200'
                          }`}>
                            {record.type === 'xray' || record.modality === 'xray' ? (
                              <>
                                <IconXRay className="w-3 h-3 text-cyan-400" />
                                X-Ray
                              </>
                            ) : (
                              record.type
                            )}
                          </span>
                        </td>
                        <td className="p-4 max-w-md truncate" title={record.description}>
                          <span className="text-slate-800 font-medium">{record.description || "No clinical description provided"}</span>
                        </td>
                        <td className="p-4 text-xs text-slate-500 whitespace-nowrap">{record.date}</td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => onViewCase(record)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-medical-700 hover:text-medical-800 hover:bg-medical-50 transition-colors"
                          >
                            View & Export Report &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
