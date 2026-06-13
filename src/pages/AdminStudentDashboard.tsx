import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { CivicWall } from '@/components/student/CivicWall';
import { ParliamentTree } from '@/components/student/ParliamentTree';
import { GlobalSquare } from '@/components/student/GlobalSquare';
import { AdminSpeechTracker } from '@/components/organizer/AdminSpeechTracker';
import { SessionManagement } from '@/components/organizer/SessionManagement';
import { PollManagement } from '@/components/organizer/PollManagement';
import { TimerManagement } from '@/components/organizer/TimerManagement';
import { BreakingNewsTicker } from '@/components/display/BreakingNewsTicker';
import { StudentProfile } from '@/components/student/StudentProfile';
import { QuestionHourHub } from '@/components/student/QuestionHourHub';
import { AgendaView } from '@/components/student/AgendaView';
import { StudentDocuments } from '@/components/student/StudentDocuments';
import { MotionsHub } from '@/components/student/MotionsHub';

type TabId = 'profile' | 'civic-wall' | 'tree' | 'messages' | 'speeches' | 'sessions' | 'polls' | 'timer' | 'question-hour' | 'agenda' | 'motions' | 'documents';

const navItems: { id: TabId; label: string; icon: string; exclusive?: boolean }[] = [
  { id: 'profile',       label: 'Profile',         icon: 'person' },
  { id: 'civic-wall',    label: 'Civic Wall',       icon: 'public' },
  { id: 'tree',          label: 'Parliament Tree',  icon: 'account_tree' },
  { id: 'agenda',        label: 'Agenda',           icon: 'event_seat' },
  { id: 'motions',       label: 'Motions',          icon: 'gavel' },
  { id: 'messages',      label: 'Civic Chat',       icon: 'chat' },
  { id: 'question-hour', label: 'Question Hour',    icon: 'forum', exclusive: true },
  { id: 'speeches',      label: 'Speech Tracker',   icon: 'mic', exclusive: true },
  { id: 'sessions',      label: 'Sessions',         icon: 'event_seat', exclusive: true },
  { id: 'polls',         label: 'Ballot',           icon: 'how_to_vote', exclusive: true },
  { id: 'timer',         label: 'Timer',            icon: 'timer', exclusive: true },
  { id: 'documents',     label: 'Documents',        icon: 'description' },
];

export const AdminStudentDashboard = () => {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':    return <StudentProfile isOwnProfile />;
      case 'civic-wall': return <CivicWall />;
      case 'tree':       return <ParliamentTree />;
      case 'agenda':     return <AgendaView />;
      case 'motions':    return <MotionsHub />;
      case 'question-hour': return <QuestionHourHub />;
      case 'speeches':   return <SpeechTrackerTabWrapper />;
      case 'sessions':   return <SessionsTabWrapper />;
      case 'polls':      return <PollsTabWrapper />;
      case 'timer':      return <TimerManagement />;
      case 'documents':  return <StudentDocuments />;
      default:           return <StudentProfile isOwnProfile />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F3F4F6] font-body antialiased">

      {/* ── Left Sidebar ── */}
      <aside className="hidden md:flex flex-col h-screen w-64 fixed z-50 bg-white border-r border-outline-variant py-6 px-4">
        <div className="mb-8 px-2 pt-2">
          <h1 className="font-headline font-bold text-on-surface text-lg">The Civic Canvas</h1>
          <p className="font-body text-on-surface-variant text-xs font-medium">Digital Diplomat Portal</p>
          <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest font-headline">
            <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>admin_panel_settings</span>
            Admin Student
          </span>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left ${
                activeTab === item.id
                  ? 'text-primary font-bold bg-primary/5 border-r-4 border-primary'
                  : 'text-on-surface-variant hover:bg-surface-container font-medium'
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px] shrink-0"
                style={activeTab === item.id ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span className="font-body text-sm whitespace-nowrap flex-1">{item.label}</span>
              {item.exclusive && (
                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-headline shrink-0">
                  Admin
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Signed-in user */}
        {profile && (
          <div className="px-2 pt-4 border-t border-outline-variant/20 mb-4">
            <p className="text-xs font-bold text-on-surface truncate">{profile.name}</p>
            <p className="text-[10px] text-on-surface-variant font-body">{profile.position}</p>
          </div>
        )}

        <div className="px-2">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 font-body text-on-surface-variant hover:text-error transition-colors duration-200 font-medium text-sm"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Bottom Nav ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-outline-variant md:hidden flex justify-around items-center h-16 z-50">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`p-2 transition-colors ${activeTab === item.id ? 'text-primary' : 'text-on-surface-variant'}`}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={activeTab === item.id ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
          </button>
        ))}
      </div>

      {/* ── Main Content ── */}
      <main className={`flex-1 md:ml-64 ${activeTab === 'timer' ? 'p-4 md:p-8 pb-20 md:pb-8 h-screen overflow-hidden flex flex-col' : 'p-8 pb-24 md:pb-8'}`}>
        {/* GlobalSquare always mounted, toggled via CSS — Party Wing hidden */}
        <div className={activeTab === 'messages' ? '' : 'hidden'}>
          <GlobalSquare hiddenChannels={['party']} />
        </div>
        {activeTab !== 'messages' && renderTabContent()}
      </main>

      <BreakingNewsTicker />
    </div>
  );
};

// Wrapper to give the speech tracker tab a proper page heading
const SpeechTrackerTabWrapper = () => (
  <div>
    <header className="mb-10">
      <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
        Speech <span className="text-secondary">Tracker</span>
      </h1>
      <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
        <span className="material-symbols-outlined text-[12px]">mic</span>
        Parliamentary Participation Monitor
      </p>
    </header>
    <AdminSpeechTracker />
  </div>
);

// Wrapper to give the sessions tab a proper page heading
const SessionsTabWrapper = () => (
  <div>
    <header className="mb-10">
      <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
        Parliamentary <span className="text-secondary">Sessions</span>
      </h1>
      <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
        <span className="material-symbols-outlined text-[12px]">event_seat</span>
        Agenda & Schedule Control
      </p>
    </header>
    <SessionManagement />
  </div>
);

// Wrapper to give the polls/ballot tab a proper page heading
const PollsTabWrapper = () => (
  <div>
    <header className="mb-10">
      <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
        Ballot <span className="text-secondary">Management</span>
      </h1>
      <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
        <span className="material-symbols-outlined text-[12px]">how_to_vote</span>
        Active Poll Administration
      </p>
    </header>
    <PollManagement />
  </div>
);

export default AdminStudentDashboard;
