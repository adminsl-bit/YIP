import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { EventsManager } from '@/components/superadmin/EventsManager';
import { GlobalOverview } from '@/components/superadmin/GlobalOverview';
import { SuperAdminRoleCreator } from '@/components/superadmin/SuperAdminRoleCreator';
import { EventLeaderboard } from '@/components/organizer/EventLeaderboard';
import { SecurityLogsManager } from '@/components/organizer/SecurityLogsManager';
import { SuperAdminStudentView } from '@/components/superadmin/SuperAdminStudentView';
import { SupportChatWidget } from '@/components/shared/SupportChatWidget';

type TabId = 'overview' | 'events' | 'roles' | 'students' | 'leaderboard' | 'security';

const navItems: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview',    label: 'Global Overview',     icon: 'public' },
  { id: 'events',      label: 'Events',               icon: 'event' },
  { id: 'roles',       label: 'Organizers & Roles',   icon: 'manage_accounts' },
  { id: 'students',    label: 'Students',             icon: 'group' },
  { id: 'leaderboard', label: 'Performance',          icon: 'leaderboard' },
  { id: 'security',    label: 'Security',             icon: 'security' },
];

const SuperAdminDashboard = () => {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':    return <GlobalOverview onNavigateToEvents={() => setActiveTab('events')} />;
      case 'events':      return <EventsManager />;
      case 'roles':       return <SuperAdminRoleCreator />;
      case 'students': return (
        <div className="space-y-8">
          <header>
            <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
              Students <span className="text-secondary">Directory</span>
            </h1>
            <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
              <span className="material-symbols-outlined text-[12px]">group</span>
              All Chapters · 5 Regions · City Breakdown
            </p>
          </header>
          <SuperAdminStudentView />
        </div>
      );
      case 'leaderboard': return (
        <div className="space-y-8">
          <header>
            <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
              Performance <span className="text-secondary">Leaderboard</span>
            </h1>
            <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
              <span className="material-symbols-outlined text-[12px]">leaderboard</span>
              Event Rankings & Promote to Next Round
            </p>
          </header>
          <EventLeaderboard />
        </div>
      );
      case 'security': return (
        <div className="space-y-8">
          <header>
            <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
              Security <span className="text-secondary">Monitor</span>
            </h1>
            <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
              <span className="material-symbols-outlined text-[12px]">security</span>
              Login Audit & Session Control
            </p>
          </header>
          <SecurityLogsManager />
        </div>
      );
      default: return <GlobalOverview />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F3F4F6] font-body antialiased">

      {/* ── Left Sidebar ── */}
      <aside className="hidden md:flex flex-col h-screen w-64 fixed z-50 bg-white border-r border-outline-variant py-6 px-4">
        <div className="mb-8 px-2 pt-2">
          <h1 className="font-headline font-bold text-on-surface text-lg">The Civic Canvas</h1>
          <p className="font-body text-on-surface-variant text-xs font-medium">Super Admin Portal</p>
          <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-error/10 text-error text-[10px] font-black uppercase tracking-widest font-headline">
            <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
            Super Admin
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
            </button>
          ))}
        </nav>

        {profile && (
          <div className="px-2 pt-4 border-t border-outline-variant/20 mb-4">
            <p className="text-xs font-bold text-on-surface truncate">{profile.name}</p>
            <p className="text-[10px] text-on-surface-variant font-body">Super Administrator</p>
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
      <main className="flex-1 md:ml-64 p-8 pb-24 md:pb-8">
        {renderTabContent()}
      </main>

      <SupportChatWidget />
    </div>
  );
};

export default SuperAdminDashboard;
