import React, { useState, useEffect } from 'react';
import { View, CaseRecord } from './types';
import { DashboardView } from './components/DashboardView';
import { AnalysisView } from './components/AnalysisView';
import { ChatView } from './components/ChatView';
import { ResourcesView } from './components/ResourcesView';
import { CaseDetailView } from './components/CaseDetailView';
import { AuthModal, AuthMode } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { AuthProvider, useAuth } from './services/authContext';
import {
  fetchUserCasesFromFirestore,
  saveUserCaseToFirestore
} from './services/caseStorage';
import {
  IconActivity,
  IconBrain,
  IconBook,
  IconVideo,
  IconUser,
  IconLock,
  IconShield,
  IconKey,
  IconCheckCircle
} from './components/Icons';

const STORAGE_KEY = 'ultravision_case_history';

const INITIAL_DEMO_CASES: CaseRecord[] = [
  {
    id: "UV-9042",
    type: "image",
    preview: "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%230b1320'/%3E%3Cellipse cx='200' cy='150' rx='90' ry='60' fill='%231e293b' stroke='%2338bdf8' stroke-width='2'/%3E%3Ccircle cx='180' cy='150' r='14' fill='%23ffffff'/%3E%3Cpath d='M166 164 L150 250 L210 250 Z' fill='%230f172a' opacity='0.7'/%3E%3Ctext x='20' y='30' fill='%2338bdf8' font-family='sans-serif' font-size='12' font-weight='bold'%3ERUQ GB LONG - TRANS%3C/text%3E%3Ctext x='20' y='50' fill='%2394a3b8' font-family='sans-serif' font-size='10'%3EFast: 8 hrs | Gain: 42dB%3C/text%3E%3C/svg%3E",
    media: [
      {
        type: "image",
        preview: "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%230b1320'/%3E%3Cellipse cx='200' cy='150' rx='90' ry='60' fill='%231e293b' stroke='%2338bdf8' stroke-width='2'/%3E%3Ccircle cx='180' cy='150' r='14' fill='%23ffffff'/%3E%3Cpath d='M166 164 L150 250 L210 250 Z' fill='%230f172a' opacity='0.7'/%3E%3Ctext x='20' y='30' fill='%2338bdf8' font-family='sans-serif' font-size='12' font-weight='bold'%3ERUQ GB LONG - TRANS%3C/text%3E%3Ctext x='20' y='50' fill='%2394a3b8' font-family='sans-serif' font-size='10'%3EFast: 8 hrs | Gain: 42dB%3C/text%3E%3C/svg%3E"
      }
    ],
    description: "48-year-old female presenting with acute right upper quadrant pain radiating to the right shoulder blade, postprandial nausea, and low-grade fever. Sonographic Murphy's sign positive.",
    date: new Date().toLocaleDateString(),
    timestamp: Date.now() - 3600000,
    result: {
      timestamp: Date.now() - 3600000,
      text: `## Technical Findings
* Gallbladder: Markedly distended lumen measuring 10.4 x 4.2 cm.
* Gallbladder Wall: Diffuse, circumferential mural thickening measuring 5.2 mm (abnormal > 3 mm) with an echogenic striated bilayer appearance consistent with mural edema.
* Intraluminal Contents: An 18 mm mobile hyperechoic focus with prominent posterior acoustic shadowing located in the gallbladder neck, consistent with cholelithiasis. Moderate amount of dependent gravity-shifting biliary sludge.
* Pericholecystic Region: Demonstrates a 3 mm rim of hypoechoic pericholecystic fluid collection along the anterior body.
* Common Bile Duct (CBD): Caliber measures 4.8 mm inner-wall to inner-wall (normal < 6 mm). No evidence of choledocholithiasis or intrahepatic ductal ectasia.
* Adjacent Liver: Liver demonstrates homogeneous echogenicity without focal lesions or intrahepatic biliary radicle dilation.

## Diagnostic Impression
* Acute calculous cholecystitis with an 18 mm obstructing stone at the gallbladder neck.
* Moderate pericholecystic reactive fluid and pronounced gallbladder wall edema (5.2 mm).
* Positive sonographic Murphy's sign upon transducer compression.
* No evidence of secondary choledocholithiasis or ascending cholangitis.

## Differential Diagnosis
* Acute Acalculous Cholecystitis (unlikely given visible obstructing calculus).
* Biliary colic without complete acute cystic duct occlusion.
* Gallbladder adenomyomatosis with acute exacerbation (ruled out due to lack of intramural Rokitansky-Aschoff sinuses and comet-tail reverberation).
* Peptic ulcer disease perforation or acute pancreatitis (CBD and peripancreatic space normal).

## Recommendations
1. Urgent general surgical evaluation for laparoscopic cholecystectomy during the current admission index.
2. Maintain NPO status, initiate intravenous fluid resuscitation, and administer appropriate IV broad-spectrum antibiotics (e.g. third-generation cephalosporin).
3. Monitor serial serum bilirubin, alkaline phosphatase, and transaminases to ensure unobstructed biliary drainage.
4. If fever or pain escalates rapidly, evaluate for gangrenous changes or perforation with contrast CT.`,
      groundingChunks: [
        {
          web: {
            title: "Tokyo Guidelines 2018: Diagnostic Criteria and Severity Grading of Acute Cholecystitis",
            uri: "https://www.journalofhepato-biliary-pancreaticsciences.com"
          }
        },
        {
          web: {
            title: "Abdomen Ultrasound Imaging Reference - Sonographic Evaluation of the Gallbladder",
            uri: "https://radiopaedia.org/articles/acute-cholecystitis"
          }
        }
      ]
    }
  }
];

function MainApp() {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [caseHistory, setCaseHistory] = useState<CaseRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse cached cases', e);
    }
    return INITIAL_DEMO_CASES;
  });
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);

  // Authentication UI modals
  const { user, userProfile, loading: authLoading } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthMode>('login');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Sync cases from Firestore when user authenticates
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    fetchUserCasesFromFirestore(user.uid)
      .then((cloudCases) => {
        if (!isMounted) return;
        if (cloudCases.length > 0) {
          setCaseHistory((prev) => {
            // Merge cloud cases with local cases, deduplicating by ID
            const existingIds = new Set(cloudCases.map((c) => c.id));
            const uniqueLocal = prev.filter((c) => !existingIds.has(c.id));
            const merged = [...cloudCases, ...uniqueLocal];
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            } catch (e) {
              console.warn('Failed to cache merged cases', e);
            }
            return merged;
          });
        }
      })
      .catch((err) => {
        console.warn('Could not sync cloud cases on login', err);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleAnalysisComplete = (newCase: CaseRecord) => {
    // If authenticated, persist to user's Firestore collection
    if (user) {
      saveUserCaseToFirestore(user.uid, newCase).catch((err) => {
        console.warn('Could not save case to cloud:', err);
      });
    }

    setCaseHistory((prev) => {
      const updated = [newCase, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to persist case history', e);
      }
      return updated;
    });
  };

  const handleViewCase = (caseRecord: CaseRecord) => {
    setSelectedCase(caseRecord);
    setCurrentView(View.CASE_DETAILS);
  };

  const openAuthWithMode = (mode: AuthMode) => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const NavItem = ({ view, icon, label }: { view: View; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors w-full h-16 ${
        currentView === view
          ? 'bg-medical-700 text-white shadow-lg'
          : 'text-medical-200 hover:bg-medical-800 hover:text-white'
      }`}
    >
      {icon}
      <span className="text-[10px] uppercase font-bold mt-1 tracking-wider">{label}</span>
    </button>
  );

  const initials = (userProfile?.displayName || user?.displayName || user?.email || 'Dr')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-24 bg-medical-900 flex flex-col items-center py-6 flex-shrink-0 z-20 shadow-xl justify-between">
        <div className="w-full flex flex-col items-center">
          <div className="mb-8">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-medical-700 font-bold text-2xl shadow-inner">
              UV
            </div>
          </div>

          <nav className="w-full px-2 space-y-2">
            <NavItem view={View.DASHBOARD} icon={<IconActivity className="w-6 h-6" />} label="Home" />
            <NavItem view={View.ANALYZE} icon={<IconVideo className="w-6 h-6" />} label="Scan" />
            <NavItem view={View.CHAT} icon={<IconBrain className="w-6 h-6" />} label="AI Chat" />
            <NavItem view={View.RESOURCES} icon={<IconBook className="w-6 h-6" />} label="Docs" />
          </nav>
        </div>

        {/* User Account / Auth Widget in Sidebar Footer */}
        <div className="w-full px-2 flex flex-col items-center space-y-3">
          <div className="w-full h-px bg-medical-800"></div>

          {authLoading ? (
            <div className="w-9 h-9 rounded-full bg-medical-800/80 animate-pulse"></div>
          ) : user ? (
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="relative group p-1 rounded-xl hover:bg-medical-800 transition flex flex-col items-center"
              title={`Logged in as ${userProfile?.displayName || user.email}`}
            >
              <div className="w-10 h-10 rounded-xl bg-medical-700 border border-medical-500/40 text-white font-bold text-xs flex items-center justify-center shadow-md group-hover:border-cyan-400 transition">
                {initials || 'MD'}
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-medical-900 absolute top-0.5 right-0.5"></span>
              <span className="text-[9px] uppercase font-bold text-medical-200 mt-1 tracking-wider truncate max-w-[70px]">
                Account
              </span>
            </button>
          ) : (
            <button
              onClick={() => openAuthWithMode('login')}
              className="w-full p-2 rounded-xl bg-medical-800 hover:bg-medical-700 text-white flex flex-col items-center justify-center text-center transition shadow-sm group"
              title="Sign in or Register"
            >
              <IconLock className="w-5 h-5 text-medical-300 group-hover:text-white transition" />
              <span className="text-[9px] uppercase font-bold text-medical-200 mt-1 tracking-wider">
                Sign In
              </span>
            </button>
          )}

          <p className="text-[10px] text-medical-400 text-center">v1.2.0</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {/* Global Clinical Top Bar */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-medical-700 bg-medical-50 border border-medical-200 px-2.5 py-1 rounded-md">
              Clinical Workspace
            </span>
            <span className="text-slate-300 hidden sm:inline">&bull;</span>
            <span className="text-xs text-slate-500 hidden sm:inline">
              HIPAA Compliant &bull; Zero-Trust Data Architecture
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-2.5">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-800 leading-tight">
                    {userProfile?.displayName || user.displayName || 'Dr. Clinician'}
                  </span>
                  <span className="text-[10px] text-medical-600 font-medium">
                    {userProfile?.specialty || user.email}
                  </span>
                </div>

                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center space-x-2 py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 transition text-slate-700 text-xs font-semibold"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Profile & Security</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openAuthWithMode('login')}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-medical-700 hover:bg-slate-50 rounded-lg transition flex items-center space-x-1.5"
                >
                  <IconLock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sign In</span>
                </button>

                <button
                  onClick={() => openAuthWithMode('register')}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-medical-700 hover:bg-medical-800 text-white rounded-lg shadow-sm transition flex items-center space-x-1.5"
                >
                  <IconUser className="w-3.5 h-3.5" />
                  <span>Register</span>
                </button>

                <button
                  onClick={() => openAuthWithMode('reset')}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 hidden lg:inline-block"
                  title="Reset forgotten password"
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </div>
        </header>

        {/* View Switcher */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
          {currentView === View.DASHBOARD && (
            <DashboardView
              onNavigate={setCurrentView}
              recentCases={caseHistory}
              onViewCase={handleViewCase}
              onSaveCase={handleAnalysisComplete}
            />
          )}
          {currentView === View.ANALYZE && (
            <AnalysisView onAnalysisComplete={handleAnalysisComplete} />
          )}
          {currentView === View.CHAT && <ChatView />}
          {currentView === View.RESOURCES && <ResourcesView />}
          {currentView === View.CASE_DETAILS && selectedCase && (
            <CaseDetailView
              caseRecord={selectedCase}
              onBack={() => setCurrentView(View.DASHBOARD)}
            />
          )}
        </div>
      </main>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
        allowDismiss={true}
      />

      {/* User Profile & Security Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onOpenResetPassword={() => {
          setIsProfileModalOpen(false);
          openAuthWithMode('reset');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}