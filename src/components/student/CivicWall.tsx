import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { executeOrQueue } from '@/lib/executeOrQueue';
import { formatDistanceToNow } from 'date-fns';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    name: string;
    photo_url: string | null;
    position: string;
  } | null;
}

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
  } | null;
  civic_likes?: { user_id: string }[];
  civic_comments?: Comment[];
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
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<{id: string, type: 'post' | 'comment'} | null>(null);

  // Media Attachment States & Refs
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedType, setAttachedType] = useState<'image' | 'video' | null>(null);
  const [attachedUrl, setAttachedUrl] = useState<string | null>(null);

  // Video embed states
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [videoSource, setVideoSource] = useState<'upload' | 'embed'>('upload');
  const [videoUrlInput, setVideoUrlInput] = useState('');

  // Image Cropping States & Refs
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [isCropDragging, setIsCropDragging] = useState(false);
  const [cropDragStart, setCropDragStart] = useState({ x: 0, y: 0 });
  const [cropFileName, setCropFileName] = useState("post_image.png");
  const [cropping, setCropping] = useState(false);
  const cropImgRef = useRef<HTMLImageElement>(null);

  // Dynamic measuring and natural sizing states to guarantee 100% perfect crop math
  const [cropperDimensions, setCropperDimensions] = useState({ width: 480, height: 270 });
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });
  const cropperContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showCropper) return;
    const measure = () => {
      if (cropperContainerRef.current) {
        const rect = cropperContainerRef.current.getBoundingClientRect();
        if (rect.width > 0) {
          setCropperDimensions({
            width: rect.width,
            height: rect.width * 9 / 16
          });
        }
      }
    };
    
    // Measure at multiple layout frames to capture the fully settled responsive width
    measure();
    const t1 = setTimeout(measure, 50);
    const t2 = setTimeout(measure, 150);
    const t3 = setTimeout(measure, 300);
    
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', measure);
    };
  }, [showCropper, imageToCrop]);

  const hasSize = imgNaturalSize.width > 0 && imgNaturalSize.height > 0;
  const baseScale = hasSize
    ? Math.max(cropperDimensions.width / imgNaturalSize.width, cropperDimensions.height / imgNaturalSize.height)
    : 1;

  // Video Embed URL Helpers
  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const getInstagramId = (url: string) => {
    const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const isYoutubeUrl = (url: string) => !!getYoutubeId(url);
  const isInstagramUrl = (url: string) => !!getInstagramId(url);

  const handleCropMouseDown = (e: React.MouseEvent) => {
    setIsCropDragging(true);
    setCropDragStart({ x: e.clientX - cropPosition.x, y: e.clientY - cropPosition.y });
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isCropDragging || !hasSize) return;
    
    const containerW = cropperDimensions.width;
    const containerH = cropperDimensions.height;
    
    const currentScale = baseScale * cropZoom;
    const currentWidth = imgNaturalSize.width * currentScale;
    const currentHeight = imgNaturalSize.height * currentScale;
    
    const maxX = Math.max(0, (currentWidth - containerW) / 2);
    const maxY = Math.max(0, (currentHeight - containerH) / 2);
    
    const newX = e.clientX - cropDragStart.x;
    const newY = e.clientY - cropDragStart.y;
    
    setCropPosition({
      x: Math.max(-maxX, Math.min(maxX, newX)),
      y: Math.max(-maxY, Math.min(maxY, newY))
    });
  };

  const handleCropTouchMove = (e: React.TouchEvent) => {
    if (!isCropDragging || !hasSize || e.touches.length !== 1) return;
    
    const containerW = cropperDimensions.width;
    const containerH = cropperDimensions.height;
    
    const currentScale = baseScale * cropZoom;
    const currentWidth = imgNaturalSize.width * currentScale;
    const currentHeight = imgNaturalSize.height * currentScale;
    
    const maxX = Math.max(0, (currentWidth - containerW) / 2);
    const maxY = Math.max(0, (currentHeight - containerH) / 2);
    
    const newX = e.touches[0].clientX - cropDragStart.x;
    const newY = e.touches[0].clientY - cropDragStart.y;
    
    setCropPosition({
      x: Math.max(-maxX, Math.min(maxX, newX)),
      y: Math.max(-maxY, Math.min(maxY, newY))
    });
  };

  const handleCropMouseUp = () => setIsCropDragging(false);

  const handleApplyCrop = async () => {
    if (!hasSize || !imageToCrop || !cropImgRef.current || !cropperContainerRef.current) return;
    try {
      setCropping(true);

      // Read the exact rendered positions from the DOM at the moment of crop.
      // This avoids any mismatch between the cropperDimensions state and the actual
      // rendered size, ensuring the output exactly matches the preview.
      const imgRect = cropImgRef.current.getBoundingClientRect();
      const containerRect = cropperContainerRef.current.getBoundingClientRect();

      // Visual offset of the image's top-left corner relative to the container
      const imgOffsetX = imgRect.left - containerRect.left;
      const imgOffsetY = imgRect.top - containerRect.top;

      // Scale factors from visual pixels to natural image pixels
      const scaleX = imgNaturalSize.width / imgRect.width;
      const scaleY = imgNaturalSize.height / imgRect.height;

      // The crop source rectangle in natural image coordinates
      const sourceX = Math.max(0, -imgOffsetX * scaleX);
      const sourceY = Math.max(0, -imgOffsetY * scaleY);
      const sourceW = Math.min(imgNaturalSize.width - sourceX, containerRect.width * scaleX);
      const sourceH = Math.min(imgNaturalSize.height - sourceY, containerRect.height * scaleY);

      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 675;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      // 9-arg drawImage: extract the visible source rect and stretch it to fill the output canvas
      ctx.drawImage(cropImgRef.current, sourceX, sourceY, sourceW, sourceH, 0, 0, 1200, 675);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], cropFileName.replace(/\.[^/.]+$/, "") + ".png", { type: 'image/png' });
          setAttachedFile(file);
          setAttachedType('image');
          setAttachedUrl(null);
          setShowCropper(false);
          setImageToCrop(null);
          setImgNaturalSize({ width: 0, height: 0 });
        }
        setCropping(false);
      }, 'image/png');
    } catch (err) {
      console.error("Cropping failed", err);
      setCropping(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'image' && !file.type.startsWith('image/')) {
      toast({ title: "Invalid File", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (type === 'video' && !file.type.startsWith('video/')) {
      toast({ title: "Invalid File", description: "Please select a video file.", variant: "destructive" });
      return;
    }

    const limitMB = type === 'video' ? 10 : 5;
    if (file.size > limitMB * 1024 * 1024) {
      toast({ title: "File Too Large", description: `Maximum size is ${limitMB} MB for ${type}s.`, variant: "destructive" });
      return;
    }

    if (type === 'image') {
      const reader = new FileReader();
      reader.onload = () => {
        setCropFileName(file.name);
        setImageToCrop(reader.result as string);
        setCropZoom(1);
        setCropPosition({ x: 0, y: 0 });
        setImgNaturalSize({ width: 0, height: 0 });
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
      if (imageInputRef.current) imageInputRef.current.value = '';
    } else {
      setAttachedFile(file);
      setAttachedType(type);
      setAttachedUrl(null);
    }
  };

  useEffect(() => {
    fetchPosts();
    const channel = supabase
      .channel('civic_wall_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'civic_posts' }, fetchPosts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'civic_likes' }, fetchPosts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'civic_comments' }, fetchPosts)
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
      .eq('event_id', profile?.event_id ?? '')
      .order('created_at', { ascending: false });

    if (!error) setPosts(data as any[] || []);
    setLoading(false);
  };

  const handleCreatePost = async () => {
    if ((!newPost.trim() && !attachedFile && !attachedUrl) || !user) return;
    setIsPosting(true);

    let mediaUrl: string | null = attachedUrl;
    let mediaType: 'image' | 'video' | null = attachedType;

    if (attachedFile) {
      if (!navigator.onLine) {
        toast({ title: "Offline", description: "Posts with photos or videos need a connection. Try a text-only post, or wait until you're back online.", variant: "destructive" });
        setIsPosting(false);
        return;
      }
      try {
        const ext = attachedFile.name.split('.').pop();
        const path = `${user.id}/${Date.now()}_post.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('civic_media')
          .upload(path, attachedFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('civic_media').getPublicUrl(path);
        mediaUrl = data.publicUrl;
      } catch (err: any) {
        toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
        setIsPosting(false);
        return;
      }
    }

    const id = crypto.randomUUID();
    const { error, queued } = await executeOrQueue({
      table: 'civic_posts',
      type: 'insert',
      payload: { id, user_id: user.id, content: newPost, media_url: mediaUrl, media_type: mediaType },
      description: 'Civic Wall post',
    });

    if (!error) {
      const postedContent = newPost;
      setNewPost('');
      setAttachedFile(null);
      setAttachedType(null);
      setAttachedUrl(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
      if (queued) {
        setPosts(prev => [{
          id,
          content: postedContent,
          media_url: mediaUrl,
          media_type: mediaType,
          created_at: new Date().toISOString(),
          user_id: user.id,
          profiles: profile as any,
          civic_likes: [],
          civic_comments: [],
        }, ...prev]);
        toast({ title: "Saved offline", description: "Your post will be broadcast once you're back online." });
      } else {
        fetchPosts();
        toast({ title: "Broadcast Successful", description: "Your motion has been added to the assembly wall." });
      }
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setIsPosting(false);
  };

  const handleLikePost = async (postId: string) => {
    if (!user) return;
    const alreadyLiked = posts.find(p => p.id === postId)?.civic_likes?.some(l => l.user_id === user.id);

    const { queued } = await executeOrQueue(
      alreadyLiked
        ? { table: 'civic_likes', type: 'delete', payload: {}, match: { post_id: postId, user_id: user.id }, description: 'Remove acknowledgement' }
        : { table: 'civic_likes', type: 'insert', payload: { post_id: postId, user_id: user.id }, description: 'Acknowledge post' }
    );

    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      civic_likes: alreadyLiked
        ? (p.civic_likes ?? []).filter(l => l.user_id !== user.id)
        : [...(p.civic_likes ?? []), { user_id: user.id }],
    } : p));

    if (!queued) fetchPosts();
  };

  const handleDeletePost = async (id: string) => {
    const { error } = await supabase.from('civic_posts').delete().eq('id', id);
    if (!error) {
      setDeleteConfirmId(null);
      fetchPosts();
      toast({ title: "Motion Dismissed", description: "Your post has been removed from the assembly wall." });
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleCreateComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text || !user) return;
    setIsSubmittingComment(true);
    const id = crypto.randomUUID();
    const { error, queued } = await executeOrQueue({
      table: 'civic_comments',
      type: 'insert',
      payload: { id, post_id: postId, user_id: user.id, content: text },
      description: 'Civic Wall comment',
    });
    if (!error) {
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      if (queued) {
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          civic_comments: [...(p.civic_comments ?? []), {
            id,
            user_id: user.id,
            content: text,
            created_at: new Date().toISOString(),
            profiles: profile as any,
          }],
        } : p));
        toast({ title: "Saved offline", description: "Your comment will sync once you're back online." });
      } else {
        fetchPosts();
        toast({ title: "Comment Broadcasted", description: "Your perspective is now visible to the assembly." });
      }
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setIsSubmittingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase.from('civic_comments').delete().eq('id', commentId);
    if (!error) {
      fetchPosts();
      toast({ title: "Comment Discarded", description: "Your perspective has been retracted." });
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleCommentInputChange = (postId: string, val: string) => {
    setCommentInputs(prev => ({ ...prev, [postId]: val }));
  };

  const filteredPosts = posts.filter(p => p.content.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) return <div className="flex justify-center py-24"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Title & Search row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">Civic <span className="text-secondary">Wall</span></h1>
          <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
            <span className="material-symbols-outlined text-[12px]">public</span>
            National Legislative Discourse
          </p>
        </div>
        
        <div className="relative group w-full lg:w-80">
          <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/30 text-[18px] transition-colors group-focus-within:text-primary">search</span>
          <input 
            className="w-full bg-surface-container-high/50 border-none rounded-xl py-3 pl-12 pr-6 text-sm focus:ring-4 focus:ring-primary/5 focus:bg-surface-container-lowest transition-all outline-none font-medium placeholder:text-on-surface-variant/20 shadow-sm" 
            placeholder="Search the assembly..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-grow bg-transparent">
        <div className="w-full mx-auto">
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Central Feed Column */}
              <div className="lg:col-span-8 space-y-6">
                {/* Create Post Box */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface-container-lowest rounded-3xl p-6 shadow-[0_32px_64px_-12px_rgba(19,41,143,0.06)] border-none"
                >
                  <input 
                    type="file" 
                    ref={imageInputRef} 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => handleFileChange(e, 'image')} 
                  />
                  <input 
                    type="file" 
                    ref={videoInputRef} 
                    accept="video/*" 
                    className="hidden" 
                    onChange={(e) => handleFileChange(e, 'video')} 
                  />

                  <div className="flex gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary-container shrink-0">
                      {profile?.photo_url ? (
                        <img src={profile.photo_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center text-primary font-bold">
                          {profile?.name?.charAt(0) || 'D'}
                        </div>
                      )}
                    </div>
                    <textarea 
                      placeholder={`What's on your mind, ${profile?.name?.split(' ')[0] || 'Delegate'}?`}
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      rows={3}
                      className="flex-1 bg-surface-container-low rounded-2xl px-6 py-4 text-left hover:bg-surface-container-high transition-colors focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 outline-none border border-transparent focus:border-primary/10 resize-none text-sm font-semibold text-gray-800 leading-relaxed"
                    />
                  </div>

                  {attachedFile && (
                    <div className="relative mb-4 rounded-2xl overflow-hidden border border-outline-variant/15 bg-surface-container-low flex items-center justify-center group/preview aspect-video">
                      {attachedType === 'image' ? (
                        <img
                          src={URL.createObjectURL(attachedFile)}
                          alt="Attachment preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video 
                          src={URL.createObjectURL(attachedFile)} 
                          className="max-h-60 w-full object-contain" 
                          controls 
                        />
                      )}
                      <button 
                        onClick={() => {
                          setAttachedFile(null);
                          setAttachedType(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-sm z-10"
                        title="Remove Attachment"
                      >
                        <span className="material-symbols-outlined text-xs leading-none flex items-center">close</span>
                      </button>
                    </div>
                  )}

                  {attachedUrl && attachedType === 'video' && (
                    <div className="relative mb-4 rounded-2xl overflow-hidden border border-outline-variant/15 max-h-60 bg-surface-container-low flex flex-col items-center justify-center p-4 group/preview">
                      <div className="w-full flex items-center gap-3 mb-2">
                        <span className="material-symbols-outlined text-red-500">video_library</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{attachedUrl}</p>
                          <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Embed Video Attached</p>
                        </div>
                      </div>
                      
                      {isYoutubeUrl(attachedUrl) ? (
                        <iframe
                          src={`https://www.youtube.com/embed/${getYoutubeId(attachedUrl)}`}
                          className="w-full h-32 rounded-xl pointer-events-none"
                          tabIndex={-1}
                        />
                      ) : isInstagramUrl(attachedUrl) ? (
                        <div className="w-full h-32 bg-gradient-to-br from-pink-500/10 to-indigo-500/10 flex items-center justify-center text-xs font-bold text-gray-500 rounded-xl">
                          Instagram Reel Embed Preview
                        </div>
                      ) : (
                        <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 rounded-xl">
                          External Video Embed Preview
                        </div>
                      )}

                      <button 
                        onClick={() => {
                          setAttachedUrl(null);
                          setAttachedType(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-sm z-10"
                        title="Remove Attachment"
                      >
                        <span className="material-symbols-outlined text-xs leading-none flex items-center">close</span>
                      </button>
                    </div>
                  )}
                  
                  <div className="h-[1px] bg-outline-variant/15 w-full mb-4"></div>
                  
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full hover:bg-surface-container-high/50 text-on-surface-variant text-sm font-semibold transition-all"
                      >
                        <span className="material-symbols-outlined text-primary text-xl">image</span>
                        <span>Image</span>
                      </button>
                      <button
                        onClick={() => { setVideoSource('upload'); setShowVideoDialog(true); }}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full hover:bg-surface-container-high/50 text-on-surface-variant text-sm font-semibold transition-all"
                      >
                        <span className="material-symbols-outlined text-secondary text-xl">videocam</span>
                        <span>Video</span>
                      </button>
                    </div>
                    <button
                      onClick={handleCreatePost}
                      disabled={isPosting || (!newPost.trim() && !attachedFile && !attachedUrl)}
                      className="bg-gradient-to-br from-primary to-primary-container text-white px-6 sm:px-8 py-2 rounded-full font-bold shadow-md hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
                    >
                      {isPosting ? <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span> : 'Post'}
                    </button>
                  </div>
                </motion.div>

                {/* Feed Items */}
                <div className="space-y-4">
                  <AnimatePresence>
                    {filteredPosts.map((post) => {
                      const isLiked = !!user && !!post.civic_likes?.some(l => l.user_id === user.id);
                      const isExpanded = expandedPost === post.id;
                      
                      return (
                        <motion.article 
                          key={post.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="bg-surface-container-lowest rounded-[2rem] shadow-[0_4px_24px_-4px_rgba(19,41,143,0.06)] overflow-hidden group border-none"
                        >
                          <div className="p-4">
                            {/* Card Header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full overflow-hidden border border-outline-variant/15 shrink-0">
                                  {post.profiles?.photo_url ? (
                                    <img
                                      src={post.profiles.photo_url}
                                      alt={post.profiles.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                                      {post.profiles?.name?.charAt(0) || 'D'}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-headline font-bold text-sm text-on-surface leading-tight">{post.profiles?.name}</h4>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-on-surface-variant/60">
                                      {formatDistanceToNow(new Date(post.created_at))} ago
                                    </span>
                                    <span className="w-1 h-1 bg-outline rounded-full opacity-40"></span>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                      post.profiles?.position?.toLowerCase().includes('organizer') 
                                        ? 'bg-primary/10 text-primary border border-primary/20' 
                                        : 'bg-tertiary/10 text-tertiary border border-tertiary/20'
                                    }`}>
                                      {post.profiles?.position || 'Member of Parliament'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {post.user_id === user?.id && (
                                  <button
                                    onClick={() => setDeleteConfirmId({id: post.id, type: 'post'})}
                                    className="p-2 rounded-full hover:bg-error/10 text-error/50 hover:text-error transition-colors"
                                    title="Delete Post"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Card Content */}
                            <div className="py-1">
                              <p className="text-on-surface leading-relaxed text-sm font-body">{post.content}</p>
                            </div>

                            {/* Media Attachment if present */}
                            {post.media_url && post.media_type === 'image' && (
                              <div className="rounded-2xl overflow-hidden mb-4 border border-outline-variant/15 aspect-video">
                                <img
                                  src={post.media_url}
                                  alt="Post attachment"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                />
                              </div>
                            )}
                            {post.media_url && post.media_type === 'video' && (
                              <div className="relative rounded-2xl overflow-hidden mb-4 aspect-video bg-inverse-surface border border-outline-variant/15 group/video">
                                {isYoutubeUrl(post.media_url) ? (
                                  <iframe
                                    src={`https://www.youtube.com/embed/${getYoutubeId(post.media_url)}`}
                                    className="w-full h-full border-none"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                ) : isInstagramUrl(post.media_url) ? (
                                  <iframe
                                    src={`https://www.instagram.com/p/${getInstagramId(post.media_url)}/embed`}
                                    className="w-full h-full border-none"
                                    allowFullScreen
                                  />
                                ) : (
                                  <>
                                    <video 
                                      src={post.media_url} 
                                      className="w-full h-full object-cover opacity-60 group-hover/video:scale-105 transition-transform duration-1000" 
                                      controls 
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                      <div className="w-20 h-20 rounded-full bg-primary/90 text-on-primary flex items-center justify-center shadow-2xl scale-100 group-hover/video:scale-110 transition-transform duration-300 backdrop-blur-md">
                                        <span className="material-symbols-outlined text-4xl fill-icon" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                                      </div>
                                    </div>
                                    <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between">
                                      <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden mr-4">
                                        <div className="h-full bg-primary-container w-[65%]"></div>
                                      </div>
                                      <span className="text-xs text-white font-bold">Presentation</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Interaction count row */}
                            <div className="flex items-center justify-between py-2 border-b border-outline-variant/10 mb-3 mt-1">
                              <div className="flex items-center gap-2">
                                <div className="flex -space-x-2">
                                  <div className="w-6 h-6 rounded-full bg-primary-container border-2 border-surface-container-lowest flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[10px] text-white fill-icon" style={{ fontVariationSettings: "'FILL' 1" }}>thumb_up</span>
                                  </div>
                                  {post.civic_likes && post.civic_likes.length > 1 && (
                                    <div className="w-6 h-6 rounded-full bg-tertiary border-2 border-surface-container-lowest flex items-center justify-center">
                                      <span className="material-symbols-outlined text-[10px] text-white fill-icon" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs text-on-surface-variant font-medium">
                                  {post.civic_likes && post.civic_likes.length > 0 ? (
                                    isLiked ? (
                                      post.civic_likes.length === 1 ? 'You acknowledged this' : `You and ${post.civic_likes.length - 1} others acknowledged this`
                                    ) : (
                                      `${post.civic_likes.length} ${post.civic_likes.length === 1 ? 'delegate' : 'delegates'} acknowledged this`
                                    )
                                  ) : (
                                    'No acknowledgements yet'
                                  )}
                                </span>
                              </div>
                              <div className="flex gap-4 text-xs text-on-surface-variant">
                                <span>{post.civic_comments?.length || 0} Comments</span>
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center justify-around">
                              <button
                                onClick={() => handleLikePost(post.id)}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl hover:bg-surface-container-high/50 font-bold transition-all text-sm ${
                                  isLiked ? 'text-primary' : 'text-on-surface-variant'
                                }`}
                              >
                                <span
                                  className="material-symbols-outlined text-[18px]"
                                  style={{ fontVariationSettings: isLiked ? "'FILL' 1" : "'FILL' 0" }}
                                >
                                  thumb_up
                                </span>
                                <span>{isLiked ? 'Acknowledged' : 'Acknowledge'}</span>
                              </button>

                              <button
                                onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl hover:bg-surface-container-high/50 font-bold transition-all text-sm ${
                                  isExpanded ? 'text-primary' : 'text-on-surface-variant'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
                                <span>Comment</span>
                              </button>

                            </div>

                            {/* Perspective Comment Drawer */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden mt-2"
                                >
                                  <div className="bg-surface-container-low/50 rounded-2xl p-4 space-y-4">
                                    <div className="text-[9px] font-black text-on-surface-variant/50 tracking-widest uppercase mb-2">
                                      Perspectives ({post.civic_comments?.length || 0})
                                    </div>
                                    
                                    {post.civic_comments && post.civic_comments.length > 0 ? (
                                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                        {post.civic_comments.map((comment) => (
                                          <div key={comment.id} className="flex gap-3 bg-surface-container-lowest p-3 rounded-xl shadow-sm relative group/comment">
                                            <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/10 shrink-0">
                                              {comment.profiles?.photo_url ? (
                                                <img src={comment.profiles.photo_url} alt={comment.profiles.name} className="w-full h-full object-cover" />
                                              ) : (
                                                <div className="w-full h-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                                                  {comment.profiles?.name?.charAt(0) || 'D'}
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-baseline gap-2 flex-wrap">
                                                <span className="font-bold text-xs text-on-surface">{comment.profiles?.name}</span>
                                                <span className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                  {comment.profiles?.position?.split(' ')[0] || 'Delegate'}
                                                </span>
                                                
                                                <div className="ml-auto flex items-center gap-2">
                                                  <span className="text-[9px] text-on-surface-variant/50 font-medium">
                                                    {formatDistanceToNow(new Date(comment.created_at))} ago
                                                  </span>
                                                  {comment.user_id === user?.id && (
                                                    <button
                                                      onClick={() => handleDeleteComment(comment.id)}
                                                      className="p-1 rounded-full hover:bg-error/10 text-error/40 hover:text-error transition-colors opacity-0 group-hover/comment:opacity-100 shrink-0"
                                                      title="Discard Comment"
                                                    >
                                                      <span className="material-symbols-outlined text-[12px]">delete</span>
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{comment.content}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-center py-6 text-xs text-on-surface-variant/40 italic">
                                        No perspectives shared yet. Add yours below.
                                      </div>
                                    )}

                                    {/* New perspective input track */}
                                    <div className="flex items-center gap-3 pt-2 border-t border-outline-variant/10">
                                      <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/10 shrink-0">
                                        {profile?.photo_url ? (
                                          <img src={profile.photo_url} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                                            {profile?.name?.charAt(0) || 'D'}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex-1 flex gap-2">
                                        <input 
                                          type="text" 
                                          placeholder="Share your perspective..."
                                          value={commentInputs[post.id] || ''}
                                          onChange={(e) => handleCommentInputChange(post.id, e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && commentInputs[post.id]?.trim()) {
                                              handleCreateComment(post.id);
                                            }
                                          }}
                                          className="flex-1 bg-surface-container-high rounded-full px-4 py-2 text-xs font-medium focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 outline-none border border-transparent focus:border-primary/10 transition-colors"
                                        />
                                        <button 
                                          onClick={() => handleCreateComment(post.id)}
                                          disabled={isSubmittingComment || !commentInputs[post.id]?.trim()}
                                          className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-primary-container transition-all active:scale-95 disabled:opacity-40"
                                        >
                                          {isSubmittingComment ? <span className="material-symbols-outlined text-[12px] animate-spin">refresh</span> : 'Send'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.article>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>

              {/* Right Sidebar */}
              <aside className="lg:col-span-4 space-y-8 sticky top-24">
                {/* Rules of the House */}
                <div className="bg-primary text-on-primary p-8 rounded-[2rem] shadow-2xl shadow-primary/30 border border-white/10 relative overflow-hidden group transition-all duration-700 hover:shadow-primary/40 hover:-translate-y-1">
                  <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                  <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-primary-container/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000"></div>
                  
                  <div className="flex items-center gap-4 mb-8 relative z-10">
                    <div className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl group-hover:rotate-6 transition-transform duration-700">
                      <span className="material-symbols-outlined text-[24px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    </div>
                    <h4 className="font-display font-bold text-lg tracking-tight uppercase text-white">Rules of the House</h4>
                  </div>
       
                  <div className="space-y-5 relative z-10">
                    <div className="flex gap-4 items-start group/rule">
                      <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/10 backdrop-blur-lg text-white flex items-center justify-center text-[10px] font-display font-black border border-white/10 transition-all duration-500 group-hover/rule:bg-white/20 group-hover/rule:text-white group-hover/rule:rotate-12">01</span>
                      <p className="text-xs font-body font-bold text-white/80 leading-relaxed group-hover/rule:text-white transition-colors">
                        Maintain <span className="text-white font-extrabold underline decoration-white/30">Parliamentary Decorum</span>—keep debates professional.
                      </p>
                    </div>
                    <div className="flex gap-4 items-start group/rule">
                      <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/10 backdrop-blur-lg text-white flex items-center justify-center text-[10px] font-display font-black border border-white/10 transition-all duration-500 group-hover/rule:bg-white/20 group-hover/rule:text-white group-hover/rule:rotate-12">02</span>
                      <p className="text-xs font-body font-bold text-white/80 leading-relaxed group-hover/rule:text-white transition-colors">
                        Focus on <span className="text-white font-extrabold underline decoration-white/30">Policy</span>, not people. Personal attacks are prohibited.
                      </p>
                    </div>
                    <div className="flex gap-4 items-start group/rule">
                      <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/10 backdrop-blur-lg text-white flex items-center justify-center text-[10px] font-display font-black border border-white/10 transition-all duration-500 group-hover/rule:bg-white/20 group-hover/rule:text-white group-hover/rule:rotate-12">03</span>
                      <p className="text-xs font-body font-bold text-white/80 leading-relaxed group-hover/rule:text-white transition-colors">
                        Use <span className="text-white font-extrabold underline decoration-white/30">Evidence</span>. Back your motions with local data.
                      </p>
                    </div>
                    <div className="flex gap-4 items-start group/rule">
                      <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/10 backdrop-blur-lg text-white flex items-center justify-center text-[10px] font-display font-black border border-white/10 transition-all duration-500 group-hover/rule:bg-white/20 group-hover/rule:text-white group-hover/rule:rotate-12">04</span>
                      <p className="text-xs font-body font-bold text-white/80 leading-relaxed group-hover/rule:text-white transition-colors">
                        No <span className="text-white font-extrabold underline decoration-white/30">Spamming</span>—keep contributions high-fidelity.
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>

      {/* Image Cropper Modal */}
      <Dialog open={showCropper} onOpenChange={(open) => {
        if (!open) {
          setShowCropper(false);
          setImageToCrop(null);
          setImgNaturalSize({ width: 0, height: 0 });
        }
      }}>
        <DialogContent className="max-w-xl bg-white p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="text-xl font-bold text-gray-900 font-headline tracking-tight">Crop Post Image</DialogTitle>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div 
              ref={cropperContainerRef}
              className="relative w-full aspect-video bg-slate-900 rounded-[2rem] overflow-hidden cursor-move touch-none select-none border-4 border-slate-50 shadow-inner"
              onMouseMove={handleCropMouseMove}
              onMouseDown={handleCropMouseDown}
              onMouseUp={handleCropMouseUp}
              onMouseLeave={handleCropMouseUp}
              onTouchStart={(e) => {
                if (e.touches.length === 1) {
                  setIsCropDragging(true);
                  setCropDragStart({ x: e.touches[0].clientX - cropPosition.x, y: e.touches[0].clientY - cropPosition.y });
                }
              }}
              onTouchMove={handleCropTouchMove}
              onTouchEnd={() => setIsCropDragging(false)}
            >
              {imageToCrop && (
                <img 
                  ref={cropImgRef}
                  src={imageToCrop}
                  alt="To Crop"
                  className={`absolute left-1/2 top-1/2 max-w-none transition-transform duration-75 ${
                    hasSize ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{
                    transform: `translate(calc(-50% + ${cropPosition.x}px), calc(-50% + ${cropPosition.y}px)) scale(${cropZoom * baseScale})`,
                    transformOrigin: 'center center'
                  }}
                  onLoad={(e) => {
                    setImgNaturalSize({
                      width: e.currentTarget.naturalWidth,
                      height: e.currentTarget.naturalHeight
                    });
                    setCropPosition({ x: 0, y: 0 });
                  }}
                  draggable={false}
                />
              )}
            </div>

            <div className="space-y-4 px-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Zoom</span>
                <span>{Math.round(cropZoom * 100)}%</span>
              </div>
              <Slider 
                value={[cropZoom]} 
                min={1} 
                max={4} 
                step={0.01} 
                onValueChange={([val]) => {
                  setCropZoom(val);
                  setCropPosition(prev => {
                    if (!hasSize) return prev;
                    const containerW = cropperDimensions.width;
                    const containerH = cropperDimensions.height;
                    const currentScale = baseScale * val;
                    const maxX = Math.max(0, (imgNaturalSize.width * currentScale - containerW) / 2);
                    const maxY = Math.max(0, (imgNaturalSize.height * currentScale - containerH) / 2);
                    return {
                      x: Math.max(-maxX, Math.min(maxX, prev.x)),
                      y: Math.max(-maxY, Math.min(maxY, prev.y))
                    };
                  });
                }}
                className="py-4"
              />
            </div>
          </div>

          <DialogFooter className="p-8 pt-0 flex gap-4">
            <button 
              className="flex-1 bg-surface-container-low text-on-surface-variant font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-2xl hover:bg-surface-container transition-all"
              onClick={() => {
                setShowCropper(false);
                setImageToCrop(null);
                setImgNaturalSize({ width: 0, height: 0 });
              }}
            >
              Cancel
            </button>
            <button 
              className="flex-1 bg-gradient-to-br from-primary to-primary-container text-white font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
              onClick={handleApplyCrop}
              disabled={cropping}
            >
              {cropping ? "Applying..." : "Crop & Attach"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent className="max-w-md bg-white p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="text-xl font-bold text-gray-900 font-headline tracking-tight">Add Video to Post</DialogTitle>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => {
                  setShowVideoDialog(false);
                  videoInputRef.current?.click();
                }}
                className="flex flex-col items-center justify-center p-6 bg-surface-container-low hover:bg-surface-container-high rounded-2xl border border-outline-variant/15 transition-all text-center group"
              >
                <span className="material-symbols-outlined text-secondary text-3xl mb-2 group-hover:scale-110 transition-transform">upload</span>
                <span className="text-sm font-bold text-gray-800">Upload File</span>
                <span className="text-[10px] text-gray-400 mt-1 font-medium">MP4, WebM (Max 50MB)</span>
              </button>
              
              <button 
                onClick={() => {
                  setVideoSource('embed');
                }}
                className={`flex flex-col items-center justify-center p-6 rounded-2xl border transition-all text-center group ${
                  videoSource === 'embed' 
                    ? 'bg-primary/5 border-primary text-primary' 
                    : 'bg-surface-container-low hover:bg-surface-container-high border-outline-variant/15 text-gray-800'
                }`}
              >
                <span className="material-symbols-outlined text-primary text-3xl mb-2 group-hover:scale-110 transition-transform">link</span>
                <span className="text-sm font-bold">Embed Link</span>
                <span className="text-[10px] text-gray-400 mt-1 font-medium">YouTube, Instagram</span>
              </button>
            </div>

            {videoSource === 'embed' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Video URL</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Paste YouTube or Instagram link..."
                    value={videoUrlInput}
                    onChange={(e) => setVideoUrlInput(e.target.value)}
                    className="flex-1 bg-surface-container-high rounded-xl px-4 py-2.5 text-sm font-medium focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 outline-none border border-transparent focus:border-primary/10 transition-all"
                  />
                  <button 
                    onClick={() => {
                      if (!videoUrlInput.trim()) return;
                      setAttachedFile(null); // Clear uploaded file
                      setAttachedType('video');
                      setAttachedUrl(videoUrlInput.trim());
                      setVideoUrlInput('');
                      setShowVideoDialog(false);
                    }}
                    className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-primary-container transition-all active:scale-95"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-surface-container-lowest border-none rounded-3xl p-8 max-w-sm shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <div className="w-12 h-12 bg-error/10 rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] text-error">delete</span>
            </div>
            <AlertDialogTitle className="font-headline font-bold text-xl text-gray-900">
              Delete this {deleteConfirmId?.type === 'post' ? 'post' : 'comment'}?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-body text-sm text-gray-500 leading-relaxed">
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6 flex gap-3 sm:justify-end">
            <AlertDialogCancel className="flex-1 rounded-xl h-11 border border-gray-200 bg-white text-gray-600 font-body font-semibold text-sm hover:bg-gray-50 transition-all">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId?.type === 'post') handleDeletePost(deleteConfirmId.id);
              }}
              className="flex-1 rounded-xl h-11 bg-red-500 hover:bg-red-600 text-white font-body font-semibold text-sm shadow-sm transition-all"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
