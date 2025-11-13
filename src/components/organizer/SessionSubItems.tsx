import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, ChevronUp, ChevronDown, Plus, Eye, EyeOff } from "lucide-react";
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

interface SessionSubItemsProps {
  sessionId: string;
  isSessionActive: boolean;
}

export const SessionSubItems = ({ sessionId, isSessionActive }: SessionSubItemsProps) => {
  const [subItems, setSubItems] = useState<SubItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemContent, setNewItemContent] = useState("");
  const [globalVisibility, setGlobalVisibility] = useState(false);

  useEffect(() => {
    fetchSubItems();
    checkGlobalVisibility();

    const subscription = supabase
      .channel(`session_sub_items_${sessionId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'session_sub_items' as any, filter: `parent_session_id=eq.${sessionId}` },
        () => {
          fetchSubItems();
          checkGlobalVisibility();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [sessionId]);

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

  if (subItems.length === 0) {
    return (
      <div className="ml-12 mt-2 space-y-2">
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
    <div className="ml-12 mt-3 space-y-2">
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
        <div className="space-y-2 pl-4 border-l-2 border-muted">
          {subItems.map((item, index) => (
            <Card key={item.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <span className="text-sm font-medium">{item.title}</span>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
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
    </div>
  );
};
