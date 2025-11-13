import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Eye, EyeOff, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SessionSubItemUpload } from "./SessionSubItemUpload";

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

  useEffect(() => {
    fetchSubItems();

    const subscription = supabase
      .channel(`session_sub_items_${sessionId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'session_sub_items', filter: `parent_session_id=eq.${sessionId}` },
        () => fetchSubItems()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [sessionId]);

  const fetchSubItems = async () => {
    try {
      const { data, error } = await supabase
        .from('session_sub_items')
        .select('*')
        .eq('parent_session_id', sessionId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSubItems(data || []);
    } catch (error) {
      console.error('Error fetching sub-items:', error);
    }
  };

  const handleToggleActive = async (subItemId: string, currentActive: boolean) => {
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
      // Deactivate all other sub-items
      await supabase
        .from('session_sub_items')
        .update({ is_active: false })
        .eq('parent_session_id', sessionId)
        .neq('id', subItemId);

      // Toggle this sub-item
      const { error } = await supabase
        .from('session_sub_items')
        .update({ is_active: !currentActive })
        .eq('id', subItemId);

      if (error) throw error;

      toast({
        title: "Success",
        description: currentActive ? "Sub-item deactivated" : "Sub-item activated on display",
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
    if (!confirm('Delete this sub-item?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('session_sub_items')
        .delete()
        .eq('id', subItemId);

      if (error) throw error;

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
          .from('session_sub_items')
          .update({ sort_order: i })
          .eq('id', items[i].id);
      }
    } catch (error) {
      console.error('Error updating sort orders:', error);
    }
  };

  if (subItems.length === 0) {
    return (
      <div className="ml-12 mt-2">
        <SessionSubItemUpload sessionId={sessionId} onUploadComplete={fetchSubItems} />
        <p className="text-sm text-muted-foreground mt-2">No sub-items yet. Upload questions or bills above.</p>
      </div>
    );
  }

  return (
    <div className="ml-12 mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-sm"
        >
          {expanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
          {subItems.length} Sub-items
        </Button>
        <SessionSubItemUpload sessionId={sessionId} onUploadComplete={fetchSubItems} />
      </div>

      {expanded && (
        <div className="space-y-2 pl-4 border-l-2 border-muted">
          {subItems.map((item, index) => (
            <Card key={item.id} className={item.is_active ? 'border-primary' : ''}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.title}</span>
                      {item.is_active && <Badge variant="default" className="text-xs">Active</Badge>}
                    </div>
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleActive(item.id, item.is_active)}
                      disabled={loading}
                      className="h-7 w-7 p-0"
                    >
                      {item.is_active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                      disabled={loading}
                      className="h-7 w-7 p-0 text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
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
