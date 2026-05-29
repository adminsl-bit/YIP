import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  channel: string;
  profiles: {
    name: string;
    photo_url: string | null;
    user_type: string;
    city: string;
    party_name?: string;
    position?: string;
  } | null;
}

interface Participant {
  id: string;
  name: string;
  photo_url: string | null;
  user_type: string;
  city: string;
  party_name?: string;
  position?: string;
}

type Channel = 'global' | 'party' | 'organizer';

const TABS: { id: Channel; label: string }[] = [
  { id: 'global',    label: 'Global Square' },
  { id: 'party',     label: 'Party Wing' },
  { id: 'organizer', label: 'Organizer Hub' },
];

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return `Today, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export const GlobalSquare = ({ hiddenChannels = [] }: { hiddenChannels?: Channel[] } = {}) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeProfiles, setActiveProfiles] = useState<Participant[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeChannel, setActiveChannel] = useState<Channel>('global');
  const [parties, setParties] = useState<number[]>([]);
  const [selectedParty, setSelectedParty] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleTabs = TABS.filter(t => !hiddenChannels.includes(t.id));
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRefsMap = useRef<Map<string, ReturnType<typeof supabase.channel>>>(new Map());
  const messagesCacheRef = useRef<Map<string, Message[]>>(new Map());
  const channelKeyRef = useRef('global_square');
  const presenceChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const profileRef = useRef<typeof profile>(null);

  const isOrganizer = (profile as any)?.user_type === 'organizer';
  const myPartyNumber = (profile as any)?.party_number ?? 0;

  // Load distinct party numbers from active students (organizer only)
  useEffect(() => {
    if (!isOrganizer) return;
    supabase.from('profiles')
      .select('party_number')
      .eq('user_type', 'student')
      .eq('is_active', true)
      .then(({ data }) => {
        const nums = [...new Set((data || []).map((p: any) => p.party_number).filter((n: any) => n != null))]
          .sort((a: any, b: any) => a - b) as number[];
        setParties(nums);
        setSelectedParty((prev: number | null) => prev ?? nums[0] ?? null);
      });
  }, [isOrganizer]);

  // Derive the actual channel key — only changes when the real channel changes
  const channelKey = useMemo(() => {
    if (activeChannel === 'global') return 'global_square';
    if (activeChannel === 'party') {
      const partyNum = isOrganizer ? (selectedParty ?? 0) : myPartyNumber;
      return `party_${partyNum}`;
    }
    return 'organizer_direct';
  }, [activeChannel, isOrganizer, selectedParty, myPartyNumber]);

  // Keep refs current (avoid stale closures in broadcast/presence callbacks)
  useEffect(() => { channelKeyRef.current = channelKey; }, [channelKey]);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // Presence channel — tracks who is currently online in real-time
  useEffect(() => {
    if (!user) return;

    const ch = supabase.channel('yip:presence');

    const syncPresence = () => {
      const state = ch.presenceState<{
        id: string; name: string; photo_url: string | null;
        user_type: string; city: string; party_name?: string; position?: string;
      }>();
      const seen = new Set<string>();
      const users: Participant[] = [];
      for (const presences of Object.values(state)) {
        for (const p of presences as any[]) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            users.push({ id: p.id, name: p.name, photo_url: p.photo_url, user_type: p.user_type, city: p.city, party_name: p.party_name, position: p.position });
          }
        }
      }
      setActiveProfiles(users);
    };

    ch.on('presence', { event: 'sync' }, syncPresence);

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const p = profileRef.current;
        if (p) {
          await ch.track({
            id: user.id,
            name: (p as any).name || 'Delegate',
            photo_url: (p as any).photo_url || null,
            user_type: (p as any).user_type || 'student',
            city: (p as any).city || '',
            party_name: (p as any).party_name,
            position: (p as any).position,
          });
        }
      }
    });

    presenceChRef.current = ch;
    return () => { supabase.removeChannel(ch); presenceChRef.current = null; };
  }, [user]);

  // Re-track when profile data arrives after the channel already subscribed
  useEffect(() => {
    const ch = presenceChRef.current;
    if (!ch || !user || !profile) return;
    ch.track({
      id: user.id,
      name: (profile as any).name || 'Delegate',
      photo_url: (profile as any).photo_url || null,
      user_type: (profile as any).user_type || 'student',
      city: (profile as any).city || '',
      party_name: (profile as any).party_name,
      position: (profile as any).position,
    });
  }, [profile, user]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    });
  };

  // Subscribe to a channel once and cache its messages
  const ensureSubscribed = useCallback((ck: string) => {
    if (channelRefsMap.current.has(ck)) return;
    const ch = supabase.channel(`yip:chat:${ck}`, { config: { broadcast: { self: true } } });

    ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
      const msg = payload as Message;
      const existing = messagesCacheRef.current.get(ck) || [];
      const updated = [...existing, msg];
      messagesCacheRef.current.set(ck, updated);
      if (channelKeyRef.current === ck) setMessages(updated);
    });

    ch.on('broadcast', { event: 'del' }, ({ payload }) => {
      const { id } = payload as { id: string };
      const existing = messagesCacheRef.current.get(ck) || [];
      const updated = existing.filter(m => m.id !== id);
      messagesCacheRef.current.set(ck, updated);
      if (channelKeyRef.current === ck) setMessages(updated);
    });

    ch.subscribe();
    channelRefsMap.current.set(ck, ch);
  }, []);

  // Pre-subscribe all base channels on mount so nothing is ever missed
  useEffect(() => {
    if (!user) return;
    ensureSubscribed('global_square');
    ensureSubscribed('organizer_direct');
    if (!isOrganizer && myPartyNumber) ensureSubscribed(`party_${myPartyNumber}`);

    return () => {
      channelRefsMap.current.forEach(c => supabase.removeChannel(c));
      channelRefsMap.current.clear();
      messagesCacheRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Student: subscribe to own party channel once party number is known (profile may load async)
  useEffect(() => {
    if (isOrganizer || !user || !myPartyNumber) return;
    ensureSubscribed(`party_${myPartyNumber}`);
  }, [myPartyNumber, isOrganizer, user, ensureSubscribed]);

  // Organizer: subscribe to every party channel as soon as party list loads
  useEffect(() => {
    if (!isOrganizer || !user || parties.length === 0) return;
    parties.forEach(p => ensureSubscribed(`party_${p}`));
  }, [parties, isOrganizer, user, ensureSubscribed]);

  // When the active channel changes: ensure it's subscribed, load its cached messages
  useEffect(() => {
    ensureSubscribed(channelKey);
    setMessages(messagesCacheRef.current.get(channelKey) || []);
  }, [channelKey, ensureSubscribed]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    const ch = channelRefsMap.current.get(channelKey);
    if (!ch) return;
    const text = newMessage.trim();
    setNewMessage('');

    const msg: Message = {
      id: crypto.randomUUID(),
      content: text,
      user_id: user.id,
      channel: channelKey,
      created_at: new Date().toISOString(),
      profiles: {
        name: (profile as any)?.name || 'Delegate',
        photo_url: (profile as any)?.photo_url || null,
        user_type: (profile as any)?.user_type || 'student',
        city: (profile as any)?.city || '',
        party_name: (profile as any)?.party_name,
        position: (profile as any)?.position,
      },
    };

    const result = await ch.send({ type: 'broadcast', event: 'msg', payload: msg });
    if (result !== 'ok') {
      toast.error('Failed to send message');
      setNewMessage(text);
    }
  };

  const handleDelete = async (id: string) => {
    const isOrg = (profile as any)?.user_type === 'organizer';
    const isOwn = messages.find(m => m.id === id)?.user_id === user?.id;
    if (!isOrg && !isOwn) return;
    const ch = channelRefsMap.current.get(channelKey);
    if (!ch) return;
    await ch.send({ type: 'broadcast', event: 'del', payload: { id } });
  };

  const switchChannel = (ch: Channel) => {
    setActiveChannel(ch);
    // messages loaded from cache by the channelKey effect — no clear needed
  };

  const leadership = activeProfiles.filter(p => {
    const pos = (p.position || p.user_type || '').toLowerCase();
    return pos.includes('organizer') || pos.includes('minister') || pos.includes('speaker') || pos.includes('secretary') || pos.includes('official');
  });
  const candidates = activeProfiles.filter(p => !leadership.includes(p));

  return (
    <div>
      {/* Page Heading */}
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
          Civic <span className="text-secondary">Chat Hub</span>
        </h1>
        <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
          <span className="material-symbols-outlined text-[12px]">forum</span>
          Delegate Communications Network
        </p>
      </header>

    <div className="flex flex-col bg-white overflow-hidden rounded-3xl shadow-sm border border-outline-variant/10" style={{ height: 'calc(100vh - 11rem)' }}>

      {/* ── Tab Navigation ── */}
      <div className="px-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex gap-8">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => switchChannel(tab.id)}
              className={`py-5 text-sm font-bold border-b-2 transition-all font-headline ${
                activeChannel === tab.id
                  ? 'text-primary border-primary'
                  : 'text-slate-400 hover:text-slate-600 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-400 font-medium bg-slate-50 px-3 py-1 rounded-full flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            {activeProfiles.length} Active
          </p>
        </div>
      </div>

      {/* ── Organizer: Party selector strip ── */}
      {isOrganizer && activeChannel === 'party' && parties.length > 0 && (
        <div className="px-6 py-3 bg-surface-container-low border-b border-slate-100 flex items-center gap-3 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 shrink-0 font-headline">Monitor Party:</span>
          {parties.map(partyNum => (
            <button
              key={partyNum}
              onClick={() => setSelectedParty(partyNum)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all font-headline ${
                selectedParty === partyNum
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-on-surface-variant hover:bg-primary/10 hover:text-primary border border-slate-200'
              }`}
            >
              Party {partyNum}
            </button>
          ))}
        </div>
      )}

      {/* ── Content Split ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Messages window */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F8FAFC]"
          style={{ scrollbarWidth: 'none' }}
        >
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                <span className="material-symbols-outlined text-[28px] text-slate-300">chat</span>
              </div>
              <p className="text-sm font-bold text-slate-400">No messages yet</p>
              <p className="text-xs text-slate-300 mt-1">Be the first to address the floor.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => {
                const isMe = msg.user_id === user?.id;
                const isOrg = (msg.profiles as any)?.user_type === 'organizer' || (msg.profiles as any)?.position?.toLowerCase().includes('organizer');
                const canDelete = (profile as any)?.user_type === 'organizer' || msg.user_id === user?.id;
                const showDate = idx === 0 || !isSameDay(messages[idx - 1].created_at, msg.created_at);
                const showAvatar = idx === 0 || messages[idx - 1].user_id !== msg.user_id;
                const photoUrl = (msg.profiles as any)?.photo_url;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {showDate && (
                      <div className="flex justify-center my-2">
                        <span className="px-3 py-1 rounded-full bg-slate-200/50 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          {formatDateLabel(msg.created_at)}
                        </span>
                      </div>
                    )}

                    <div className={`flex items-start gap-3 max-w-[85%] group/msg ${isMe ? 'flex-row-reverse ml-auto' : ''}`}>
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-xl mt-1 shadow-sm shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center ${!showAvatar ? 'opacity-0 pointer-events-none' : ''}`}>
                        {photoUrl
                          ? <img src={photoUrl} alt={msg.profiles?.name || ''} className="w-full h-full object-cover" />
                          : <span className="material-symbols-outlined text-[20px] text-on-surface-variant/40">person</span>}
                      </div>

                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {showAvatar && (
                          <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                            <span className={`font-bold text-sm ${isMe ? 'text-primary' : 'text-slate-800'} font-headline`}>
                              {isMe ? 'You' : (msg.profiles?.name || 'Delegate')}
                              {isOrg && !isMe && (
                                <span className="ml-2 text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Organizer</span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-400">{formatTime(msg.created_at)}</span>
                          </div>
                        )}

                        <div className={`relative p-4 rounded-2xl text-sm leading-relaxed font-body ${
                          isMe
                            ? 'bg-primary text-white rounded-tr-none shadow-md'
                            : isOrg
                            ? 'bg-amber-50 text-amber-950 rounded-tl-none border border-amber-100 shadow-sm'
                            : 'bg-white text-on-surface rounded-tl-none shadow-sm border border-slate-100'
                        }`}>
                          {msg.content}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(msg.id)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/msg:opacity-100 transition-opacity hover:bg-red-200"
                            >
                              <span className="material-symbols-outlined text-[12px]">delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
          {/* Scroll anchor — always at the very bottom of the message list */}
          <div ref={bottomRef} />
        </div>

        {/* ── Right sidebar: Active Now ── */}
        <aside className="hidden xl:flex flex-col w-72 bg-white border-l border-slate-100 p-6 overflow-y-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-headline font-extrabold text-slate-800">Active Now</h2>
            <span className="bg-blue-50 text-primary text-[10px] px-2 py-1 rounded-full font-bold">{activeProfiles.length} Total</span>
          </div>

          <div className="space-y-6">
            {leadership.length > 0 && (
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.15em] font-bold text-slate-400 mb-4">Leadership</h3>
                <div className="space-y-4">
                  {leadership.slice(0, 5).map(p => (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                          {p.photo_url
                            ? <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                            : <span className="material-symbols-outlined text-[20px] text-on-surface-variant/40">person</span>}
                        </div>
                        <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 font-headline leading-none">{p.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{p.position || p.user_type || 'Organizer'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {candidates.length > 0 && (
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.15em] font-bold text-slate-400 mb-4">Delegates</h3>
                <div className="space-y-4">
                  {candidates.slice(0, 8).map(p => (
                    <div key={p.id} className="flex items-center gap-3 opacity-80">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                        {p.photo_url
                          ? <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                          : <span className="material-symbols-outlined text-[20px] text-on-surface-variant/40">person</span>}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 font-headline leading-none">{p.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{p.city || p.party_name || 'Delegate'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto pt-6">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
                {activeChannel === 'global' ? 'Global Square' : activeChannel === 'party' ? 'Party Wing' : 'Organizer Hub'}
              </p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {activeChannel === 'global'
                  ? 'Open forum for all delegates.'
                  : activeChannel === 'party'
                  ? isOrganizer
                    ? `Monitoring Party ${selectedParty ?? '—'} wing. Switch parties above.`
                    : `Caucus channel for Party ${myPartyNumber}.`
                  : isOrganizer
                  ? 'Student messages arrive here. Reply to broadcast.'
                  : 'Direct channel to the organizing team.'}
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Input Bar ── */}
      <div className="px-6 py-4 bg-white border-t border-slate-100 shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <button type="button" className="p-2 text-slate-400 hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[20px]">attach_file</span>
          </button>
          <button type="button" className="p-2 text-slate-400 hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[20px]">emoji_emotions</span>
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                activeChannel === 'global' ? 'Broadcast to the floor…' :
                activeChannel === 'party' ? (isOrganizer ? `Message Party ${selectedParty ?? '?'} wing…` : 'Message your party caucus…') :
                isOrganizer ? 'Reply to delegates…' : 'Message the organizers…'
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-5 pr-14 focus:ring-2 focus:ring-primary/20 focus:bg-white focus:border-primary transition-all text-sm font-medium font-body outline-none"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="absolute right-2 top-1.5 bottom-1.5 aspect-square bg-primary text-white rounded-lg flex items-center justify-center hover:bg-primary-container transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
            </button>
          </div>
        </form>
      </div>
    </div>
    </div>
  );
};

export default GlobalSquare;
