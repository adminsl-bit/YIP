import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Trash2, Paperclip, Smile, User, MessagesSquare } from 'lucide-react';
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

export const GlobalSquare = () => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeProfiles, setActiveProfiles] = useState<Participant[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeChannel, setActiveChannel] = useState<Channel>('global');
  const [parties, setParties] = useState<string[]>([]);
  const [selectedParty, setSelectedParty] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const rtChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isOrganizer = (profile as any)?.user_type === 'organizer';

  useEffect(() => {
    if (!isOrganizer) return;
    supabase.from('profiles').select('party_name').not('party_name', 'is', null)
      .then(({ data }) => {
        const unique = [...new Set((data || []).map((p: any) => p.party_name).filter(Boolean))] as string[];
        setParties(unique);
        setSelectedParty(prev => prev || unique[0] || '');
      });
  }, [isOrganizer]);

  const getChannelName = (ch: Channel = activeChannel) => {
    if (ch === 'global') return 'global_square';
    if (ch === 'party') {
      if (isOrganizer && selectedParty) return `party_${selectedParty.toLowerCase().replace(/\s+/g, '_')}`;
      return `party_${profile?.party_name?.toLowerCase().replace(/\s+/g, '_') || 'independent'}`;
    }
    return 'organizer_direct';
  };

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  const fetchActiveParticipants = async () => {
    try {
      const { data } = await supabase.from('profiles').select('id, name, photo_url, user_type, city, party_name, position').limit(20);
      setActiveProfiles((data as any[]) || []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    setMessages([]);
    fetchActiveParticipants();

    const chName = `yip:chat:${getChannelName()}`;
    const ch = supabase.channel(chName, { config: { broadcast: { self: true } } });

    ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
      setMessages(prev => [...prev, payload as Message]);
    });
    ch.on('broadcast', { event: 'del' }, ({ payload }: { payload: { id: string } }) => {
      setMessages(prev => prev.filter(m => m.id !== payload.id));
    });
    ch.subscribe();
    rtChannelRef.current = ch;

    return () => { supabase.removeChannel(ch); rtChannelRef.current = null; };
  }, [activeChannel, profile?.party_name, selectedParty]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !rtChannelRef.current) return;
    const text = newMessage.trim();
    setNewMessage('');

    const msg: Message = {
      id: crypto.randomUUID(),
      content: text,
      user_id: user.id,
      channel: getChannelName(),
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

    const result = await rtChannelRef.current.send({ type: 'broadcast', event: 'msg', payload: msg });
    if (result !== 'ok') {
      toast.error('Failed to send message');
      setNewMessage(text);
    }
  };

  const handleDelete = async (id: string) => {
    const isOrganizer = (profile as any)?.user_type === 'organizer';
    const isOwn = messages.find(m => m.id === id)?.user_id === user?.id;
    if (!isOrganizer && !isOwn || !rtChannelRef.current) return;
    await rtChannelRef.current.send({ type: 'broadcast', event: 'del', payload: { id } });
  };

  const switchChannel = (ch: Channel) => {
    setActiveChannel(ch);
    setMessages([]);
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
          <MessagesSquare className="w-3 h-3" />
          Delegate Communications Network
        </p>
      </header>

    <div className="flex flex-col bg-white overflow-hidden rounded-3xl shadow-sm border border-outline-variant/10" style={{ height: 'calc(100vh - 11rem)' }}>

      {/* ── Tab Navigation ── */}
      <div className="px-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex gap-8">
          {TABS.map(tab => (
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
          {parties.map(party => (
            <button
              key={party}
              onClick={() => { setSelectedParty(party); setMessages([]); }}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all font-headline ${
                selectedParty === party
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-on-surface-variant hover:bg-primary/10 hover:text-primary border border-slate-200'
              }`}
            >
              {party}
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
              <Loader2 className="w-8 h-8 text-primary/30 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
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
                          : <User className="w-5 h-5 text-slate-400" />}
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
                              <Trash2 className="w-3 h-3" />
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
                            : <User className="w-5 h-5 text-slate-400" />}
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
                          : <User className="w-5 h-5 text-slate-400" />}
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
                    ? `Monitoring ${selectedParty || 'party'} wing. Switch parties above.`
                    : `Caucus channel for ${profile?.party_name || 'your party'}.`
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
            <Paperclip className="w-5 h-5" />
          </button>
          <button type="button" className="p-2 text-slate-400 hover:text-primary transition-colors">
            <Smile className="w-5 h-5" />
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                activeChannel === 'global' ? 'Broadcast to the floor…' :
                activeChannel === 'party' ? (isOrganizer ? `Message ${selectedParty || 'party'} wing…` : 'Message your party caucus…') :
                isOrganizer ? 'Reply to delegates…' : 'Message the organizers…'
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-5 pr-14 focus:ring-2 focus:ring-primary/20 focus:bg-white focus:border-primary transition-all text-sm font-medium font-body outline-none"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="absolute right-2 top-1.5 bottom-1.5 aspect-square bg-primary text-white rounded-lg flex items-center justify-center hover:bg-primary-container transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
    </div>
  );
};

export default GlobalSquare;
