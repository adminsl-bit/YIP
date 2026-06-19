import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string | null;
  created_at: string;
  user_id: string;
  channel: string;
  event_id: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  is_reported?: boolean;
  report_reason?: string | null;
}

interface ProfileLite {
  user_id: string;
  name: string;
  photo_url: string | null;
  user_type: string;
  city?: string;
  party_name?: string | null;
  committee?: string | null;
  position?: string | null;
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

type Channel = 'global' | 'party' | 'organizer' | 'committee';

const TABS: { id: Channel; label: string; icon: string }[] = [
  { id: 'global',    label: 'Global Square', icon: 'public' },
  { id: 'party',     label: 'Party Wing',    icon: 'groups' },
  { id: 'committee', label: 'Committee',     icon: 'edit_document' },
  { id: 'organizer', label: 'Organizer Hub', icon: 'admin_panel_settings' },
];

const PAGE_SIZE = 50;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

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

function slugify(value: string) {
  return value.toLowerCase().replace(/\s+/g, '_');
}

export const GlobalSquare = ({ hiddenChannels = [] }: { hiddenChannels?: Channel[] } = {}) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileLite>>({});
  const [activeProfiles, setActiveProfiles] = useState<Participant[]>([]);
  const [eventStudentCount, setEventStudentCount] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeChannel, setActiveChannel] = useState<Channel>('global');
  const [parties, setParties] = useState<number[]>([]);
  const [selectedParty, setSelectedParty] = useState<number | null>(null);
  const [committees, setCommittees] = useState<string[]>([]);
  const [selectedCommittee, setSelectedCommittee] = useState<string | null>(null);
  const [eventPartyNames, setEventPartyNames] = useState<Record<number, string>>({});
  const [showReported, setShowReported] = useState(false);
  const [reportedMessages, setReportedMessages] = useState<Message[]>([]);
  const [reportedLoading, setReportedLoading] = useState(false);
  const [reportedCount, setReportedCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const presenceChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const profileRef = useRef<typeof profile>(null);
  const profilesCacheRef = useRef<Map<string, ProfileLite>>(new Map());
  const activeLoadKeyRef = useRef<string | null>(null);
  const showReportedRef = useRef(false);

  // Derived profile values — must be declared before visibleTabs
  const eventId        = (profile as any)?.event_id as string | undefined;
  const isOrganizer     = (profile as any)?.user_type === 'organizer';
  const isOrgOrJury     = isOrganizer || (profile as any)?.user_type === 'jury';
  const myPartyNumber  = (profile as any)?.party_number ?? 0;
  const myPartyName    = (profile as any)?.party_name as string | null ?? null;
  const myCommittee    = (profile as any)?.committee as string | null ?? null;

  const visibleTabs = TABS.filter(t => {
    if (hiddenChannels.includes(t.id)) return false;
    if (t.id === 'committee') return !!myCommittee || isOrganizer;
    return true;
  });

  // Load distinct party numbers from active students of this event (organizer only)
  useEffect(() => {
    if (!isOrganizer || !eventId) return;
    supabase.from('profiles')
      .select('party_number')
      .eq('user_type', 'student')
      .eq('is_active', true)
      .eq('event_id', eventId)
      .then(({ data }) => {
        const nums = [...new Set((data || []).map((p: any) => p.party_number).filter((n: any) => n != null))]
          .sort((a: any, b: any) => a - b) as number[];
        setParties(nums);
        setSelectedParty((prev: number | null) => prev ?? nums[0] ?? null);
      });
  }, [isOrganizer, eventId]);

  // Load distinct committees from active students of this event (organizer only)
  useEffect(() => {
    if (!isOrganizer || !eventId) return;
    supabase.from('profiles')
      .select('committee')
      .eq('user_type', 'student')
      .eq('is_active', true)
      .eq('event_id', eventId)
      .not('committee', 'is', null)
      .then(({ data }) => {
        const cs = [...new Set((data || []).map((p: any) => p.committee).filter(Boolean))].sort() as string[];
        setCommittees(cs);
        setSelectedCommittee(prev => prev ?? cs[0] ?? null);
      });
  }, [isOrganizer, eventId]);

  // Load this event's configured party names (organizer party-selector labels)
  useEffect(() => {
    if (!isOrganizer || !eventId) return;
    supabase.from('event_parties')
      .select('name, display_order')
      .eq('event_id', eventId)
      .order('display_order')
      .then(({ data }) => {
        const map: Record<number, string> = {};
        (data || []).forEach((p: any) => { map[p.display_order + 1] = p.name; });
        setEventPartyNames(map);
      });
  }, [isOrganizer, eventId]);

  // Derive the event-scoped channel key — only changes when the real channel changes
  const channelKey = useMemo(() => {
    if (!eventId) return null;
    if (activeChannel === 'global') return `global_${eventId}`;
    if (activeChannel === 'party') {
      const partyNum = isOrganizer ? (selectedParty ?? 0) : myPartyNumber;
      return `party_${eventId}_${partyNum}`;
    }
    if (activeChannel === 'committee') {
      const src = isOrganizer ? (selectedCommittee ?? 'unassigned') : (myCommittee ?? 'unassigned');
      return `committee_${eventId}_${slugify(src)}`;
    }
    return `organizer_${eventId}`;
  }, [eventId, activeChannel, isOrganizer, selectedParty, myPartyNumber, myCommittee, selectedCommittee]);

  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { showReportedRef.current = showReported; }, [showReported]);

  // Lightweight event roster count — replaces the expensive presence channel.
  // Presence with 181 users caused ~1.7 GB of WebSocket traffic on join and
  // froze every student's browser. A simple count query is accurate enough.
  useEffect(() => {
    if (!eventId) return;
    supabase
      .from('profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('user_type', 'student')
      .eq('is_active', true)
      .then(({ count }) => setEventStudentCount(count ?? 0));
  }, [eventId]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    });
  };

  // Fetch any profiles not yet cached and merge them into profilesMap
  const resolveProfiles = useCallback(async (userIds: string[]) => {
    const missing = [...new Set(userIds)].filter(id => id && !profilesCacheRef.current.has(id));
    if (missing.length === 0) return;
    const { data } = await supabase
      .from('profiles')
      .select('user_id, name, photo_url, user_type, city, party_name, committee, position')
      .in('user_id', missing);
    if (!data || data.length === 0) return;
    const additions: Record<string, ProfileLite> = {};
    data.forEach((p: any) => {
      profilesCacheRef.current.set(p.user_id, p);
      additions[p.user_id] = p;
    });
    setProfilesMap(prev => ({ ...prev, ...additions }));
  }, []);

  // Load the latest page of messages for a channel
  const loadMessages = useCallback(async (ck: string, evId: string) => {
    activeLoadKeyRef.current = ck;
    setLoading(true);
    setMessages([]);
    setHasMore(false);

    const { data, error } = await supabase
      .from('civic_chat_messages')
      .select('*')
      .eq('event_id', evId)
      .eq('channel', ck)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (activeLoadKeyRef.current !== ck) return; // a newer channel switch superseded this load

    if (error) {
      toast.error('Failed to load messages');
      setLoading(false);
      return;
    }

    const rows = (data || []).reverse() as Message[];
    setMessages(rows);
    setHasMore((data || []).length === PAGE_SIZE);
    setLoading(false);
    await resolveProfiles(rows.map(r => r.user_id));
    if (activeLoadKeyRef.current === ck) scrollToBottom();
  }, [resolveProfiles]);

  const loadEarlier = useCallback(async () => {
    if (!eventId || !channelKey || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0].created_at;
    const ck = channelKey;
    const { data, error } = await supabase
      .from('civic_chat_messages')
      .select('*')
      .eq('event_id', eventId)
      .eq('channel', ck)
      .lt('created_at', oldest)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (!error && activeLoadKeyRef.current === ck) {
      const rows = (data || []).reverse() as Message[];
      setMessages(prev => [...rows, ...prev]);
      setHasMore((data || []).length === PAGE_SIZE);
      await resolveProfiles(rows.map(r => r.user_id));
    }
    setLoadingMore(false);
  }, [eventId, channelKey, messages, resolveProfiles]);

  // Subscribe to realtime changes for ONLY the active channel — re-subscribes on tab switch
  useEffect(() => {
    if (!eventId || !channelKey) return;
    loadMessages(channelKey, eventId);

    const ck = channelKey;
    const ch = supabase.channel(`civic_chat:${ck}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'civic_chat_messages', filter: `channel=eq.${ck}` }, (payload) => {
        const row = payload.new as Message;
        if (row.channel !== ck) return;
        setMessages(prev => prev.some(m => m.id === row.id) ? prev : [...prev, row]);
        resolveProfiles([row.user_id]);
        scrollToBottom();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'civic_chat_messages', filter: `channel=eq.${ck}` }, (payload) => {
        const row = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === row.id ? { ...m, ...row } : m));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'civic_chat_messages', filter: `channel=eq.${ck}` }, (payload) => {
        const oldRow = payload.old as { id: string };
        setMessages(prev => prev.filter(m => m.id !== oldRow.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [channelKey, eventId, loadMessages, resolveProfiles]);

  // Organizer: track how many reports are outstanding for this event
  const loadReportedMessages = useCallback(async () => {
    if (!eventId) return;
    setReportedLoading(true);
    const { data, error } = await supabase
      .from('civic_chat_messages')
      .select('*')
      .eq('event_id', eventId)
      .eq('is_reported', true)
      .order('reported_at', { ascending: false });
    if (!error) {
      const rows = (data || []) as Message[];
      setReportedMessages(rows);
      await resolveProfiles(rows.map(r => r.user_id));
    }
    setReportedLoading(false);
  }, [eventId, resolveProfiles]);

  useEffect(() => {
    if (!isOrgOrJury || !eventId) return;

    const fetchCount = async () => {
      const { count } = await supabase
        .from('civic_chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('is_reported', true);
      setReportedCount(count || 0);
    };
    fetchCount();

    const ch = supabase.channel(`civic_chat_reports:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'civic_chat_messages', filter: `event_id=eq.${eventId}` }, () => {
        fetchCount();
        if (showReportedRef.current) loadReportedMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [isOrgOrJury, eventId, loadReportedMessages]);

  const sendMessage = async (extra: Partial<Pick<Message, 'attachment_url' | 'attachment_type' | 'attachment_name'>> = {}) => {
    if (!user || !eventId || !channelKey) return;
    const text = newMessage.trim();
    if (!text && !extra.attachment_url) return;
    setNewMessage('');

    const { data, error } = await supabase
      .from('civic_chat_messages')
      .insert({
        event_id: eventId,
        channel: channelKey,
        user_id: user.id,
        content: text || null,
        ...extra,
      })
      .select('*')
      .single();

    if (error || !data) {
      toast.error('Failed to send message');
      setNewMessage(text);
      return;
    }

    setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data as Message]);
    resolveProfiles([user.id]);
    scrollToBottom();
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleAttachClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error('File too large — max 5MB');
      return;
    }
    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      await sendMessage({
        attachment_url: data.publicUrl,
        attachment_type: file.type,
        attachment_name: file.name,
      });
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  const handleDelete = async (id: string) => {
    const isOwn = messages.find(m => m.id === id)?.user_id === user?.id;
    if (!isOrgOrJury && !isOwn) return;
    const { error } = await supabase.from('civic_chat_messages').delete().eq('id', id);
    if (error) toast.error('Failed to delete message');
    else setMessages(prev => prev.filter(m => m.id !== id));
  };

  const handleReport = async (id: string) => {
    const { error } = await supabase.rpc('report_civic_chat_message', { p_message_id: id });
    if (error) toast.error('Failed to report message');
    else toast.success('Reported to organizers');
  };

  const handleResolve = async (id: string) => {
    const { error } = await supabase.rpc('resolve_civic_chat_report', { p_message_id: id });
    if (error) {
      toast.error('Failed to resolve report');
      return;
    }
    setReportedMessages(prev => prev.filter(m => m.id !== id));
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_reported: false } : m));
    setReportedCount(c => Math.max(0, c - 1));
  };

  const switchChannel = (ch: Channel) => {
    setActiveChannel(ch);
    setShowReported(false);
  };

  const toggleReported = () => {
    const next = !showReported;
    setShowReported(next);
    if (next) loadReportedMessages();
  };

  // Resolve a channel string into a human-readable label (for the reported-messages panel)
  const channelLabel = useCallback((channel: string) => {
    if (!eventId) return channel;
    if (channel === `global_${eventId}`) return 'Global Square';
    if (channel === `organizer_${eventId}`) return 'Organizer Hub';
    if (channel.startsWith(`party_${eventId}_`)) {
      const num = channel.slice(`party_${eventId}_`.length);
      return eventPartyNames[Number(num)] || `Party ${num}`;
    }
    if (channel.startsWith(`committee_${eventId}_`)) {
      const slug = channel.slice(`committee_${eventId}_`.length);
      const match = committees.find(c => slugify(c) === slug);
      return match || 'Committee';
    }
    return channel;
  }, [eventId, eventPartyNames, committees]);

  // Switch the active tab/selector to wherever a reported message lives
  const jumpToChannel = (channel: string) => {
    if (!eventId) return;
    if (channel === `global_${eventId}`) {
      setActiveChannel('global');
    } else if (channel === `organizer_${eventId}`) {
      setActiveChannel('organizer');
    } else if (channel.startsWith(`party_${eventId}_`)) {
      const num = parseInt(channel.slice(`party_${eventId}_`.length), 10);
      setActiveChannel('party');
      if (!Number.isNaN(num)) setSelectedParty(num);
    } else if (channel.startsWith(`committee_${eventId}_`)) {
      const slug = channel.slice(`committee_${eventId}_`.length);
      const match = committees.find(c => slugify(c) === slug);
      setActiveChannel('committee');
      if (match) setSelectedCommittee(match);
    }
    setShowReported(false);
  };

  const leadership = activeProfiles.filter(p => {
    const pos = (p.position || p.user_type || '').toLowerCase();
    return pos.includes('organizer') || pos.includes('minister') || pos.includes('speaker') || pos.includes('secretary') || pos.includes('official');
  });
  const candidates = activeProfiles.filter(p => !leadership.includes(p));

  if (!eventId) {
    return (
      <div>
        <header className="mb-8">
          <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
            Civic <span className="text-secondary">Chat Hub</span>
          </h1>
        </header>
        <div className="flex flex-col items-center justify-center bg-white rounded-3xl shadow-sm border border-outline-variant/10 py-24">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

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
              className={`py-5 text-sm font-bold border-b-2 transition-all font-headline flex items-center gap-1.5 ${
                activeChannel === tab.id && !showReported
                  ? 'text-primary border-primary'
                  : 'text-slate-400 hover:text-slate-600 border-transparent'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]"
                style={activeChannel === tab.id ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {tab.icon}
              </span>
              {tab.id === 'committee' && myCommittee
                ? myCommittee.replace('Standing Committee on ', '').replace('Committee on ', '')
                : tab.id === 'party' && !isOrganizer && myPartyName
                ? myPartyName
                : tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {isOrgOrJury && (
            <button
              onClick={toggleReported}
              className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2 transition-colors font-headline ${
                showReported ? 'bg-red-500 text-white' : 'bg-red-50 text-red-500 hover:bg-red-100'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">flag</span>
              Reported{reportedCount > 0 ? ` (${reportedCount})` : ''}
            </button>
          )}
          <p className="text-xs text-slate-400 font-medium bg-slate-50 px-3 py-1 rounded-full flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            {eventStudentCount ?? '—'} Delegates
          </p>
        </div>
      </div>

      {/* ── Organizer: Party selector strip ── */}
      {isOrganizer && activeChannel === 'party' && !showReported && parties.length > 0 && (
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
              {eventPartyNames[partyNum] || `Party ${partyNum}`}
            </button>
          ))}
        </div>
      )}

      {/* ── Organizer: Committee selector strip ── */}
      {isOrganizer && activeChannel === 'committee' && !showReported && committees.length > 0 && (
        <div className="px-6 py-3 bg-surface-container-low border-b border-slate-100 flex items-center gap-3 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 shrink-0 font-headline">Monitor Committee:</span>
          {committees.map(c => (
            <button
              key={c}
              onClick={() => setSelectedCommittee(c)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all font-headline ${
                selectedCommittee === c
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-on-surface-variant hover:bg-primary/10 hover:text-primary border border-slate-200'
              }`}
            >
              {c.replace(/Standing Committee on /i, '').replace(/Committee on /i, '')}
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
          {showReported ? (
            // ── Reported messages panel (organizer/jury only) ──
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-headline">Reported Messages</h3>
              {reportedLoading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : reportedMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-20">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                    <span className="material-symbols-outlined text-[28px] text-slate-300">flag</span>
                  </div>
                  <p className="text-sm font-bold text-slate-400">No reported messages</p>
                  <p className="text-xs text-slate-300 mt-1">Flagged chats will appear here for review.</p>
                </div>
              ) : (
                reportedMessages.map(msg => {
                  const sender = profilesMap[msg.user_id];
                  return (
                    <div key={msg.id} className="bg-white rounded-2xl border border-red-100 p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black uppercase tracking-wider bg-red-50 text-red-500 px-2 py-1 rounded-full">
                          {channelLabel(msg.channel)}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatTime(msg.created_at)}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 font-headline">{sender?.name || 'Delegate'}</p>
                      {sender?.party_name && (
                        <p className="text-[10px] text-slate-400">{sender.party_name}</p>
                      )}
                      {msg.content && <p className="text-sm text-slate-600 mt-2">{msg.content}</p>}
                      {msg.attachment_url && (
                        <a href={msg.attachment_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600">
                          <span className="material-symbols-outlined text-[16px]">attach_file</span>
                          {msg.attachment_name || 'Attachment'}
                        </a>
                      )}
                      <div className="flex gap-4 mt-3">
                        <button onClick={() => jumpToChannel(msg.channel)} className="text-xs font-bold text-primary hover:underline">
                          Jump to chat
                        </button>
                        <button onClick={() => handleResolve(msg.id)} className="text-xs font-bold text-emerald-600 hover:underline">
                          Resolve
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : loading ? (
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
            <>
              {hasMore && (
                <div className="flex justify-center">
                  <button
                    onClick={loadEarlier}
                    disabled={loadingMore}
                    className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 hover:bg-primary/10 px-4 py-2 rounded-full transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading…' : 'Load earlier messages'}
                  </button>
                </div>
              )}
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => {
                  const isMe = msg.user_id === user?.id;
                  const sender = profilesMap[msg.user_id];
                  const isOrg = sender?.user_type === 'organizer' || sender?.position?.toLowerCase().includes('organizer');
                  const canDelete = isOrgOrJury || msg.user_id === user?.id;
                  const showDate = idx === 0 || !isSameDay(messages[idx - 1].created_at, msg.created_at);
                  const showAvatar = idx === 0 || messages[idx - 1].user_id !== msg.user_id;
                  const photoUrl = sender?.photo_url;
                  const subtitle = !isMe
                    ? [sender?.party_name, activeChannel === 'committee' ? sender?.committee : null].filter(Boolean).join(' · ')
                    : '';

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
                            ? <img src={photoUrl} alt={sender?.name || ''} className="w-full h-full object-cover" />
                            : <span className="material-symbols-outlined text-[20px] text-on-surface-variant/40">person</span>}
                        </div>

                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          {showAvatar && (
                            <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                              <span className={`font-bold text-sm ${isMe ? 'text-primary' : 'text-slate-800'} font-headline`}>
                                {isMe ? 'You' : (sender?.name || 'Delegate')}
                                {isOrg && !isMe && (
                                  <span className="ml-2 text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Organizer</span>
                                )}
                              </span>
                              <span className="text-[10px] text-slate-400">{formatTime(msg.created_at)}</span>
                              {msg.is_reported && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Reported</span>
                              )}
                            </div>
                          )}

                          {showAvatar && subtitle && (
                            <p className={`text-[10px] text-slate-400 -mt-1 mb-1 ${isMe ? 'text-right' : 'text-left'}`}>{subtitle}</p>
                          )}

                          <div className={`relative p-4 rounded-2xl text-sm leading-relaxed font-body ${
                            isMe
                              ? 'bg-primary text-white rounded-tr-none shadow-md'
                              : 'bg-white text-on-surface rounded-tl-none shadow-sm border border-slate-100'
                          } ${msg.is_reported ? 'ring-2 ring-red-300' : ''}`}>
                            {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}

                            {msg.attachment_url && (
                              msg.attachment_type?.startsWith('image/') ? (
                                <a href={msg.attachment_url} target="_blank" rel="noreferrer" className={`block rounded-xl overflow-hidden max-w-[220px] ${msg.content ? 'mt-2' : ''}`}>
                                  <img src={msg.attachment_url} alt={msg.attachment_name || 'Attachment'} className="w-full h-auto object-cover" />
                                </a>
                              ) : (
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  download
                                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${msg.content ? 'mt-2' : ''} ${isMe ? 'bg-white/15' : 'bg-slate-100 text-slate-600'}`}
                                >
                                  <span className="material-symbols-outlined text-[16px]">description</span>
                                  <span className="truncate max-w-[160px]">{msg.attachment_name || 'Attachment'}</span>
                                </a>
                              )
                            )}

                            {canDelete && (
                              <button
                                onClick={() => handleDelete(msg.id)}
                                title="Delete"
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/msg:opacity-100 transition-opacity hover:bg-red-200"
                              >
                                <span className="material-symbols-outlined text-[12px]">delete</span>
                              </button>
                            )}
                            {!isMe && (
                              <button
                                onClick={() => handleReport(msg.id)}
                                title="Report to organizer"
                                className="absolute -top-2 -left-2 w-6 h-6 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center opacity-0 group-hover/msg:opacity-100 transition-opacity hover:bg-amber-100 hover:text-amber-600"
                              >
                                <span className="material-symbols-outlined text-[12px]">flag</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </>
          )}
          {/* Scroll anchor — always at the very bottom of the message list */}
          <div ref={bottomRef} />
        </div>

        {/* ── Right sidebar: Event Roster ── */}
        <aside className="hidden xl:flex flex-col w-72 bg-white border-l border-slate-100 p-6 overflow-y-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-headline font-extrabold text-slate-800">This Event</h2>
            <span className="bg-blue-50 text-primary text-[10px] px-2 py-1 rounded-full font-bold">{eventStudentCount ?? '—'} Delegates</span>
          </div>

          <div className="space-y-4">
            {/* Static roster count — replaces live presence list which caused
                ~1.7 GB of WebSocket traffic when all 181 delegates joined */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
              <p className="text-4xl font-black text-primary font-headline">
                {eventStudentCount ?? '—'}
              </p>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Delegates registered</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Your Profile</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
                  {(profile as any)?.photo_url
                    ? <img src={(profile as any).photo_url} alt={(profile as any).name} className="w-full h-full object-cover" />
                    : <span className="material-symbols-outlined text-[20px] text-primary/40">person</span>}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 font-headline leading-none truncate">{(profile as any)?.name || 'Delegate'}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{(profile as any)?.party_name || (profile as any)?.position || 'Member'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-6">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
                {activeChannel === 'global'
                  ? 'Global Square'
                  : activeChannel === 'party'
                  ? (isOrganizer ? (eventPartyNames[selectedParty ?? 0] || `Party ${selectedParty ?? '—'}`) : (myPartyName || 'Party Wing'))
                  : activeChannel === 'committee'
                  ? (isOrganizer ? (selectedCommittee || 'Committee') : (myCommittee || 'Committee'))
                  : 'Organizer Hub'}
              </p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {activeChannel === 'global'
                  ? 'Open forum for all delegates.'
                  : activeChannel === 'party'
                  ? isOrganizer
                    ? `Monitoring ${eventPartyNames[selectedParty ?? 0] || `Party ${selectedParty ?? '—'}`}. Switch parties above.`
                    : `Caucus channel for ${myPartyName || 'your party'} — visible only to your party members.`
                  : activeChannel === 'committee'
                  ? isOrganizer
                    ? 'Monitoring committee discussion.'
                    : `Committee channel for ${myCommittee || 'your committee'}.`
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
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
          />
          <button
            type="button"
            onClick={handleAttachClick}
            disabled={uploading}
            className="p-2 text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[20px] ${uploading ? 'animate-spin' : ''}`}>
              {uploading ? 'progress_activity' : 'attach_file'}
            </span>
          </button>
          <div className="relative" ref={emojiPickerRef}>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(v => !v)}
              className="p-2 text-slate-400 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">emoji_emotions</span>
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full mb-2 left-0 z-50 shadow-xl rounded-2xl overflow-hidden">
                <EmojiPicker onEmojiClick={handleEmojiClick} height={350} width={300} />
              </div>
            )}
          </div>
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                activeChannel === 'global' ? 'Broadcast to the floor…' :
                activeChannel === 'party' ? (isOrganizer ? `Message ${eventPartyNames[selectedParty ?? 0] || `Party ${selectedParty ?? '?'}`} wing…` : 'Message your party caucus…') :
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
