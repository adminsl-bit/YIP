import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Send, 
  PlusCircle, 
  Users, 
  Globe, 
  ShieldCheck,
  Award,
  Loader2,
  MessageSquare,
  Hash,
  ChevronRight,
  TrendingUp,
  Plus,
  Trash2,
  ShieldCheck as Shield,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from './PageHeader';

type Message = {
  id: string;
  user_id: string;
  content: string;
  channel: 'global' | 'party' | 'organizer';
  created_at: string;
  profiles: {
    name: string;
    photo_url: string;
    position: string;
    party_number: number;
    user_type: string;
    party_name: string;
  } | null;
};

type ActiveProfile = {
  id: string;
  name: string;
  photo_url: string;
  position: string;
  city: string;
  user_type: string;
  last_login_at: string;
  party_name: string;
  party_number: number;
};

const PARTY_LOGOS: Record<string, string> = {
  'DMK': "https://upload.wikimedia.org/wikipedia/commons/e/e0/DMK_Logo.svg",
  'BJP': "https://upload.wikimedia.org/wikipedia/commons/1/1e/Bharatiya_Janata_Party_logo.svg",
  'INC': "https://upload.wikimedia.org/wikipedia/commons/4/45/Indian_National_Congress_logo.svg"
};

export const GlobalSquare = () => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeProfiles, setActiveProfiles] = useState<ActiveProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [activeChannel, setActiveChannel] = useState<'global' | 'party' | 'organizer'>('global');
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('chat_messages')
        .select(`
          *,
          profiles (
            name,
            photo_url,
            position,
            party_number,
            user_type,
            party_name
          )
        `)
        .eq('channel', activeChannel);

      if (activeChannel === 'party' && profile?.party_number) {
        query = query.eq('party_number', profile.party_number);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error && error.code !== 'PGRST116') {
         console.error('Error fetching messages:', error);
      }
      setMessages(data || []);
    } catch (err: any) {
      console.error('Catch fetching messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, photo_url, position, city, user_type, last_login_at, party_name, party_number')
        .order('last_login_at', { ascending: false })
        .limit(30);
      
      if (!error) setActiveProfiles(data || []);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchActiveProfiles();

    const msgChannel = supabase
      .channel(`public:chat_messages:${activeChannel}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `channel=eq.${activeChannel}`
      }, (payload) => {
        fetchNewMessageWithProfile(payload.new.id);
      })
      .subscribe();

    const profileChannel = supabase
      .channel('public:profiles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        fetchActiveProfiles();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [activeChannel]);

  const fetchNewMessageWithProfile = async (id: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        profiles (
          name,
          photo_url,
          position,
          party_number,
          user_type,
          party_name
        )
      `)
      .eq('id', id)
      .single();
    
    if (data && !error) {
      if (data.channel === 'party' && data.party_number !== profile?.party_number) {
        return;
      }
      
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, data];
      });
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      const isOrganizer = profile?.user_type === 'organizer';
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: user.id,
          content: newMessage,
          channel: activeChannel,
          // Organizers can post to any channel; if in 'party' channel, they use their assigned party or 0
          party_number: activeChannel === 'party' ? (profile?.party_number || 0) : null
        });

      if (error) throw error;
      setNewMessage('');
      fetchMessages(); // Immediate refresh for the sender
    } catch (err: any) {
      console.error("Chat Insert Error:", err);
      toast.error(err.message || 'Failed to send message.');
    }
  };
  
  const handleDeleteMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== id));
      toast.success('Message redacted by moderator.');
    } catch (err) {
      toast.error('Moderation failed.');
    }
  };

  return (
    <div className="flex-1 flex bg-transparent h-full font-body transition-all duration-500">
      
      {/* Main Chat Area */}
      <section className="flex-1 flex flex-col bg-transparent relative">
        <div className="flex justify-end mb-6">
          <nav className="flex items-center gap-6 bg-white/50 backdrop-blur-md p-1.5 rounded-full border border-white/50 shadow-sm">
            <button 
              onClick={() => setActiveChannel('global')}
              className={`font-headline font-bold tracking-tight text-xs transition-all duration-300 px-4 py-1.5 rounded-full ${activeChannel === 'global' ? 'text-white bg-[#13298f] shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Global
            </button>
            <button 
              onClick={() => setActiveChannel('party')}
              className={`font-headline font-bold tracking-tight text-xs transition-all duration-300 px-4 py-1.5 rounded-full ${activeChannel === 'party' ? 'text-white bg-[#13298f] shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Party
            </button>
            <button 
              onClick={() => setActiveChannel('organizer')}
              className={`font-headline font-bold tracking-tight text-xs transition-all duration-300 px-4 py-1.5 rounded-full ${activeChannel === 'organizer' ? 'text-white bg-[#13298f] shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Organizer
            </button>
          </nav>
        </div>

        {/* Messages Window */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-white to-[#f7f9fb]/50 no-scrollbar">
          {loading ? (
             <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-[#13298f]" />
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-60">Synchronizing...</p>
             </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
               <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                 <MessageSquare className="w-5 h-5 text-slate-300" />
               </div>
               <p className="font-headline font-bold text-sm text-[#191c1e] mb-1">Assembly is silent</p>
               <p className="text-slate-400 text-[10px] max-w-xs mx-auto">Be the first to address the {activeChannel} square.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => {
                const isMe = msg.user_id === user?.id;
                const prevMsg = messages[idx - 1];
                const showHeader = !prevMsg || prevMsg.user_id !== msg.user_id;

                const partyName = msg.profiles?.party_name?.trim().toUpperCase();
                const partyLogo = partyName ? PARTY_LOGOS[partyName] : null;
                const isOrganizer = msg.profiles?.user_type === 'organizer';
                const canModerate = profile?.user_type === 'organizer';

                return (
                  <div key={msg.id} className={`flex items-start gap-3 max-w-[90%] animate-in fade-in slide-in-from-bottom-2 duration-300 group/msg ${isMe ? 'flex-row-reverse ml-auto' : ''}`}>
                    <div className="relative shrink-0 select-none">
                      <img 
                        alt={msg.profiles?.name} 
                        className={`w-7 h-7 rounded-lg shadow-sm object-cover ${showHeader ? 'opacity-100' : 'opacity-0 h-0 mt-0 lg:h-7 lg:mt-1'} ${isOrganizer ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`} 
                        src={msg.profiles?.photo_url || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=100&auto=format&fit=crop"} 
                      />
                      {showHeader && partyLogo && !isMe && !isOrganizer && (
                         <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-white rounded-md p-0.5 shadow-md border border-slate-50 overflow-hidden">
                           <img src={partyLogo} className="w-full h-full object-contain" />
                         </div>
                      )}
                      {showHeader && isOrganizer && !isMe && (
                         <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-md flex items-center justify-center shadow-md border border-white">
                           <Shield className="w-2 h-2 text-white fill-current" />
                         </div>
                      )}
                    </div>
                    <div className={`flex flex-col ${isMe ? 'items-end' : ''}`}>
                      {showHeader && (
                        <div className={`flex items-baseline gap-2 mb-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                          <span className={`font-headline font-bold text-[10px] ${isMe ? 'text-[#ac3509]' : isOrganizer ? 'text-amber-600' : 'text-[#13298f]'} flex items-center gap-2`}>
                            {isMe ? 'You' : msg.profiles?.name}
                            {isOrganizer && (
                              <span className="text-[7px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full font-black uppercase tracking-widest border border-amber-200">
                                Admin
                              </span>
                            )}
                          </span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tight">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <div className={`p-2.5 rounded-2xl shadow-sm border ${
                          isMe ? 
                          'bg-[#3042a6] text-white rounded-tr-none border-transparent shadow-indigo-200/50' : 
                          isOrganizer ?
                          'bg-amber-50/50 text-[#191c1e] rounded-tl-none border-amber-200 shadow-amber-100/50' :
                          'bg-white text-[#191c1e] rounded-tl-none border-slate-100'
                        }`}>
                          <p className="leading-snug text-xs font-medium">{msg.content}</p>
                        </div>
                        {canModerate && (
                          <button 
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="opacity-0 group-hover/msg:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                            title="Redact Message"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="px-4 py-3 bg-white border-t border-slate-50 mb-0">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative flex items-center">
            <div className="flex-1 relative">
              <input 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="w-full bg-slate-50 border-0 rounded-2xl py-3 pl-4 pr-12 focus:ring-2 focus:ring-[#13298f]/10 focus:bg-white transition-all text-xs font-medium placeholder:text-slate-400 shadow-inner" 
                placeholder={`Address the ${activeChannel}...`} 
                type="text"
              />
              <button 
                type="submit"
                disabled={!newMessage.trim()}
                className="absolute right-2 top-2 bottom-2 aspect-square bg-[#13298f] text-white rounded-xl flex items-center justify-center hover:scale-105 transition-all shadow-lg shadow-indigo-900/40 disabled:opacity-20 disabled:scale-100 disabled:shadow-none"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Right Participant Sidebar */}
      <aside className="hidden xl:flex flex-col w-64 bg-white border-l border-slate-50 p-6 overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between mb-6">
           <h2 className="font-headline font-extrabold text-[#191c1e] text-sm tracking-tight">Active</h2>
           <div className="bg-emerald-50 text-emerald-600 text-[8px] px-2 py-1 rounded-full font-black uppercase tracking-widest flex items-center gap-1.5">
             <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div>
             {activeProfiles.length}
           </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-[9px] uppercase tracking-[0.25em] font-black text-slate-300 mb-4 flex items-center gap-2">
               {activeChannel === 'global' ? 'DELEGATE BODY' : 
                activeChannel === 'party' ? 'PARTY CAUCUS' : 
                'SECRETARIAT'}
            </h3>
            <div className="space-y-4">
              {activeProfiles.filter(p => {
                const isNotMe = p.id !== user?.id;
                if (!isNotMe) return false;

                if (activeChannel === 'global') return true;
                if (activeChannel === 'party') return p.party_number === profile?.party_number;
                if (activeChannel === 'organizer') return p.user_type === 'organizer';
                return true;
              }).map(participant => {
                const partyName = participant.party_name?.trim().toUpperCase();
                const partyLogo = partyName ? PARTY_LOGOS[partyName] : null;

                return (
                  <div key={participant.id} className="flex items-center gap-3 group cursor-pointer hover:bg-slate-50 p-1.5 -m-1.5 rounded-xl transition-all">
                    <div className="relative shrink-0">
                      <img src={participant.photo_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop"} className="w-9 h-9 rounded-xl object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all shadow-sm" />
                      {partyLogo ? (
                         <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-md p-0.5 shadow-md border border-slate-50 overflow-hidden">
                           <img src={partyLogo} className="w-full h-full object-contain" />
                         </div>
                      ) : (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-slate-200 border-2 border-white rounded-full"></span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#191c1e] group-hover:text-[#13298f] transition-colors truncate">{participant.name}</p>
                      <p className="text-[8px] text-slate-400 font-black uppercase tracking-tighter truncate w-24">
                        {participant.user_type === 'organizer' ? 'Moderator' : (participant.party_name || participant.city || 'District National')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default GlobalSquare;

const CheckCircle2 = ({ className }: { className?: string }) => (
  <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2"/>
    <path d="M8.5 12.5L10.5 14.5L15.5 9.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
