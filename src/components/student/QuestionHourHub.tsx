import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  TrendingUp, 
  CheckCircle2, 
  Lightbulb, 
  Edit3, 
  MessageCircle, 
  HelpCircle, 
  ChevronUp, 
  MessageSquare, 
  User, 
  Loader2, 
  Pencil, 
  Trash2, 
  X,
  Hash,
  Trophy,
  Building,
  MapPin,
  School,
  FileSearch,
  Gavel,
  Rocket
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import GlassmorphismProfileCard from './GlassmorphismProfileCard';
import { PageHeader } from './PageHeader';

interface Question {
  id: string;
  user_id: string;
  ministry: string;
  content: string;
  status: 'pending' | 'addressed' | 'rejected';
  answer?: string;
  created_at: string;
  profiles: any;
  votes_count: number;
  user_has_voted: boolean;
}

// Mapping of ministries to visual assets
const MINISTRY_IMAGES: Record<string, string> = {
  'Ministry of Education': 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=200&auto=format&fit=crop',
  'Ministry of Environment & Climate': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=200&auto=format&fit=crop',
  'Ministry of Youth Affairs': 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=200&auto=format&fit=crop',
  'Ministry of Digital Transformation': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=200&auto=format&fit=crop',
  'Default': 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?q=80&w=200&auto=format&fit=crop'
};

export const QuestionHourHub = () => {
  const { user, profile } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ministryProfiles, setMinistryProfiles] = useState<any[]>([]);
  const [questionContent, setQuestionContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<'trending' | 'recent'>('trending');
  const [ministryFilter, setMinistryFilter] = useState<string>('All Portfolios');
  const [selectedMinistry, setSelectedMinistry] = useState('Ministry of Education');
  const [selectedProfile, setSelectedProfile] = useState<any>(null);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const { data: qs, error } = await supabase
        .from('questions')
        .select(`*, profiles (*)`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: ministers } = await supabase
        .from('profiles')
        .select('*')
        .or('position.ilike.%Minister%,position.ilike.%Speaker%,position.ilike.%Secretary%');
      
      setMinistryProfiles(ministers || []);

      const { data: votes } = await supabase
        .from('question_votes')
        .select('question_id, user_id');

      const processed: Question[] = (qs || []).map(q => {
        const qVotes = votes?.filter(v => v.question_id === q.id) || [];
        const profileData = Array.isArray(q.profiles) ? q.profiles[0] : q.profiles;
        
        return {
          ...q,
          profiles: profileData,
          votes_count: qVotes.length,
          user_has_voted: qVotes.some(v => v.user_id === user?.id)
        };
      });

      if (viewFilter === 'trending') {
        processed.sort((a, b) => b.votes_count - a.votes_count);
      }

      setQuestions(processed);
    } catch (err: any) {
      console.error('Error fetching questions:', err);
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
    const channel = supabase
      .channel('public:questions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => fetchQuestions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'question_votes' }, () => fetchQuestions())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, viewFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !questionContent.trim()) return;

    setSubmitting(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('questions')
          .update({
            ministry: selectedMinistry,
            content: questionContent,
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Question updated successfully');
      } else {
        const { error } = await supabase
          .from('questions')
          .insert({
            user_id: user.id,
            ministry: selectedMinistry,
            content: questionContent,
            status: 'pending'
          });

        if (error) throw error;
        toast.success('Question submitted to the assembly');
      }

      setQuestionContent('');
      setEditingId(null);
    } catch (err: any) {
      toast.error('Failed to process question');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('questions').delete().eq('id', deleteId);
      if (error) throw error;
      toast.success('Question retracted');
    } catch (err: any) {
      toast.error('Failed to retract question');
    } finally {
      setDeleteId(null);
    }
  };

  const handleVote = async (questionId: string, hasVoted: boolean) => {
    if (!user) return;
    try {
      if (hasVoted) {
        await supabase.from('question_votes').delete().eq('question_id', questionId).eq('user_id', user.id);
      } else {
        await supabase.from('question_votes').insert({ question_id: questionId, user_id: user.id });
      }
    } catch (err: any) {
      toast.error('Protocol error');
    }
  };

  const filteredQuestions = questions.filter(q => 
    q.status === 'pending' && (ministryFilter === 'All Portfolios' || q.ministry === ministryFilter)
  );
  const addressedQuestions = questions.filter(q => q.status === 'addressed');

  return (
    <div className="flex flex-col animate-fade-in">
      <PageHeader 
        title="Question Hour"
        subtitle="Legislative Question Protocol"
        icon={HelpCircle}
        actions={
          <div className="flex bg-surface-container-low p-1.5 rounded-full ambient-shadow">
            <button 
              onClick={() => setViewFilter('trending')}
              className={`px-6 py-2 rounded-full font-headline font-black text-label-xs uppercase tracking-widest transition-all duration-300 ${viewFilter === 'trending' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-on-surface-variant/40 hover:text-on-surface-variant'}`}
            >
              Trending
            </button>
            <button 
              onClick={() => setViewFilter('recent')}
              className={`px-6 py-2 rounded-full font-headline font-black text-label-xs uppercase tracking-widest transition-all duration-300 ${viewFilter === 'recent' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-on-surface-variant/40 hover:text-on-surface-variant'}`}
            >
              Recent
            </button>
          </div>
        }
        rightElement={
          <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-black uppercase tracking-widest">Floor Open</span>
          </div>
        }
      />

      {/* Main Content Layout */}
      <div className="flex-grow flex flex-col lg:flex-row">
        
        {/* Left Column: Form Sidebar */}
        <aside className="w-full lg:w-[360px] bg-surface-container-low overflow-y-auto no-scrollbar shrink-0 p-4 lg:p-6 border-r border-outline-variant/10">
          <div className="space-y-8">
            <div>
              <h2 className="text-display-sm font-headline font-black text-primary tracking-tight mb-2 uppercase italic">Formal Question</h2>
              <p className="text-on-surface-variant/60 font-medium text-body-xs leading-relaxed">Submit a precise question to the executive ministries for deliberation.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Target Portfolio</label>
                <select 
                  value={selectedMinistry}
                  onChange={(e) => setSelectedMinistry(e.target.value)}
                  className="w-full bg-surface-container-high border-none rounded-2xl py-3.5 px-5 text-on-surface focus:ring-4 focus:ring-primary/5 transition-all font-bold appearance-none cursor-pointer text-sm"
                >
                  <option>Ministry of Education</option>
                  <option>Ministry of Finance & Economy</option>
                  <option>Ministry of Environment & Climate</option>
                  <option>Ministry of Technology & Innovation</option>
                  <option>Ministry of Youth Affairs</option>
                  <option>Ministry of Digital Transformation</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Legislative Query</label>
                <textarea 
                  value={questionContent}
                  onChange={(e) => setQuestionContent(e.target.value)}
                  className="w-full bg-surface-container-high border-none rounded-2xl py-4 px-5 text-on-surface focus:ring-4 focus:ring-primary/5 transition-all font-bold placeholder:text-slate-400 min-h-[160px] resize-none text-sm leading-relaxed" 
                  placeholder="State your question with parliamentary precision..."
                ></textarea>
              </div>

              <Button 
                type="submit"
                disabled={submitting}
                className="w-full py-5 rounded-full bg-primary text-on-primary font-headline font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-primary/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 h-auto"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    {editingId ? 'Update Question' : 'Seal & Submit'}
                    <Send className="w-4 h-4 opacity-70" />
                  </>
                )}
              </Button>

              {editingId && (
                <button 
                  type="button"
                  onClick={() => { setEditingId(null); setQuestionContent(''); }}
                  className="w-full text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-red-500 py-2"
                >
                  Discard Changes
                </button>
              )}
            </form>

            <div className="p-6 bg-surface-container-high rounded-[24px] border-none ambient-shadow">
              <div className="flex items-center gap-3 mb-3 text-primary">
                <Gavel className="w-4 h-4" />
                <span className="text-label-xs font-black uppercase tracking-[0.2em]">Protocol Notice</span>
              </div>
              <p className="text-body-xs text-on-surface-variant/70 leading-relaxed font-medium">Questions should be constructive and focus on policy deliberation. Inflammatory or non-parliamentary language will be retracted by the Speaker.</p>
            </div>
          </div>
        </aside>

        {/* Right Column: Feed Area */}
        <main className="flex-1 bg-transparent p-4 lg:p-6 lg:pt-0">
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Horizontal Filter Bar */}
            <div className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar">
              {['All Portfolios', 'Education', 'Finance & Economy', 'Environment', 'Technology', 'Youth Affairs', 'Digital'].map(m => {
                const full = m === 'All Portfolios' ? m : `Ministry of ${m}`;
                const isActive = ministryFilter === full;
                return (
                  <button
                    key={m}
                    onClick={() => setMinistryFilter(full)}
                    className={`whitespace-nowrap px-5 py-2.5 rounded-xl font-headline font-black text-[10px] uppercase tracking-widest transition-all duration-300 ${isActive ? 'bg-primary text-on-primary shadow-lg shadow-primary/10' : 'bg-surface-container-lowest text-slate-400 hover:text-primary hover:bg-surface-container'}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            {/* Questions Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-headline font-black text-primary uppercase text-label-sm tracking-[0.3em]">Deliberation Floor</h3>
                <span className="text-label-xs font-black text-on-surface-variant/40 uppercase tracking-widest">{filteredQuestions.length} Questions Pending</span>
              </div>

              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center bg-surface-container-lowest rounded-3xl border border-outline-variant/15 border-dashed">
                  <Loader2 className="w-10 h-10 animate-spin text-primary/20" />
                </div>
              ) : filteredQuestions.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center bg-surface-container-lowest rounded-3xl border border-outline-variant/15 border-dashed text-center px-8">
                  <div className="w-12 h-12 bg-surface-container-low rounded-2xl flex items-center justify-center text-slate-300 mb-4">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-headline font-black text-slate-300 uppercase tracking-tight">No Active Questions</h4>
                  <p className="text-slate-400 text-xs mt-2 max-w-xs mx-auto leading-relaxed">Be the first to initiate a question into the {ministryFilter.replace('Ministry of ', '')} portfolio.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {filteredQuestions.map(q => (
                    <motion.div 
                      layout
                      key={q.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-surface-container-lowest p-8 rounded-[32px] shadow-sm hover:shadow-2xl hover:scale-[1.01] transition-all duration-700 group border-none ambient-shadow relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                          <Avatar 
                            className="w-10 h-10 rounded-xl ring-4 ring-surface-container-lowest cursor-pointer hover:ring-primary/10 transition-all"
                            onClick={() => setSelectedProfile(q.profiles)}
                          >
                            <AvatarImage src={MINISTRY_IMAGES[q.ministry] || MINISTRY_IMAGES['Default']} />
                            <AvatarFallback>{q.ministry[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-black text-primary text-[9px] uppercase tracking-[0.2em] mb-1">{q.ministry}</p>
                            <h4 
                              className="text-sm font-headline font-black text-on-surface cursor-pointer hover:text-primary transition-colors flex items-center gap-1.5"
                              onClick={() => setSelectedProfile(q.profiles)}
                            >
                              {q.profiles?.name || 'National Delegate'}
                            </h4>
                          </div>
                        </div>

                        {q.user_id === user?.id && (
                          <div className="flex items-center gap-2 bg-surface-container-high p-1 rounded-xl">
                            <button onClick={(e) => { e.stopPropagation(); setEditingId(q.id); setSelectedMinistry(q.ministry); setQuestionContent(q.content); }} className="p-2 rounded-lg text-on-surface-variant/40 hover:text-primary hover:bg-surface transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setDeleteId(q.id)} className="p-2 rounded-lg text-on-surface-variant/40 hover:text-red-500 hover:bg-surface transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </div>

                      <p className="text-headline-sm font-headline font-black text-on-surface leading-tight mb-8 tracking-tight uppercase italic">
                        "{q.content}"
                      </p>

                      <div className="flex items-center gap-4 pt-4 border-t border-surface-container-high">
                        <button 
                          onClick={() => handleVote(q.id, q.user_has_voted)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all ${q.user_has_voted ? 'bg-primary text-on-primary shadow-lg shadow-primary/10' : 'bg-surface-container-low text-on-surface-variant/50 hover:bg-surface-container'}`}
                        >
                          <TrendingUp className={`w-3.5 h-3.5 ${q.user_has_voted ? 'animate-bounce' : ''}`} />
                          <span className="font-black text-[10px] uppercase tracking-widest">{q.votes_count} Seconds</span>
                        </button>
                        <span className="text-[9px] font-black text-on-surface-variant/20 uppercase tracking-widest ml-auto">{new Date(q.created_at).toLocaleDateString()}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Addressed Section */}
              {addressedQuestions.length > 0 && (
                <div className="space-y-6 pt-10">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="font-headline font-black text-emerald-600 uppercase text-[10px] tracking-[0.3em] flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3" /> Archive of Answers
                    </h3>
                  </div>
                  {addressedQuestions.map(q => {
                    const minister = ministryProfiles.find(p => {
                      const pos = p.position?.toLowerCase() || '';
                      const qMin = q.ministry?.toLowerCase() || '';
                      return qMin.includes(pos.split(' ')[0]); // Simple heuristic
                    });
                    
                    return (
                      <div key={q.id} className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-emerald-100/50 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 px-4 py-1.5 bg-emerald-500 text-white text-[8px] font-black rounded-bl-2xl tracking-widest">VERIFIED</div>
                        
                        <div className="flex items-center gap-3 mb-4 opacity-60">
                          <Avatar className="w-8 h-8 rounded-lg">
                            <AvatarImage src={MINISTRY_IMAGES[q.ministry] || MINISTRY_IMAGES['Default']} />
                          </Avatar>
                          <div>
                            <p className="font-black text-emerald-600 text-[8px] uppercase tracking-widest mb-0.5">{q.ministry}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">{q.profiles?.name || 'Anonymous'}</p>
                          </div>
                        </div>
 
                        <h4 className="text-sm font-headline font-black text-slate-700 mb-6 italic">"{q.content}"</h4>
 
                        <div className="bg-emerald-50/50 p-5 rounded-2xl border-l-4 border-emerald-500 flex gap-4">
                          <Avatar className="w-10 h-10 rounded-2xl ring-4 ring-white shadow-lg shrink-0">
                            <AvatarImage src={minister?.photo_url || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=100&auto=format&fit=crop"} />
                          </Avatar>
                          <div>
                            <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Official Response: {minister?.name || 'The Executive'}</p>
                            <p className="text-on-surface font-bold text-xs leading-relaxed opacity-90 italic">
                              "{q.answer || "Protocol completed. Answer logged in parliamentary record."}"
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-8 max-w-md">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 mb-5">
              <Trash2 className="w-8 h-8" />
            </div>
            <AlertDialogHeader className="space-y-3">
              <AlertDialogTitle className="text-xl font-headline font-black text-[#191c1e] tracking-tight">Retract Question?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500 font-medium text-sm leading-relaxed">
                This question will be permanently removed from the parliamentary archives. This action is irreversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-8 flex flex-col md:flex-row gap-3 w-full">
              <AlertDialogCancel className="w-full rounded-xl border-slate-200 font-black text-[10px] uppercase tracking-widest h-12">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete}
                className="w-full rounded-xl bg-red-500 hover:bg-red-600 text-white font-black text-[10px] uppercase tracking-widest h-12 shadow-xl shadow-red-500/20"
              >
                Retract
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Profile Modal */}
      <Dialog open={!!selectedProfile} onOpenChange={() => setSelectedProfile(null)}>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-0 shadow-none">
          {selectedProfile && <GlassmorphismProfileCard student={selectedProfile} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuestionHourHub;
