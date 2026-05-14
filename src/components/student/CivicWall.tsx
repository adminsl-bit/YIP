import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { PageHeader } from './PageHeader';
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
import { 
  Image as ImageIcon, 
  Video, 
  BarChart3, 
  MessageSquare, 
  ThumbsUp, 
  Share2, 
  MoreHorizontal, 
  Play,
  Trophy,
  TrendingUp,
  Search,
  CheckCircle2,
  Settings,
  Loader2,
  Trash2,
  Pencil,
  X
} from 'lucide-react';

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
  };
  _count?: {
    likes: number;
    comments: number;
  };
}

export const CivicWall = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  
  // Media State
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [activeMediaType, setActiveMediaType] = useState<'image' | 'video' | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const [isExpanded, setIsExpanded] = useState(false);
  const postingAreaRef = useRef<HTMLDivElement>(null);

  // Edit/Delete State
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Delete Confirmation State
  const [deleteConfirmId, setDeleteConfirmId] = useState<{id: string, type: 'post' | 'comment'} | null>(null);

  // Interaction State
  const [activeCommentInputPostId, setActiveCommentInputPostId] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('civic_posts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'civic_posts' }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (postingAreaRef.current && !postingAreaRef.current.contains(event.target as Node)) {
        if (!newPostContent.trim() && !mediaUrl && !isPosting) {
          setIsExpanded(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [newPostContent, mediaUrl, isPosting]);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('civic_posts')
        .select(`
          *,
          profiles:user_id (
            name,
            photo_url,
            position,
            state
          ),
          civic_likes(user_id),
          civic_comments(
            id,
            user_id,
            content,
            created_at,
            profiles:user_id (name, photo_url, position)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data as any[] || []);
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = posts.filter(post => {
    const query = searchQuery.toLowerCase();
    const contentMatch = post.content.toLowerCase().includes(query);
    const nameMatch = post.profiles?.name?.toLowerCase().includes(query);
    const posMatch = post.profiles?.position?.toLowerCase().includes(query);
    return contentMatch || nameMatch || posMatch;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingMedia(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/civic_wall_${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('civic_media')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('civic_media').getPublicUrl(path);
      setMediaUrl(data.publicUrl);
      setActiveMediaType(type);
      
      toast({ 
        title: "Media attached", 
        description: `${type === 'image' ? 'Photo' : 'Video'} is ready to post.` 
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({ 
        title: "Upload failed", 
        description: "Ensure the 'civic_media' bucket exists with proper RLS policies.", 
        variant: "destructive" 
      });
    } finally {
      setIsUploadingMedia(false);
      if (e.target) e.target.value = '';
    }
  };

  const handlePostSubmit = async () => {
    if ((!newPostContent.trim() && !mediaUrl) || !user) return;

    setIsPosting(true);
    try {
      const { error } = await supabase.from('civic_posts').insert({
        user_id: user.id,
        content: newPostContent,
        media_url: mediaUrl || null,
        media_type: activeMediaType || null
      });

      if (error) throw error;

      setNewPostContent('');
      setMediaUrl('');
      setActiveMediaType(null);
      
      toast({
        title: "Post Published",
        description: "Your update is now live on the Civic Wall.",
      });
      fetchPosts();
    } catch (err: any) {
      toast({
        title: "Posting Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleLikeToggle = async (postId: string) => {
    if (!user) return;
    
    // Check if liked
    const { data: existingLike } = await supabase
      .from('civic_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .single();

    try {
      if (existingLike) {
        await supabase.from('civic_likes').delete().eq('id', existingLike.id);
      } else {
        await supabase.from('civic_likes').insert({ post_id: postId, user_id: user.id });
      }
      fetchPosts();
    } catch (err) {
      console.error("Like error:", err);
    }
  };

  const handleCommentSubmit = async (postId: string, content: string) => {
    if (!user || !content.trim()) return;

    try {
      const { error } = await supabase.from('civic_comments').insert({
        post_id: postId,
        user_id: user.id,
        content
      });
      if (error) throw error;
      fetchPosts();
    } catch (err: any) {
      toast({ title: "Comment failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const { error } = await supabase.from('civic_posts').delete().eq('id', postId);
      if (error) throw error;

      toast({ title: "Post Deleted", description: "Your post has been removed." });
      setDeleteConfirmId(null);
      fetchPosts();
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleUpdatePost = async (postId: string) => {
    if (!editContent.trim()) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase.from('civic_posts').update({
        content: editContent
      }).eq('id', postId);

      if (error) throw error;

      setEditingPostId(null);
      toast({ title: "Post Updated", description: "Your changes have been saved." });
      await fetchPosts();
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase.from('civic_comments').delete().eq('id', commentId);
      if (error) throw error;
      fetchPosts();
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    }
  };

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');

  const handleUpdateComment = async (commentId: string) => {
    if (!editCommentContent.trim()) return;
    try {
      const { error } = await supabase.from('civic_comments').update({ content: editCommentContent }).eq('id', commentId);
      if (error) throw error;
      setEditingCommentId(null);
      fetchPosts();
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">Synchronizing Feed...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col animate-fade-in">
      <div className="flex justify-end mb-6">
        <div className="relative group w-64 md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/20 w-3.5 h-3.5 transition-all duration-500 group-focus-within:text-primary group-focus-within:scale-110" />
          <input 
            className="w-full bg-surface-container-low/50 backdrop-blur-md border border-outline-variant/10 rounded-2xl py-2.5 pl-10 pr-4 focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary/20 text-[10px] transition-all duration-500 placeholder:text-on-surface-variant/20 font-headline font-black uppercase tracking-[0.05em] text-on-surface shadow-inner" 
            placeholder="Search the assembly feed..." 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-grow bg-transparent">
        <div className="w-full mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Central Feed (9 Cols) */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          {/* Create Post Area - Separated into its own card */}
          <div 
            ref={postingAreaRef}
            className={`bg-surface-container-lowest rounded-[28px] shadow-2xl shadow-primary/5 border border-outline-variant/10 p-5 relative overflow-hidden transition-all duration-500 group/compose ${isExpanded ? 'bg-white/90 ring-4 ring-primary/5' : 'hover:bg-white/60'}`}
          >
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary font-headline font-black shadow-sm overflow-hidden flex-shrink-0 border border-outline-variant/10 group-hover/compose:scale-105 transition-transform duration-500">
                  {profile?.photo_url ? (
                    <img src={profile.photo_url} className="w-full h-full object-cover" alt="Profile" />
                  ) : (
                    profile?.name?.charAt(0) || 'U'
                  )}
                </div>
                <div className="flex-grow pt-0.5">
                  <div 
                    className={`relative transition-all duration-500 ${isExpanded ? 'min-h-[80px]' : 'min-h-[40px]'}`}
                    onClick={() => !isExpanded && setIsExpanded(true)}
                  >
                    <textarea 
                      className={`w-full border-none focus:ring-0 focus:outline-none text-[13px] font-body font-medium placeholder:text-on-surface-variant/30 resize-none bg-transparent py-2.5 px-0 text-on-surface transition-all duration-500 ${isExpanded ? 'min-h-[80px]' : 'min-h-[40px] cursor-pointer'}`} 
                      placeholder="Share an update with the assembly..." 
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      onFocus={() => setIsExpanded(true)}
                    />
                    
                    {!isExpanded && !newPostContent && !mediaUrl && (
                       <div className="absolute right-0 top-1/2 -translate-y-1/2 flex gap-4 pr-1">
                         <button 
                           onClick={(e) => { 
                             e.stopPropagation(); 
                             photoInputRef.current?.click(); 
                             setIsExpanded(true); 
                           }} 
                           className="text-on-surface-variant/30 hover:text-primary transition-all duration-300 hover:scale-110"
                           title="Attach Image"
                         >
                           <ImageIcon className="w-4.5 h-4.5" />
                         </button>
                         <button 
                           onClick={(e) => { 
                             e.stopPropagation(); 
                             videoInputRef.current?.click(); 
                             setIsExpanded(true); 
                           }} 
                           className="text-on-surface-variant/30 hover:text-primary transition-all duration-300 hover:scale-110"
                           title="Attach Video"
                         >
                           <Video className="w-4.5 h-4.5" />
                         </button>
                       </div>
                    )}
                  </div>
                  
                  {/* Media Preview / Upload State */}
                  {(isUploadingMedia || mediaUrl) && (
                    <div className="mt-4 animate-in fade-in slide-in-from-top-4 duration-500">
                      {isUploadingMedia ? (
                        <div className="bg-surface-container/30 rounded-[20px] p-8 flex flex-col items-center justify-center space-y-3 border border-dashed border-outline-variant/20">
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          <p className="text-[9px] text-on-surface-variant/40 font-headline font-black uppercase tracking-[0.2em]">Optimizing Content...</p>
                        </div>
                      ) : mediaUrl ? (
                        <div className="relative rounded-[20px] overflow-hidden group shadow-xl border border-outline-variant/10 max-w-md">
                          {activeMediaType === 'image' ? (
                            <img src={mediaUrl} className="w-full max-h-[280px] object-cover" alt="Preview" />
                          ) : (
                            <div className="w-full h-[180px] bg-slate-900 flex items-center justify-center">
                              <Video className="w-10 h-10 text-white/30" />
                              <p className="text-white text-[9px] font-headline font-black ml-4 uppercase tracking-[0.2em]">Video Attached</p>
                            </div>
                          )}
                          <button 
                            onClick={() => {
                              setMediaUrl('');
                              setActiveMediaType(null);
                            }}
                            className="absolute top-4 right-4 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center backdrop-blur-md hover:bg-black/60 hover:scale-110 transition-all duration-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                  
                  {/* Expanded Actions */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-outline-variant/5 flex justify-between items-center animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => photoInputRef.current?.click()}
                          disabled={isUploadingMedia}
                          className={`flex items-center gap-2.5 px-4 py-2 rounded-xl transition-all duration-300 font-headline font-black text-[9px] uppercase tracking-wider group ${activeMediaType === 'image' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container text-on-surface-variant/40'}`}
                        >
                          <ImageIcon className={`w-3.5 h-3.5 transition-transform group-hover:rotate-12 ${activeMediaType === 'image' ? 'text-primary' : 'text-primary/30'}`} /> 
                          Photo
                        </button>
                        <button 
                          onClick={() => videoInputRef.current?.click()}
                          disabled={isUploadingMedia}
                          className={`flex items-center gap-2.5 px-4 py-2 rounded-xl transition-all duration-300 font-headline font-black text-[9px] uppercase tracking-wider group ${activeMediaType === 'video' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container text-on-surface-variant/40'}`}
                        >
                          <Video className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${activeMediaType === 'video' ? 'text-primary' : 'text-primary/30'}`} /> 
                          Video
                        </button>
                      </div>
                      
                      <div className="flex gap-3 items-center">
                        {!newPostContent && !mediaUrl && (
                          <Button 
                            variant="ghost" 
                            onClick={() => setIsExpanded(false)}
                            className="h-9 px-5 rounded-xl font-headline font-black text-[9px] uppercase tracking-wider text-on-surface-variant/30 hover:bg-surface-container transition-all"
                          >
                            Cancel
                          </Button>
                        )}
                        <Button 
                          onClick={handlePostSubmit}
                          disabled={isPosting || isUploadingMedia || (!newPostContent.trim() && !mediaUrl)}
                          className="bg-primary hover:bg-primary/90 text-on-primary px-6 h-9 rounded-xl font-headline font-black shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-500 disabled:opacity-30 disabled:translate-y-0 text-[9px] uppercase tracking-widest"
                        >
                          {isPosting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Publish'}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Hidden File Inputs */}
                  <input 
                    type="file" 
                    ref={photoInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'image')}
                  />
                  <input 
                    type="file" 
                    ref={videoInputRef}
                    className="hidden"
                    accept="video/*"
                    onChange={(e) => handleFileUpload(e, 'video')}
                  />
                </div>
            </div>
            </div>

          {/* Feed Section - Separated cards for each post */}
          <div className="space-y-4">
              {filteredPosts.length === 0 ? (
                <div className="p-24 text-center">
                  <div className="w-20 h-20 bg-surface-container rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <Trophy className="w-10 h-10 text-on-surface-variant/20" />
                  </div>
                  <h3 className="text-xl font-headline font-black text-on-surface mb-3 uppercase tracking-tight">
                    {searchQuery ? "No Matches Found" : "The Assembly is Quiet"}
                  </h3>
                  <p className="text-on-surface-variant/50 font-body font-medium max-w-sm mx-auto text-sm leading-relaxed">
                    {searchQuery 
                      ? `We couldn't find any results for "${searchQuery}". Try searching for different keywords or members.` 
                      : "Be the first to share an update with the assembly."}
                  </p>
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <article key={post.id} className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-outline-variant/5 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 group/post flex flex-col space-y-3 relative hover:z-10">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-xl bg-surface-container overflow-hidden border border-outline-variant/10 shadow-sm">
                            {post.profiles?.photo_url ? (
                              <img alt={post.profiles.name} className="w-full h-full object-cover transition-transform duration-500 group-hover/post:scale-110" src={post.profiles.photo_url} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-headline font-black text-xl text-primary bg-primary/5">
                                {post.profiles?.name?.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#6ffbbe] rounded-full border-[3px] border-surface-container-lowest flex items-center justify-center shadow-sm">
                            <div className="w-1.5 h-1.5 bg-[#005236] rounded-full"></div>
                          </div>
                        </div>
                        <div className="pt-0.5">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-headline font-black text-[13px] text-on-surface leading-none tracking-tight">{post.profiles?.name}</h3>
                            <span className="text-primary font-headline font-black uppercase text-[8px] tracking-[0.1em] bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">{post.profiles?.position}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-on-surface-variant/30 font-headline font-bold text-[8px] uppercase tracking-wider">
                              {formatDistanceToNow(new Date(post.created_at))} ago
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-8 h-8 rounded-xl hover:bg-surface-container-high text-on-surface-variant/20 hover:text-primary transition-all duration-500 flex items-center justify-center border border-transparent hover:border-outline-variant/10">
                            <MoreHorizontal className="w-5 h-5" />
                          </button>
                        </DropdownMenuTrigger>
                        {post.user_id === user?.id && (
                          <DropdownMenuContent align="end" className="bg-white rounded-2xl p-2 shadow-2xl border border-outline-variant/10 min-w-[180px] animate-in fade-in zoom-in-95 duration-200">
                            <DropdownMenuItem 
                              onClick={() => {
                                setEditingPostId(post.id);
                                setEditContent(post.content);
                              }}
                              className="flex items-center gap-3 px-4 py-3 text-[10px] font-headline font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-low rounded-xl cursor-pointer transition-colors"
                            >
                              <Pencil className="w-4 h-4 text-primary" /> Edit Post
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setDeleteConfirmId({ id: post.id, type: 'post' })}
                              className="flex items-center gap-3 px-4 py-3 text-[10px] font-headline font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-xl cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-4 h-4" /> Delete Post
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        )}
                      </DropdownMenu>
                    </div>
                    
                    <div className="font-body font-medium leading-relaxed text-sm text-on-surface/80 whitespace-pre-wrap px-1 mb-1 transition-colors duration-500 group-hover/post:text-on-surface">
                      {editingPostId === post.id ? (
                        <div className="space-y-4 bg-surface-container-low/50 p-6 rounded-[24px] border border-outline-variant/10">
                          <textarea
                            className="w-full bg-white border-none rounded-2xl p-6 text-sm font-body font-medium min-h-[120px] focus:ring-2 focus:ring-primary/10 text-on-surface shadow-inner"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                          />
                          <div className="flex gap-3 justify-end">
                            <Button 
                              variant="ghost" 
                              onClick={() => setEditingPostId(null)}
                              className="text-[10px] font-headline font-black uppercase tracking-widest text-on-surface-variant/50 hover:bg-white px-6 h-10 rounded-full"
                            >
                              Cancel
                            </Button>
                            <Button 
                              onClick={() => handleUpdatePost(post.id)}
                              disabled={isUpdating}
                              className="bg-primary text-on-primary h-10 px-8 rounded-full text-[10px] font-headline font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                            >
                              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                              Update Post
                            </Button>
                          </div>
                        </div>
                      ) : (
                        post.content
                      )}
                    </div>
                    
                    {post.media_url && (
                      <div className="rounded-[12px] overflow-hidden shadow-md shadow-primary/5 aspect-auto max-h-[140px] relative group/media border border-outline-variant/10 transition-all duration-1000 hover:border-primary/10">
                        <img alt="Post media" className="w-full h-full object-contain bg-surface-container-low transition-transform duration-1000 group-hover/media:scale-105" src={post.media_url} />
                        {post.media_type === 'video' && (
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/media:opacity-100 transition-opacity duration-700 backdrop-blur-[2px]">
                             <div className="w-12 h-12 bg-white/10 backdrop-blur-3xl rounded-full flex items-center justify-center border border-white/20 scale-75 group-hover/media:scale-100 transition-all duration-1000 shadow-xl">
                                <Play className="text-white w-5 h-5 fill-white ml-0.5 drop-shadow-2xl" />
                             </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="pt-1 flex flex-col gap-2">
                      <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
                        <div className="flex items-center gap-8">
                          <button 
                            onClick={() => handleLikeToggle(post.id)}
                            className={`flex items-center gap-3 transition-all duration-500 group ${
                              (post as any).civic_likes?.some((l: any) => l.user_id === user?.id) 
                                ? 'text-primary' 
                                : 'text-on-surface-variant/30 hover:text-primary'
                            }`}
                          >
                            <div className={`p-2 rounded-xl transition-all duration-500 border border-transparent ${
                              (post as any).civic_likes?.some((l: any) => l.user_id === user?.id) 
                                ? 'bg-primary/10 border-primary/20 shadow-lg shadow-primary/5' 
                                : 'bg-surface-container-low group-hover:bg-primary/5 group-hover:border-primary/10'
                            }`}>
                              <ThumbsUp className={`w-4 h-4 transition-all duration-500 group-hover:scale-110 group-active:scale-90 ${
                                (post as any).civic_likes?.some((l: any) => l.user_id === user?.id) ? 'fill-primary' : ''
                              }`} />
                            </div>
                            <span className="font-headline font-black text-[11px] uppercase tracking-widest">
                              {(post as any).civic_likes?.length || 0}
                            </span>
                          </button>
                          <button 
                            onClick={() => setActiveCommentInputPostId(activeCommentInputPostId === post.id ? null : post.id)}
                            className={`flex items-center gap-3 transition-all duration-500 group ${
                              activeCommentInputPostId === post.id ? 'text-primary' : 'text-on-surface-variant/30 hover:text-primary'
                            }`}
                          >
                            <div className={`p-2 rounded-xl transition-all duration-500 border border-transparent ${
                              activeCommentInputPostId === post.id 
                                ? 'bg-primary/10 border-primary/20 shadow-lg shadow-primary/5' 
                                : 'bg-surface-container-low group-hover:bg-primary/5 group-hover:border-primary/10'
                            }`}>
                              <MessageSquare className={`w-4 h-4 transition-all duration-500 group-hover:-rotate-12 group-active:scale-90 ${
                                activeCommentInputPostId === post.id ? 'fill-primary' : ''
                              }`} />
                            </div>
                            <span className="font-headline font-black text-[11px] uppercase tracking-widest transition-colors duration-500">
                              {(post as any).civic_comments?.length || 0}
                            </span>
                          </button>
                        </div>
                        
                        <div className="flex -space-x-3 overflow-hidden">
                          {(post as any).civic_likes?.slice(0, 3).map((like: any, i: number) => (
                            <div key={i} className="inline-block h-8 w-8 rounded-full ring-4 ring-surface-container-lowest bg-surface-container flex items-center justify-center text-[10px] font-headline font-black text-primary border border-outline-variant/10">
                              {i === 0 ? 'M' : i === 1 ? 'S' : 'A'}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Comment Section */}
                      <div className="space-y-3">
                        {(post as any).civic_comments?.map((comment: any) => (
                          <div key={comment.id} className="flex gap-4 items-start group/comment animate-in fade-in slide-in-from-left-4 duration-500">
                            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex-shrink-0 flex items-center justify-center text-[11px] font-headline font-black text-primary overflow-hidden shadow-sm border border-outline-variant/10">
                              {comment.profiles?.photo_url ? (
                                <img src={comment.profiles.photo_url} className="w-full h-full object-cover" alt="Profile" />
                              ) : comment.profiles?.name?.charAt(0)}
                            </div>
                            <div className="flex-grow pt-0.5">
                              <div className="flex items-center justify-between gap-4 mb-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-headline font-black text-on-surface tracking-tight">{comment.profiles?.name}</span>
                                  <span className="w-1 h-1 bg-outline-variant/30 rounded-full"></span>
                                  <span className="text-[9px] font-headline font-bold text-on-surface-variant/30 uppercase tracking-widest">
                                    {formatDistanceToNow(new Date(comment.created_at))} ago
                                  </span>
                                </div>
                                
                                {comment.user_id === user?.id && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="w-8 h-8 rounded-lg opacity-0 group-hover/comment:opacity-100 hover:bg-surface-container-high text-on-surface-variant/30 hover:text-primary transition-all duration-300 flex items-center justify-center">
                                        <MoreHorizontal className="w-4 h-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-white rounded-xl p-1 shadow-2xl border border-outline-variant/10 min-w-[140px]">
                                      <DropdownMenuItem 
                                        onClick={() => {
                                          setEditingCommentId(comment.id);
                                          setEditCommentContent(comment.content);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 text-[9px] font-headline font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-low rounded-lg cursor-pointer transition-colors"
                                      >
                                        <Pencil className="w-3.5 h-3.5 text-primary" /> Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => setDeleteConfirmId({ id: comment.id, type: 'comment' })}
                                        className="flex items-center gap-2 px-3 py-2 text-[9px] font-headline font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                              
                              {editingCommentId === comment.id ? (
                                <div className="flex flex-col gap-3 mt-3 bg-white p-4 rounded-2xl shadow-inner border border-outline-variant/10">
                                  <input 
                                    className="w-full bg-transparent border-none p-0 text-sm font-body font-medium focus:ring-0 text-on-surface"
                                    value={editCommentContent}
                                    onChange={(e) => setEditCommentContent(e.target.value)}
                                    autoFocus
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <Button 
                                      variant="ghost"
                                      onClick={() => setEditingCommentId(null)}
                                      className="h-8 px-4 text-[9px] font-headline font-black uppercase tracking-widest hover:bg-surface-container-low rounded-full"
                                    >
                                      Cancel
                                    </Button>
                                    <Button 
                                      onClick={() => handleUpdateComment(comment.id)}
                                      className="h-8 px-5 bg-primary text-on-primary text-[9px] font-headline font-black uppercase tracking-widest rounded-full shadow-lg shadow-primary/10"
                                    >
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-on-surface-variant/80 font-body font-medium leading-relaxed max-w-2xl">{comment.content}</p>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        {activeCommentInputPostId === post.id && (
                          <div className="flex gap-4 pt-4 border-t border-outline-variant/5 animate-in slide-in-from-top-2 duration-300">
                             <div className="w-10 h-10 rounded-xl bg-surface-container flex-shrink-0 flex items-center justify-center text-[11px] font-headline font-black text-on-surface-variant/30 overflow-hidden shadow-inner border border-outline-variant/10">
                                {profile?.photo_url ? <img src={profile.photo_url} className="w-full h-full object-cover" alt="Profile" /> : profile?.name?.charAt(0)}
                             </div>
                             <div className="flex-grow relative group">
                               <input 
                                 placeholder="Add a comment..."
                                 className="w-full bg-surface-container-low border-none rounded-2xl px-6 py-3 text-xs font-headline font-black uppercase tracking-widest placeholder:text-on-surface-variant/20 focus:ring-2 focus:ring-primary/10 text-on-surface transition-all duration-300 shadow-inner group-hover:bg-surface-container-high/50"
                                 autoFocus
                                 onKeyDown={(e) => {
                                   if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                     handleCommentSubmit(post.id, e.currentTarget.value);
                                     e.currentTarget.value = '';
                                     setActiveCommentInputPostId(null);
                                   }
                                 }}
                               />
                               <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                 <span className="text-[8px] font-headline font-black text-on-surface-variant/20 uppercase tracking-[0.2em] opacity-0 group-focus-within:opacity-100 transition-opacity">Press Enter to Send</span>
                               </div>
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))
              )}
          </div>
        </div>

        {/* Right Sidebar (3 Cols) */}
        <aside className="hidden lg:block lg:col-span-3 space-y-8">
          {/* Rules of Engagement Card */}
          <div className="bg-primary text-on-primary p-5 rounded-[28px] shadow-2xl shadow-primary/30 border border-white/10 relative overflow-hidden group transition-all duration-700 hover:shadow-primary/40 hover:-translate-y-1">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-primary-container/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000"></div>
            
            <div className="flex items-center gap-4 mb-5 relative">
              <div className="w-11 h-11 bg-white/10 backdrop-blur-xl rounded-xl flex items-center justify-center border border-white/20 shadow-2xl group-hover:rotate-6 transition-transform duration-700">
                <CheckCircle2 className="w-5 h-5 text-[#6ffbbe]" />
              </div>
              <h4 className="font-headline font-black text-lg tracking-tight leading-tight uppercase">Rules of the House</h4>
            </div>
 
            <div className="space-y-4 relative">
              <div className="flex gap-4 group/rule">
                <span className="flex-shrink-0 w-7 h-7 rounded-xl bg-white/10 backdrop-blur-lg text-[#6ffbbe] flex items-center justify-center text-[10px] font-headline font-black border border-white/10 transition-all duration-500 group-hover/rule:bg-[#6ffbbe] group-hover/rule:text-[#005236] group-hover/rule:rotate-12">01</span>
                <p className="text-[12px] font-body font-bold text-on-primary/70 leading-relaxed group-hover/rule:text-on-primary transition-colors">Maintain <span className="text-[#6ffbbe]">Parliamentary Decorum</span>—keep debates professional.</p>
              </div>
              <div className="flex gap-4 group/rule">
                <span className="flex-shrink-0 w-7 h-7 rounded-xl bg-white/10 backdrop-blur-lg text-[#6ffbbe] flex items-center justify-center text-[10px] font-headline font-black border border-white/10 transition-all duration-500 group-hover/rule:bg-[#6ffbbe] group-hover/rule:text-[#005236] group-hover/rule:rotate-12">02</span>
                <p className="text-[12px] font-body font-bold text-on-primary/70 leading-relaxed group-hover/rule:text-on-primary transition-colors">Focus on <span className="text-[#6ffbbe]">Policy</span>, not people. Attacks are prohibited.</p>
              </div>
              <div className="flex gap-4 group/rule">
                <span className="flex-shrink-0 w-7 h-7 rounded-xl bg-white/10 backdrop-blur-lg text-[#6ffbbe] flex items-center justify-center text-[10px] font-headline font-black border border-white/10 transition-all duration-500 group-hover/rule:bg-[#6ffbbe] group-hover/rule:text-[#005236] group-hover/rule:rotate-12">03</span>
                <p className="text-[12px] font-body font-bold text-on-primary/70 leading-relaxed group-hover/rule:text-on-primary transition-colors">Use <span className="text-[#6ffbbe]">Evidence</span>. Back updates with local data.</p>
              </div>
              <div className="flex gap-4 group/rule">
                <span className="flex-shrink-0 w-7 h-7 rounded-xl bg-white/10 backdrop-blur-lg text-[#6ffbbe] flex items-center justify-center text-[10px] font-headline font-black border border-white/10 transition-all duration-500 group-hover/rule:bg-[#6ffbbe] group-hover/rule:text-[#005236] group-hover/rule:rotate-12">04</span>
                <p className="text-[12px] font-body font-bold text-on-primary/70 leading-relaxed group-hover/rule:text-on-primary transition-colors">Quality over quantity. No <span className="text-[#6ffbbe]">Spamming</span>—keep it high-fidelity.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
      {/* Global Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-surface-container-lowest rounded-[40px] border border-outline-variant/10 shadow-[0_40px_80px_-15px_rgba(19,41,143,0.12)] p-12 max-w-lg animate-in fade-in zoom-in-95 duration-500 backdrop-blur-3xl">
          <AlertDialogHeader className="space-y-4">
            <div className="w-16 h-16 bg-red-50 rounded-[24px] flex items-center justify-center mb-2 animate-bounce-subtle">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <AlertDialogTitle className="text-3xl font-headline font-black text-on-surface uppercase tracking-tight leading-none">
              Discard this {deleteConfirmId?.type === 'post' ? 'Post' : 'Comment'}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-on-surface-variant/60 font-body font-medium text-lg leading-relaxed">
              This action is permanent within the <span className="text-primary font-bold">National Assembly</span>. Are you absolutely certain you wish to retract this contribution?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-10 flex gap-4 sm:justify-end">
            <AlertDialogCancel className="rounded-full px-10 h-14 border-outline-variant/20 text-on-surface-variant/40 font-headline font-black uppercase text-[10px] tracking-[0.2em] hover:bg-surface-container transition-all duration-300">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (deleteConfirmId?.type === 'post') handleDeletePost(deleteConfirmId.id);
                else if (deleteConfirmId?.type === 'comment') handleDeleteComment(deleteConfirmId.id);
              }}
              className="rounded-full px-12 h-14 bg-red-500 hover:bg-red-600 text-white font-headline font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-red-500/20 hover:shadow-red-500/40 hover:-translate-y-1 active:translate-y-0 transition-all duration-300"
            >
              Confirm Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
