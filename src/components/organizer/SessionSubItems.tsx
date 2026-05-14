import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Trash2, ChevronUp, ChevronDown, Plus, Eye, EyeOff, Vote, Link2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SessionSubItemUpload } from "./SessionSubItemUpload";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SubItem {
  id: string;
  parent_session_id: string;
  title: string;
  description: string | null;
  content: string | null;
  sort_order: number;
  poll_id: string | null;
  is_active: boolean;
}

interface Poll {
  id: string;
  title: string;
  is_active: boolean;
  show_results_publicly?: boolean;
}

// Helper component for inline poll controls
const PollControls = ({ pollId }: { pollId: string }) => {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPoll();
    
    const subscription = supabase
      .channel(`poll_${pollId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'polls', filter: `id=eq.${pollId}` },
        () => fetchPoll()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [pollId]);

  const fetchPoll = async () => {
    const { data } = await supabase
      .from('polls')
      .select('id, title, is_active, show_results_publicly')
      .eq('id', pollId)
      .single();
    
    if (data) setPoll(data as Poll);
  };

  const handleToggleVoting = async () => {
    if (!poll) return;
    setLoading(true);
    
    const { error } = await supabase
      .from('polls')
      .update({ is_active: !poll.is_active })
      .eq('id', pollId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to toggle poll voting",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: poll.is_active ? "Voting closed" : "Voting opened",
      });
    }
    
    setLoading(false);
  };

  const handleToggleResults = async () => {
    if (!poll) return;
    setLoading(true);
    
    const { error } = await supabase
      .from('polls')
      .update({ show_results_publicly: !poll.show_results_publicly })
      .eq('id', pollId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to toggle results visibility",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: poll.show_results_publicly ? "Results hidden" : "Results visible",
      });
    }
    
    setLoading(false);
  };

  if (!poll) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={handleToggleVoting}
        disabled={loading}
        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${poll.is_active ? 'bg-[#1A3192] text-white shadow-lg shadow-blue-900/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}
      >
        {poll.is_active ? 'Close Voting' : 'Open Voting'}
      </button>
      <div className="flex items-center gap-3 px-3 py-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Public Results</span>
        <Switch
          checked={poll.show_results_publicly || false}
          onCheckedChange={handleToggleResults}
          disabled={loading}
          className="scale-75"
        />
      </div>
    </div>
  );
};

interface SessionSubItemsProps {
  sessionId: string;
  isSessionActive: boolean;
  isAdminStudent?: boolean;
}

export const SessionSubItems = ({ sessionId, isSessionActive, isAdminStudent = false }: SessionSubItemsProps) => {
  const [subItems, setSubItems] = useState<SubItem[]>([]);
  const [expanded, setExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(`subitems_expanded_${sessionId}`) === '1';
  });
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemContent, setNewItemContent] = useState("");
  const [globalVisibility, setGlobalVisibility] = useState(false);
  const [availablePolls, setAvailablePolls] = useState<Poll[]>([]);
  const [showPollDialog, setShowPollDialog] = useState(false);
  const [selectedSubItemId, setSelectedSubItemId] = useState<string | null>(null);
  const [newPollTitle, setNewPollTitle] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["Yes", "No", "Abstain"]);

  useEffect(() => {
    fetchSubItems();
    checkGlobalVisibility();
    fetchAvailablePolls();

    const subscription = supabase
      .channel(`session_sub_items_${sessionId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'session_sub_items' as any, filter: `parent_session_id=eq.${sessionId}` },
        () => {
          fetchSubItems();
          checkGlobalVisibility();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'polls' },
        () => {
          fetchAvailablePolls();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [sessionId]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`subitems_expanded_${sessionId}`, expanded ? '1' : '0');
      }
    } catch {}
  }, [expanded, sessionId]);

  const checkGlobalVisibility = async () => {
    try {
      const { data } = await supabase
        .from('session_sub_items' as any)
        .select('is_active')
        .eq('parent_session_id', sessionId)
        .limit(1)
        .maybeSingle();
      
      setGlobalVisibility((data as any)?.is_active || false);
    } catch (error) {
      console.error('Error checking visibility:', error);
    }
  };

  const fetchSubItems = async () => {
    try {
      const { data, error } = await supabase
        .from('session_sub_items' as any)
        .select('*')
        .eq('parent_session_id', sessionId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSubItems((data as any) || []);
    } catch (error) {
      console.error('Error fetching sub-items:', error);
    }
  };

  const handleToggleGlobalVisibility = async () => {
    if (!isSessionActive) {
      toast({
        title: "Session not active",
        description: "Please activate the parent session first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const newVisibility = !globalVisibility;
      
      // Update all sub-items visibility at once
      const { error } = await supabase
        .from('session_sub_items' as any)
        .update({ is_active: newVisibility })
        .eq('parent_session_id', sessionId);

      if (error) throw error;

      setGlobalVisibility(newVisibility);
      toast({
        title: "Success",
        description: newVisibility ? "All sub-items visible on display" : "All sub-items hidden from display",
      });
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast({
        title: "Error",
        description: "Failed to toggle visibility",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubItemActive = async (subItemId: string, currentActive: boolean) => {
    if (!isSessionActive) {
      toast({
        title: "Session not active",
        description: "Please activate the parent session first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('session_sub_items' as any)
        .update({ is_active: !currentActive })
        .eq('id', subItemId);

      if (error) throw error;

      await fetchSubItems();
      await checkGlobalVisibility();

      toast({
        title: "Success",
        description: currentActive ? "Sub-item hidden from display" : "Sub-item now visible on display",
      });
    } catch (error) {
      console.error('Error toggling sub-item:', error);
      toast({
        title: "Error",
        description: "Failed to toggle sub-item",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (subItemId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('session_sub_items' as any)
        .delete()
        .eq('id', subItemId);

      if (error) throw error;

      // Explicitly refetch to update UI
      await fetchSubItems();
      await checkGlobalVisibility();

      toast({
        title: "Success",
        description: "Sub-item deleted",
      });
    } catch (error) {
      console.error('Error deleting sub-item:', error);
      toast({
        title: "Error",
        description: "Failed to delete sub-item",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('session_sub_items' as any)
        .delete()
        .eq('parent_session_id', sessionId);

      if (error) throw error;

      // Explicitly refetch to update UI
      await fetchSubItems();
      await checkGlobalVisibility();
      
      toast({
        title: "Success",
        description: "All sub-items deleted",
      });
    } catch (error) {
      console.error('Error deleting all sub-items:', error);
      toast({
        title: "Error",
        description: "Failed to delete all sub-items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddManual = async () => {
    if (!newItemTitle.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('session_sub_items' as any)
        .insert({
          parent_session_id: sessionId,
          title: newItemTitle.trim(),
          description: newItemDescription.trim() || null,
          content: newItemContent.trim() || null,
          sort_order: subItems.length,
          is_active: false,
        });

      if (error) throw error;

      // Explicitly refetch to update UI
      await fetchSubItems();
      await checkGlobalVisibility();

      toast({
        title: "Success",
        description: "Sub-item added",
      });

      setNewItemTitle("");
      setNewItemDescription("");
      setNewItemContent("");
      setShowAddDialog(false);
    } catch (error) {
      console.error('Error adding sub-item:', error);
      toast({
        title: "Error",
        description: "Failed to add sub-item",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newItems = [...subItems];
    [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
    
    setSubItems(newItems);
    await updateSortOrders(newItems);
  };

  const handleMoveDown = async (index: number) => {
    if (index === subItems.length - 1) return;
    const newItems = [...subItems];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    
    setSubItems(newItems);
    await updateSortOrders(newItems);
  };

  const updateSortOrders = async (items: SubItem[]) => {
    try {
      for (let i = 0; i < items.length; i++) {
        await supabase
          .from('session_sub_items' as any)
          .update({ sort_order: i } as any)
          .eq('id', items[i].id);
      }
    } catch (error) {
      console.error('Error updating sort orders:', error);
    }
  };

  const fetchAvailablePolls = async () => {
    try {
      const { data, error } = await supabase
        .from('polls')
        .select('id, title, is_active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailablePolls(data || []);
    } catch (error) {
      console.error('Error fetching polls:', error);
    }
  };

  const handleLinkExistingPoll = async (pollId: string) => {
    if (!selectedSubItemId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('session_sub_items' as any)
        .update({ poll_id: pollId } as any)
        .eq('id', selectedSubItemId);

      if (error) throw error;

      await fetchSubItems();
      toast({
        title: "Success",
        description: "Poll linked to sub-item",
      });
      setShowPollDialog(false);
      setSelectedSubItemId(null);
    } catch (error) {
      console.error('Error linking poll:', error);
      toast({
        title: "Error",
        description: "Failed to link poll",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndLinkPoll = async () => {
    if (!selectedSubItemId || !newPollTitle.trim()) {
      toast({
        title: "Error",
        description: "Poll title is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create the poll
      const { data: newPoll, error: pollError } = await supabase
        .from('polls')
        .insert({
          title: newPollTitle.trim(),
          options: pollOptions.map(opt => opt.trim()).filter(opt => opt !== ""),
          is_active: true,
          show_results_publicly: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (pollError) throw pollError;

      // Link the poll to the sub-item
      const { error: linkError } = await supabase
        .from('session_sub_items' as any)
        .update({ poll_id: newPoll.id } as any)
        .eq('id', selectedSubItemId);

      if (linkError) throw linkError;

      await fetchSubItems();
      await fetchAvailablePolls();
      
      toast({
        title: "Success",
        description: "Poll created and linked to sub-item",
      });
      
      setShowPollDialog(false);
      setSelectedSubItemId(null);
      setNewPollTitle("");
      setPollOptions(["Yes", "No", "Abstain"]);
    } catch (error) {
      console.error('Error creating poll:', error);
      toast({
        title: "Error",
        description: "Failed to create poll",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkPoll = async (subItemId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('session_sub_items' as any)
        .update({ poll_id: null } as any)
        .eq('id', subItemId);

      if (error) throw error;

      await fetchSubItems();
      toast({
        title: "Success",
        description: "Poll unlinked from sub-item",
      });
    } catch (error) {
      console.error('Error unlinking poll:', error);
      toast({
        title: "Error",
        description: "Failed to unlink poll",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPollTitle = (pollId: string | null) => {
    if (!pollId) return null;
    const poll = availablePolls.find(p => p.id === pollId);
    return poll?.title || "Unknown Poll";
  };

  if (subItems.length === 0) {
    return (
      <div className="mt-4 p-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem] flex flex-col items-center justify-center text-center gap-4">
        {!isAdminStudent && (
          <div className="flex items-center gap-3">
            <SessionSubItemUpload sessionId={sessionId} onUploadComplete={fetchSubItems} />
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">
                  <Plus className="w-4 h-4" />
                  Add Manually
                </button>
              </DialogTrigger>
              <DialogContent className="rounded-[2rem] border-none shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black tracking-tight">Add Procedural Item</DialogTitle>
                  <DialogDescription className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                    Insert a new question or agenda sub-item
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Title *</label>
                    <Input
                      value={newItemTitle}
                      onChange={(e) => setNewItemTitle(e.target.value)}
                      placeholder="Enter procedural title..."
                      className="rounded-2xl border-slate-100 dark:border-slate-800 h-12 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Context</label>
                    <Input
                      value={newItemDescription}
                      onChange={(e) => setNewItemDescription(e.target.value)}
                      placeholder="Optional brief description"
                      className="rounded-2xl border-slate-100 dark:border-slate-800 h-12 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Content</label>
                    <Textarea
                      value={newItemContent}
                      onChange={(e) => setNewItemContent(e.target.value)}
                      placeholder="Detailed content or body..."
                      rows={4}
                      className="rounded-2xl border-slate-100 dark:border-slate-800 font-bold"
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <button onClick={() => setShowAddDialog(false)} className="px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-colors">Cancel</button>
                  <button onClick={handleAddManual} disabled={loading} className="px-8 py-3 bg-[#1A3192] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95 transition-all">Create Sub-item</button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {isAdminStudent ? 'No detailed sub-items found' : 'No sub-items initialized for this session'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 px-4 py-2 hover:bg-white dark:hover:bg-slate-700 rounded-2xl transition-all group"
        >
          <div className={`size-8 rounded-lg flex items-center justify-center transition-transform ${expanded ? 'rotate-180 bg-slate-900 text-white' : 'bg-white dark:bg-slate-800 text-slate-400 group-hover:scale-110'}`}>
            <ChevronDown className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{subItems.length} Procedural Sub-items</span>
        </button>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleGlobalVisibility}
            disabled={loading || !isSessionActive}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm transition-all ${globalVisibility ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700'}`}
          >
            {globalVisibility ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {globalVisibility ? "Publicly Visible" : "Hidden from Public"}
          </button>
          
          {!isAdminStudent && (
            <>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-2 px-5 py-2.5 bg-[#1A3192] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/10 hover:scale-105 active:scale-95 transition-all">
                    <Plus className="w-4 h-4" />
                    New Item
                  </button>
                </DialogTrigger>
                <DialogContent className="rounded-[2.5rem] border-none shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black tracking-tighter">New Procedural Entry</DialogTitle>
                    <DialogDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Add a manual agenda entry or question
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entry Title</label>
                      <Input value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} placeholder="Constitutional Amendment Q1" className="bg-slate-50 dark:bg-slate-800 border-none rounded-2xl h-14 font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brief Description</label>
                      <Input value={newItemDescription} onChange={(e) => setNewItemDescription(e.target.value)} placeholder="Contextual summary..." className="bg-slate-50 dark:bg-slate-800 border-none rounded-2xl h-14 font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Technical Body</label>
                      <Textarea value={newItemContent} onChange={(e) => setNewItemContent(e.target.value)} rows={4} placeholder="Full content text..." className="bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-bold" />
                    </div>
                  </div>
                  <DialogFooter className="gap-3">
                    <button onClick={() => setShowAddDialog(false)} className="px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400">Cancel</button>
                    <button onClick={handleAddManual} disabled={loading} className="px-8 py-3 bg-[#1A3192] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/10">Publish Entry</button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <SessionSubItemUpload sessionId={sessionId} onUploadComplete={fetchSubItems} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2.5rem] border-none">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-black tracking-tight">Purge All Entries?</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                      This will permanently delete all {subItems.length} procedural sub-items.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-3">
                    <AlertDialogCancel className="rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAll} className="bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">Confirm Purge</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 gap-4 pl-6 border-l-2 border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-left-4 duration-500">
          {subItems.map((item, index) => (
            <div key={item.id} className="group bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/50 transition-all relative">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="text-[9px] font-black text-[#1A3192] dark:text-blue-400 uppercase tracking-[0.2em] bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full">{index + 1}</span>
                      <h5 className="text-base font-black text-slate-900 dark:text-white tracking-tight truncate">{item.title}</h5>
                      {item.is_active && (
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 text-[8px] font-black rounded-full uppercase tracking-widest flex items-center gap-1.5">
                          <span className="size-1 rounded-full bg-emerald-500 animate-pulse"></span>
                          Display Active
                        </span>
                      )}
                    </div>
                    {item.description && <p className="text-xs font-bold text-slate-400 uppercase tracking-widest truncate">{item.description}</p>}
                    
                    <div className="mt-4 flex items-center gap-4">
                      {item.poll_id ? (
                        <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700">
                           <div className="flex flex-col">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Bound Poll</span>
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[150px]">{getPollTitle(item.poll_id)}</span>
                           </div>
                           <PollControls pollId={item.poll_id} />
                           {!isAdminStudent && (
                             <button onClick={() => handleUnlinkPoll(item.id)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors">
                               <X className="w-4 h-4" />
                             </button>
                           )}
                        </div>
                      ) : !isAdminStudent && (
                        <button 
                          onClick={() => { setSelectedSubItemId(item.id); setShowPollDialog(true); }}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-colors border border-dashed border-slate-200"
                        >
                          <Vote className="w-3.5 h-3.5" />
                          Link Assessment Poll
                        </button>
                      )}
                    </div>
                  </div>

                  {!isAdminStudent && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <div className="flex gap-1.5">
                        <button onClick={() => handleMoveUp(index)} disabled={index === 0} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-[#1A3192] disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                        <button onClick={() => handleMoveDown(index)} disabled={index === subItems.length - 1} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-[#1A3192] disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleToggleSubItemActive(item.id, item.is_active)} className={`p-2 rounded-xl transition-all ${item.is_active ? 'bg-emerald-500 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-emerald-500'}`}>
                          {item.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500 rounded-xl"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  )}
                </div>
            </div>
          ))}
        </div>
      )}

      {/* Linked Poll Selection Dialog */}
      <Dialog open={showPollDialog} onOpenChange={setShowPollDialog}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">Parliamentary Assessment</DialogTitle>
            <DialogDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Link an existing poll or define one for this entry
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-8 py-6">
            <div className="space-y-4">
              <h6 className="text-[10px] font-black text-[#1A3192] uppercase tracking-[0.2em]">Select Portfolio Poll</h6>
              <div className="max-h-60 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {availablePolls.map(p => (
                  <button key={p.id} onClick={() => handleLinkExistingPoll(p.id)} className="w-full text-left p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 group transition-all">
                    <p className="text-xs font-black text-slate-900 dark:text-white group-hover:text-[#1A3192] transition-colors">{p.title}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 border-l border-slate-100 dark:border-slate-800 pl-8">
              <h6 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Deploy Custom Poll</h6>
              <div className="space-y-4">
                <Input value={newPollTitle} onChange={(e) => setNewPollTitle(e.target.value)} placeholder="Assessment Title..." className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl h-12 font-bold" />
                <div className="flex flex-wrap gap-2">
                  {pollOptions.map((opt, i) => (
                    <span key={i} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[9px] font-black text-slate-500">{opt}</span>
                  ))}
                </div>
                <button 
                  onClick={handleCreateAndLinkPoll}
                  disabled={loading || !newPollTitle}
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  Create & Link
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
