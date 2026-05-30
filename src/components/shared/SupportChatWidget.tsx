import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: number;
}

const CHANNEL = 'support-chat';

const roleDot: Record<string, string> = {
  super_admin: 'bg-error',
  organizer:   'bg-primary',
};

export const SupportChatWidget = () => {
  const { profile } = useAuth();
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [unread, setUnread]     = useState(0);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const openRef    = useRef(false);

  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => {
    if (!profile) return;

    const ch = supabase.channel(CHANNEL, {
      config: { broadcast: { self: true } },
    });

    // Set ref immediately so send() can queue if needed
    channelRef.current = ch;

    ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
      const msg = payload as ChatMessage;
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      if (!openRef.current) setUnread(n => n + 1);
    });

    ch.subscribe((status) => {
      setConnected(status === 'SUBSCRIBED');
    });

    return () => {
      setConnected(false);
      channelRef.current = null;
      supabase.removeChannel(ch);
    };
  }, [profile]); // intentionally omit addMessage — inline handler is stable

  // Reset unread and scroll when opened
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    if (open && messages.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [messages, open]);

  const send = () => {
    if (!input.trim() || !profile || !channelRef.current || !connected) return;
    const displayName = profile.user_type === 'super_admin'
      ? 'Super Admin'
      : profile.city
        ? `Organizer · ${profile.city}`
        : 'Organizer';
    const msg: ChatMessage = {
      id:         crypto.randomUUID(),
      senderId:   profile.user_id,
      senderName: displayName,
      senderRole: profile.user_type,
      text:       input.trim(),
      timestamp:  Date.now(),
    };
    channelRef.current.send({ type: 'broadcast', event: 'msg', payload: msg });
    setInput('');
  };

  const isMine = (msg: ChatMessage) => msg.senderId === profile?.user_id;

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!profile) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-container text-white shadow-[0_8px_32px_rgba(19,41,143,0.35)] hover:scale-[1.06] active:scale-[0.97] transition-transform flex items-center justify-center"
        aria-label="Support chat"
      >
        <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          {open ? 'close' : 'support_agent'}
        </span>
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-error text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 flex flex-col bg-surface-container-lowest rounded-[2rem] shadow-[0_16px_64px_rgba(19,41,143,0.18)] overflow-hidden border border-outline-variant/10"
          style={{ maxHeight: '70vh' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary-container px-5 py-4 flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>support_agent</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-headline font-bold text-white text-sm">Support Chat</p>
              <p className="text-white/60 text-[10px] font-body">Organizer ↔ Super Admin</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-tertiary-fixed-dim animate-pulse' : 'bg-white/30'}`} />
              <span className="text-white/60 text-[10px] font-body">{connected ? 'Live' : 'Connecting…'}</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-[36px] text-outline/40">chat_bubble_outline</span>
                <p className="text-xs text-on-surface-variant/60 font-body mt-2">Send a message to start the conversation.</p>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex flex-col ${isMine(msg) ? 'items-end' : 'items-start'}`}>
                {!isMine(msg) && (
                  <div className="flex items-center gap-1.5 mb-1 ml-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${roleDot[msg.senderRole] ?? 'bg-outline'}`} />
                    <span className="text-[10px] font-bold text-on-surface-variant font-headline">
                      {msg.senderName}
                    </span>
                  </div>
                )}
                <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm font-body leading-snug ${
                  isMine(msg)
                    ? 'bg-gradient-to-br from-primary to-primary-container text-white rounded-br-sm'
                    : 'bg-surface-container text-on-surface rounded-bl-sm'
                }`}>
                  {msg.text}
                </div>
                <span className="text-[9px] text-on-surface-variant/40 font-body mt-0.5 mx-1">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 px-4 py-3 border-t border-surface-variant/30 flex gap-2">
            <input
              className="flex-1 bg-surface-container-high rounded-xl px-4 py-2.5 text-sm font-body text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
              placeholder={connected ? 'Type a message…' : 'Connecting…'}
              disabled={!connected}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || !connected}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-container text-white flex items-center justify-center hover:scale-[1.05] active:scale-[0.97] transition-transform disabled:opacity-40 disabled:hover:scale-100 shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
