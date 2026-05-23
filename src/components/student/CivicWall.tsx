import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, 
  Loader2, 
  Clock, 
  Globe,
  CheckCircle2,
  Search,
  Pencil,
  X,
  Play,
  Video as VideoIcon,
  Image as ImageIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface Post {
  id: string;
  content: string;
  media_url: string | null;
  media_type: 'image' | 'video' | 'poll' | null;
  created_at: string;
  user_id: string;
  profiles: {
    name: string;
    photo_url: string | null;
    position: string;
    state: string | null;
    serial_number?: string;
    party_number?: number;
  };
  civic_likes?: any[];
  civic_comments?: any[];
}

export const CivicWall = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<{id: string, type: 'post' | 'comment'} | null>(null);

  useEffect(() => {
    fetchPosts();
    const channel = supabase
      .channel('civic_posts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'civic_posts' }, fetchPosts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('civic_posts')
      .select(`
        *,
        profiles:user_id (name, photo_url, position, state, serial_number, party_number),
        civic_likes(user_id),
        civic_comments(id, user_id, content, created_at, profiles:user_id (name, photo_url, position))
      `)
      .order('created_at', { ascending: false });

    if (!error) setPosts(data as any[] || []);
    setLoading(false);
  };

  const handleCreatePost = async () => {
    if (!newPost.trim() || !user) return;
    setIsPosting(true);
    const { error } = await supabase.from('civic_posts').insert({
      user_id: user.id,
      content: newPost
    });
    if (!error) {
      setNewPost('');
      fetchPosts();
      toast({ title: "Broadcast Successful", description: "Your motion has been added to the assembly wall." });
    }
    setIsPosting(false);
  };

  const handleLikePost = async (postId: string) => {
    if (!user) return;
    const { data: existing } = await supabase.from('civic_likes').select('id').eq('post_id', postId).eq('user_id', user.id).single();
    if (existing) {
      await supabase.from('civic_likes').delete().eq('id', existing.id);
    } else {
      await supabase.from('civic_likes').insert({ post_id: postId, user_id: user.id });
    }
    fetchPosts();
  };

  const handleDeletePost = async (id: string) => {
    await supabase.from('civic_posts').delete().eq('id', id);
    setDeleteConfirmId(null);
    fetchPosts();
  };

  const filteredPosts = posts.filter(p => p.content.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>;

  return (
    <div className="flex flex-col max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-16">
        <div>
          <h1 className="font-display font-black text-display-sm text-on-surface tracking-tighter uppercase italic leading-none">Civic Wall</h1>
          <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-4 flex items-center gap-2">
            <Globe className="w-3.5 h-3.5" />
            National Legislative Discourse
          </p>
        </div>
        
        <div className="relative group w-full lg:w-96">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-on-surface-variant/30 w-5 h-5 transition-colors group-focus-within:text-primary" />
          <input 
            className="w-full bg-surface-container-high/50 border-none rounded-2xl py-5 pl-16 pr-8 text-body-md focus:ring-4 focus:ring-primary/5 focus:bg-surface-container-lowest transition-all outline-none font-medium placeholder:text-on-surface-variant/20 shadow-sm" 
            placeholder="Search the assembly..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-grow bg-transparent">
        <div className="w-full mx-auto">
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-8 space-y-10">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface-container-lowest rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-primary/5 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-[80px]"></div>
                <div className="flex gap-6 relative z-10">
                  <Avatar className="h-14 w-14 rounded-2xl border-4 border-surface shadow-md">
                    <AvatarImage src={profile?.photo_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-xl">{profile?.name?.charAt(0) || 'D'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-6">
                    <h3 className="text-title-md font-display font-black text-on-surface uppercase tracking-tight italic">Address the Grand Assembly</h3>
                    <Textarea 
                      placeholder="What is your motion, Delegate?" 
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      className="min-h-[140px] bg-surface-container-low/50 border-none rounded-2xl p-6 text-body-md font-medium shadow-inner focus:ring-2 focus:ring-primary/5 transition-all resize-none"
                    />
                    <div className="flex justify-end pt-2">
                      <Button 
                        onClick={handleCreatePost} 
                        disabled={isPosting || !newPost.trim()} 
                        className="bg-primary hover:bg-primary_container text-on-primary h-14 px-10 rounded-xl font-display font-black uppercase text-[11px] tracking-[0.25em] shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        {isPosting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-3" /> Broadcast Post</>}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>

                <div className="space-y-8">
                  <AnimatePresence>
                    {filteredPosts.map((post) => (
                      <motion.article 
                        key={post.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-surface-container-lowest rounded-[2.5rem] p-8 md:p-10 shadow-md hover:shadow-xl shadow-primary/5 transition-all duration-500 group"
                      >
                        <div className="flex items-start gap-6">
                          <Avatar className="h-14 w-14 rounded-2xl border-4 border-surface shadow-sm">
                            <AvatarImage src={post.profiles?.photo_url || undefined} />
                            <AvatarFallback>{post.profiles?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-display font-black text-title-md text-on-surface uppercase italic tracking-tight">{post.profiles?.name}</h4>
                                <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] mt-1">{post.profiles?.position}</p>
                              </div>
                              {post.user_id === user?.id && (
                                <button 
                                  onClick={() => setDeleteConfirmId({id: post.id, type: 'post'})} 
                                  className="p-3 hover:bg-red-50 rounded-xl text-red-500/20 hover:text-red-500 transition-all"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                            <div className="py-6">
                              <p className="text-body-md font-medium text-on-surface/80 leading-relaxed tracking-tight">{post.content}</p>
                            </div>
                            <div className="flex items-center gap-8 pt-6 border-t border-outline-variant/10">
                              <button 
                                onClick={() => handleLikePost(post.id)} 
                                className="flex items-center gap-2 group/like"
                              >
                                <Heart className={`w-5 h-5 transition-all ${post.civic_likes?.some(l => l.user_id === user?.id) ? 'fill-secondary text-secondary scale-110' : 'text-on-surface-variant/20 group-hover/like:text-secondary'}`} />
                                <span className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant/40">{post.civic_likes?.length || 0}</span>
                              </button>
                              <div className="text-[10px] font-black text-on-surface-variant/20 uppercase flex items-center gap-2 tracking-widest">
                                <Clock className="w-3.5 h-3.5" />
                                {formatDistanceToNow(new Date(post.created_at))} ago
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.article>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              <aside className="lg:col-span-4 space-y-8 sticky top-24">
                <div className="bg-surface-container-low/50 rounded-[2.5rem] p-10 border border-outline-variant/10 shadow-sm">
                   <div className="flex items-center gap-5 mb-8">
                     <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center"><Globe className="w-5 h-5 text-primary" /></div>
                     <div>
                       <h4 className="text-title-sm font-display font-black uppercase italic tracking-tight">National Pulse</h4>
                       <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.3em] mt-1">Status Report</p>
                     </div>
                   </div>
                   <p className="text-body-sm text-on-surface-variant/60 font-medium leading-relaxed">
                     The Civic Wall serves as the central repository for legislative discourse and regional reporting.
                   </p>
                </div>
                
                <div className="bg-primary text-on-primary p-10 rounded-[2.5rem] shadow-2xl shadow-primary/20 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                  <div className="flex items-center gap-5 mb-8 relative z-10">
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-on-primary" /></div>
                    <h4 className="text-title-md font-display font-black uppercase italic tracking-tight">House Rules</h4>
                  </div>
                  <div className="space-y-6 relative z-10">
                    {[
                      "Maintain Parliamentary Decorum.",
                      "Focus on Policy, not personas.",
                      "Back motions with evidence."
                    ].map((rule, i) => (
                      <div key={i} className="flex gap-4 items-center">
                        <span className="text-[10px] font-black opacity-30 tracking-widest">0{i+1}</span>
                        <p className="text-body-sm font-bold opacity-80">{rule}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-surface-container-lowest border-none rounded-[2.5rem] p-10 max-w-lg shadow-2xl">
          <AlertDialogHeader className="space-y-4">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-2">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <AlertDialogTitle className="font-display font-black text-headline-sm text-on-surface uppercase tracking-tight leading-none italic">
              Discard this {deleteConfirmId?.type === 'post' ? 'Post' : 'Comment'}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-body-md text-on-surface-variant/60 leading-relaxed font-medium">
              This action is permanent within the <span className="text-primary font-black">National Assembly</span>. Are you absolutely certain you wish to retract this contribution?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-10 flex flex-col sm:flex-row gap-4 sm:justify-end">
            <AlertDialogCancel className="rounded-xl px-10 h-12 border-none bg-surface-container-low text-on-surface-variant font-display font-black uppercase text-[10px] tracking-[0.2em] hover:bg-surface-container transition-all">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (deleteConfirmId?.type === 'post') handleDeletePost(deleteConfirmId.id);
              }}
              className="rounded-xl px-12 h-12 bg-red-500 hover:bg-red-600 text-white font-display font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-red-500/20 transition-all"
            >
              Confirm Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
