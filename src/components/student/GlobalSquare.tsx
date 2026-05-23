import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Search, 
  MoreVertical, 
  MessageSquare, 
  Users, 
  Shield, 
  User,
  Loader2,
  Trash2,
  Smile,
  Paperclip,
  ArrowRight
} from 'lucide-react';
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
    avatar_url: string;
    user_type: string;
    city: string;
    party_name?: string;
  };
}

interface Participant {
  id: string;
  name: string;
  avatar_url: string;
  user_type: string;
  city: string;
  party_name?: string;
}

export const GlobalSquare = () => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeProfiles, setActiveProfiles] = useState<Participant[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeChannel, setActiveChannel] = useState<'global' | 'party' | 'organizer'>('global');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Determine current channel name
  const getChannelName = () => {
    if (activeChannel === 'global') return 'global_square';
    if (activeChannel === 'party') return `party_${profile?.party_name?.toLowerCase().replace(/\s+/g, '_') || 'independent'}`;
    return 'organizer_direct';
  };

  useEffect(() => {
    fetchMessages();
    fetchActiveParticipants();

    // Subscribe to new messages
    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel=eq.${getChannelName()}`,
        },
        async (payload) => {
          const { data: newMsg, error } = await supabase
            .from('messages')
            .select(`
              *,
              profiles:user_id (
                name,
                avatar_url,
                user_type,
                city,
                party_name
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (newMsg) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannel, profile]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles:user_id (
            name,
            avatar_url,
            user_type,
            city,
            party_name
          )
        `)
        .eq('channel', getChannelName())
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(10);

      if (error) throw error;
      setActiveProfiles(data || []);
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      const messageData = {
        content: newMessage.trim(),
        user_id: user.id,
        channel: getChannelName(),
      };

      const { error } = await supabase.from('messages').insert([messageData]);
      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleRedactMessage = async (id: string) => {
    if (profile?.user_type !== 'organizer') return;
    
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== id));
      toast.success('Message redacted');
    } catch (error) {
      toast.error('Failed to redact message');
    }
  };

  return (
    <div className="flex h-full bg-transparent overflow-hidden">
      {/* Main Chat Area */}
      <section className="flex-1 flex flex-col relative bg-surface-container-low/20 backdrop-blur-sm rounded-[2.5rem] overflow-hidden m-4 shadow-sm shadow-primary/5">
        {/* Chat Header / Navigation */}
        <div className="px-8 py-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 z-10 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10">
          <div className="flex flex-col">
            <h1 className="font-display font-black text-display-xs text-on-surface tracking-tighter uppercase italic leading-none">
              {activeChannel === 'global' ? 'Global Square' : 
               activeChannel === 'party' ? `${profile?.party_name || 'Party'} Caucus` : 
               'Secretariat Direct'}
            </h1>
            <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              {activeProfiles.length} Delegates Addressing the Assembly
            </p>
          </div>

          <nav className="flex items-center gap-1 bg-surface-container-high/50 p-1.5 rounded-full backdrop-blur-md">
            {[
              { id: 'global', label: 'Global' },
              { id: 'party', label: 'Party' },
              { id: 'organizer', label: 'Staff' }
            ].map((item) => (
              <button 
                key={item.id}
                onClick={() => setActiveChannel(item.id as any)}
                className={`relative font-display font-black text-[10px] uppercase tracking-[0.2em] px-8 py-3 rounded-full transition-all duration-500 ${
                  activeChannel === item.id 
                    ? 'text-on-primary' 
                    : 'text-on-surface-variant/40 hover:text-on-surface-variant/60'
                }`}
              >
                {activeChannel === item.id && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute inset-0 bg-primary rounded-full shadow-lg shadow-primary/20"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Messages Window */}
        <div 
          ref={scrollRef} 
          className="flex-1 overflow-y-auto px-8 py-6 space-y-10 no-scrollbar scroll-smooth"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-on-surface-variant/20">
              <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
              <p className="font-display font-black text-label-xs uppercase tracking-[0.4em] opacity-40">Synchronizing...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20 max-w-sm mx-auto animate-fade-in">
              <div className="w-24 h-24 bg-surface-container rounded-[2.5rem] flex items-center justify-center mb-8 relative">
                <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl animate-pulse" />
                <MessageSquare className="w-10 h-10 text-primary relative z-10" />
              </div>
              <h2 className="font-display font-black text-headline-sm text-on-surface mb-3 uppercase italic tracking-tight">The Square is Quiet</h2>
              <p className="text-on-surface-variant/50 text-body-md font-medium leading-relaxed">
                The floor is open for discussion. Be the first to address the assembly with your thoughts and inquiries.
              </p>
            </div>
          ) : (
            <div className="space-y-12 pb-12">
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => {
                  const isMe = msg.user_id === user?.id;
                  const isOrganizer = msg.profiles?.user_type === 'organizer';
                  const canModerate = profile?.user_type === 'organizer';
                  const showHeader = idx === 0 || messages[idx-1].user_id !== msg.user_id;

                  return (
                    <motion.div 
                      key={msg.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group/msg`}
                    >
                      {showHeader && (
                        <div className={`flex items-center gap-4 mb-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                          <div className="w-10 h-10 rounded-2xl bg-surface-container-high overflow-hidden shadow-sm relative group-hover/msg:scale-110 transition-transform">
                            {msg.profiles?.avatar_url ? (
                              <img src={msg.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-primary/10">
                                <User className="w-5 h-5 text-primary/40" />
                              </div>
                            )}
                          </div>
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <span className={`font-display font-black text-label-xs tracking-widest uppercase flex items-center gap-3 ${isMe ? 'text-secondary' : isOrganizer ? 'text-amber-600' : 'text-primary'}`}>
                              {isMe ? 'You' : msg.profiles?.name}
                              {isOrganizer && (
                                <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase tracking-[0.2em]">
                                  Moderator
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-on-surface-variant/20 font-black uppercase tracking-[0.1em] mt-1">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="relative flex items-center gap-4 max-w-[80%]">
                        <div className={`px-7 py-4 rounded-[1.5rem] transition-all duration-500 ${
                          isMe ? 
                          'bg-primary text-on-primary rounded-tr-none shadow-lg shadow-primary/10' : 
                          isOrganizer ?
                          'bg-amber-50 text-amber-950 rounded-tl-none border border-amber-200/30' :
                          'bg-surface-container-lowest text-on-surface rounded-tl-none shadow-sm group-hover/msg:shadow-md'
                        }`}>
                          <p className="leading-relaxed text-body-md font-medium tracking-tight whitespace-pre-wrap">{msg.content}</p>
                        </div>

                        {canModerate && !isMe && (
                          <button 
                            onClick={() => handleRedactMessage(msg.id)}
                            className="opacity-0 group-hover/msg:opacity-100 p-3 text-on-surface-variant/20 hover:text-secondary hover:bg-secondary/5 rounded-full transition-all"
                            title="Redact Message"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Message Input Area */}
        <div className="p-8 bg-surface/80 backdrop-blur-xl border-t border-outline-variant/10">
          <form onSubmit={handleSendMessage} className="relative max-w-5xl mx-auto flex items-center gap-4">
            <div className="flex-1 relative group">
              <input 
                type="text" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Address the ${activeChannel} floor...`}
                className="w-full bg-surface-container-high/50 border-none focus:ring-4 focus:ring-primary/5 focus:bg-surface-container-lowest rounded-2xl py-5 pl-10 pr-20 text-body-md placeholder:text-on-surface-variant/30 shadow-sm transition-all duration-500 font-medium"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-40 group-focus-within:opacity-100 transition-opacity">
                <button type="button" className="p-2 hover:text-primary hover:bg-primary/5 rounded-full transition-all">
                  <Smile className="w-5 h-5" />
                </button>
                <button type="button" className="p-2 hover:text-primary hover:bg-primary/5 rounded-full transition-all">
                  <Paperclip className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-primary text-on-primary w-16 h-16 rounded-2xl flex items-center justify-center hover:scale-105 hover:bg-primary_container active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-20 disabled:scale-100 disabled:shadow-none shrink-0"
            >
              <Send className="w-6 h-6" />
            </button>
          </form>
          <div className="mt-6 flex items-center justify-center gap-8 text-[10px] font-black text-on-surface-variant/30 uppercase tracking-[0.3em]">
            <span className="flex items-center gap-3"><Shield className="w-3.5 h-3.5 opacity-50" /> Institutional Encryption</span>
            <span className="flex items-center gap-3"><Users className="w-3.5 h-3.5 opacity-50" /> {activeProfiles.length} Delegates</span>
          </div>
        </div>
      </section>

      {/* Right Participant Sidebar */}
      <aside className="hidden 2xl:flex flex-col w-96 p-10 overflow-y-auto no-scrollbar bg-surface-container-lowest/50 backdrop-blur-md border-l border-outline-variant/10">
        <div className="flex items-center justify-between mb-12">
          <h2 className="font-display font-black text-on-surface text-display-xs tracking-tighter uppercase italic leading-none">Status</h2>
          <div className="bg-tertiary/5 text-tertiary text-[10px] px-4 py-1.5 rounded-full font-black uppercase tracking-[0.2em] flex items-center gap-2 border border-tertiary/10">
            <div className="w-2 h-2 bg-tertiary rounded-full animate-pulse"></div>
            Assembly Live
          </div>
        </div>
        
        <div className="space-y-12">
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.4em] font-black text-on-surface-variant/30 mb-8">
              {activeChannel === 'global' ? 'Grand Assembly' : 
               activeChannel === 'party' ? 'Caucus Members' : 
               'Secretariat'}
            </h3>
            <div className="space-y-6">
              {activeProfiles.map(participant => (
                <div key={participant.id} className="flex items-center gap-5 group cursor-pointer">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-surface-container-high overflow-hidden shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-500">
                      {participant.avatar_url ? (
                        <img src={participant.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/5">
                          <User className="w-6 h-6 text-primary/20" />
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-tertiary rounded-full border-2 border-surface shadow-sm"></div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-bold text-on-surface group-hover:text-primary transition-colors truncate tracking-tight">{participant.name}</p>
                    <p className="text-[9px] text-on-surface-variant/40 font-black uppercase tracking-[0.2em] truncate mt-1">
                      {participant.user_type === 'organizer' ? 'Secretariat' : (participant.party_name || participant.city || 'Delegate')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-8 bg-surface-container-low rounded-[2rem] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <h4 className="font-display font-black text-title-sm text-on-surface mb-3 uppercase italic leading-tight">Decorum</h4>
            <p className="text-[12px] text-on-surface-variant/60 leading-relaxed font-medium">
              Maintain parliamentary standards. All addressed statements are recorded and moderated.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
