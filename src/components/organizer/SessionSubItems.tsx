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
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        size="sm"
        variant={poll.is_active ? "default" : "outline"}
        onClick={handleToggleVoting}
        disabled={loading}
        className="h-6 text-xs"
      >
        {poll.is_active ? 'Close Voting' : 'Open Voting'}
      </Button>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Show Results</span>
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
}

export const SessionSubItems = ({ sessionId, isSessionActive }: SessionSubItemsProps) => {
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
          options: pollOptions.map((opt, index) => ({
            id: `option_${index + 1}`,
            text: opt.trim()
          })),
          is_active: false,
          show_results_publicly: false,
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
      <div className="mt-2 space-y-2">
        <div className="flex items-center gap-2">
          <SessionSubItemUpload sessionId={sessionId} onUploadComplete={fetchSubItems} />
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Manually
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Sub-item</DialogTitle>
                <DialogDescription>
                  Add a new question, bill, or agenda item manually
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title *</label>
                  <Input
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    placeholder="Enter title"
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={newItemDescription}
                    onChange={(e) => setNewItemDescription(e.target.value)}
                    placeholder="Short description (optional)"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Content</label>
                  <Textarea
                    value={newItemContent}
                    onChange={(e) => setNewItemContent(e.target.value)}
                    placeholder="Detailed content (optional)"
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddManual} disabled={loading}>
                  Add Sub-item
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-sm text-muted-foreground">No sub-items yet. Upload or add manually above.</p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-sm"
        >
          {expanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
          {subItems.length} Sub-items
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleGlobalVisibility}
            disabled={loading || !isSessionActive}
          >
            {globalVisibility ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
            {globalVisibility ? "Visible" : "Hidden"}
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Sub-item</DialogTitle>
                <DialogDescription>
                  Add a new question, bill, or agenda item manually
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title *</label>
                  <Input
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    placeholder="Enter title"
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={newItemDescription}
                    onChange={(e) => setNewItemDescription(e.target.value)}
                    placeholder="Short description (optional)"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Content</label>
                  <Textarea
                    value={newItemContent}
                    onChange={(e) => setNewItemContent(e.target.value)}
                    placeholder="Detailed content (optional)"
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddManual} disabled={loading}>
                  Add Sub-item
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <SessionSubItemUpload sessionId={sessionId} onUploadComplete={fetchSubItems} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={loading}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all sub-items?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all {subItems.length} sub-items. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAll}>Delete All</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 pl-2 border-l-2 border-muted">
          {subItems.map((item, index) => (
            <Card key={item.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{item.title}</span>
                      {item.is_active && (
                        <Badge variant="default" className="text-xs">
                          Active on Display
                        </Badge>
                      )}
                      {item.poll_id && (
                        <Badge variant="secondary" className="text-xs">
                          <Vote className="h-3 w-3 mr-1" />
                          Poll Linked
                        </Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                    )}
                    {item.poll_id && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-primary">Poll: {getPollTitle(item.poll_id)}</p>
                        <PollControls pollId={item.poll_id} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant={item.is_active ? "default" : "outline"}
                      onClick={() => handleToggleSubItemActive(item.id, item.is_active)}
                      disabled={loading || !isSessionActive}
                      className="h-7 px-2"
                      title={item.is_active ? "Deactivate on display" : "Activate on display"}
                    >
                      {item.is_active ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                      <span className="text-xs">{item.is_active ? 'Active' : 'Activate'}</span>
                    </Button>
                    {item.poll_id ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnlinkPoll(item.id)}
                        disabled={loading}
                        className="h-7 px-2"
                        title="Unlink poll"
                      >
                        <X className="h-3 w-3 mr-1" />
                        <span className="text-xs">Unlink</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedSubItemId(item.id);
                          setShowPollDialog(true);
                        }}
                        disabled={loading}
                        className="h-7 px-2"
                        title="Link/Create poll"
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        <span className="text-xs">Poll</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0 || loading}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === subItems.length - 1 || loading}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={loading}
                          className="h-7 w-7 p-0 text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this sub-item?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(item.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Poll Management Dialog */}
      <Dialog open={showPollDialog} onOpenChange={setShowPollDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link or Create Poll</DialogTitle>
            <DialogDescription>
              Link an existing poll or create a new one for this sub-item
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Link Existing Poll */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Link Existing Poll</h3>
              <Select onValueChange={handleLinkExistingPoll} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a poll to link" />
                </SelectTrigger>
                <SelectContent>
                  {availablePolls.map((poll) => (
                    <SelectItem key={poll.id} value={poll.id}>
                      {poll.title} {poll.is_active && "(Active)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            {/* Create New Poll */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Create New Poll</h3>
              <div>
                <label className="text-sm font-medium">Poll Question *</label>
                <Input
                  value={newPollTitle}
                  onChange={(e) => setNewPollTitle(e.target.value)}
                  placeholder="Enter poll question"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Poll Options</label>
                <div className="space-y-2">
                  {pollOptions.map((option, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...pollOptions];
                          newOptions[idx] = e.target.value;
                          setPollOptions(newOptions);
                        }}
                        placeholder={`Option ${idx + 1}`}
                      />
                      {pollOptions.length > 2 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPollOptions(pollOptions.filter((_, i) => i !== idx));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPollOptions([...pollOptions, ""])}
                    disabled={pollOptions.length >= 6}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowPollDialog(false);
              setSelectedSubItemId(null);
              setNewPollTitle("");
              setPollOptions(["Yes", "No", "Abstain"]);
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateAndLinkPoll} disabled={loading || !newPollTitle.trim()}>
              Create & Link Poll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
