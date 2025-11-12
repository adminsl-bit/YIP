import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Newspaper, Send, Edit2, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
} from '@/components/ui/alert-dialog';

export const BreakingNewsPublisher = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [headline, setHeadline] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: myHeadlines } = useQuery({
    queryKey: ['journalist-headlines', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('breaking_news')
        .select('*')
        .eq('journalist_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const publishMutation = useMutation({
    mutationFn: async (text: string) => {
      if (editingId) {
        // Update existing headline
        const { error } = await supabase
          .from('breaking_news')
          .update({
            headline: text,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);
        
        if (error) throw error;
      } else {
        // Insert new headline
        const { error } = await supabase
          .from('breaking_news')
          .insert({
            journalist_id: user?.id,
            journalist_name: profile?.name || 'Anonymous',
            headline: text,
            is_active: true,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: editingId ? 'Headline Updated!' : 'Breaking News Published!',
        description: editingId ? 'Your headline has been updated.' : 'Your headline is now live on stage displays.',
      });
      setHeadline('');
      setWordCount(0);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['journalist-headlines'] });
      queryClient.invalidateQueries({ queryKey: ['active-breaking-news'] });
    },
    onError: (error: any) => {
      toast({
        title: editingId ? 'Failed to update' : 'Failed to publish',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('breaking_news')
        .update({ is_active: !isActive })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journalist-headlines'] });
      queryClient.invalidateQueries({ queryKey: ['active-breaking-news'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('breaking_news')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Headline Deleted',
        description: 'Your headline has been permanently deleted.',
      });
      queryClient.invalidateQueries({ queryKey: ['journalist-headlines'] });
      queryClient.invalidateQueries({ queryKey: ['active-breaking-news'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleTextChange = (text: string) => {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    const count = text.trim() === '' ? 0 : words.length;
    
    // Enforce 1000 word limit by truncating
    if (count > 1000) {
      const truncatedWords = words.slice(0, 1000);
      const truncatedText = truncatedWords.join(' ');
      setHeadline(truncatedText);
      setWordCount(1000);
      toast({
        title: 'Word limit reached',
        description: 'Maximum 1000 words allowed. Text has been truncated.',
        variant: 'destructive',
      });
    } else {
      setWordCount(count);
      setHeadline(text);
    }
  };

  const handleEdit = (item: any) => {
    setHeadline(item.headline);
    const words = item.headline.trim().split(/\s+/).filter((word: string) => word.length > 0);
    setWordCount(item.headline.trim() === '' ? 0 : words.length);
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setHeadline('');
    setWordCount(0);
    setEditingId(null);
  };

  const handlePublish = () => {
    if (wordCount === 0) {
      toast({
        title: 'Empty headline',
        description: 'Please enter a headline before publishing.',
        variant: 'destructive',
      });
      return;
    }
    
    if (wordCount > 1000) {
      toast({
        title: 'Too long',
        description: 'Headline cannot exceed 1000 words.',
        variant: 'destructive',
      });
      return;
    }

    publishMutation.mutate(headline);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/80 backdrop-blur-sm border-2 border-orange-200 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Newspaper className="w-6 h-6 text-orange-600" />
            {editingId ? 'Edit Breaking News' : 'Publish Breaking News'}
          </CardTitle>
          <CardDescription>
            {editingId ? 'Update your headline' : 'Share live updates from inside the Parliament to stage displays'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Example: The parliament is trying to pass the security bill, opposition minister is in a heated debate against it..."
              value={headline}
              onChange={(e) => handleTextChange(e.target.value)}
              className="min-h-[150px] resize-none text-base"
            />
            <div className="flex justify-between items-center">
              <span className={`text-sm font-medium ${wordCount > 1000 ? 'text-red-600' : 'text-slate-600'}`}>
                {wordCount} / 1000 words
              </span>
              <div className="flex gap-2">
                {editingId && (
                  <Button
                    onClick={handleCancelEdit}
                    variant="outline"
                    disabled={publishMutation.isPending}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  onClick={handlePublish}
                  disabled={publishMutation.isPending || wordCount === 0 || wordCount > 1000}
                  className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {editingId ? 'Update Headline' : 'Publish Breaking News'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/80 backdrop-blur-sm border-2 border-slate-200 shadow-xl">
        <CardHeader>
          <CardTitle>Your Published Headlines</CardTitle>
          <CardDescription>Manage your active and past headlines</CardDescription>
        </CardHeader>
        <CardContent>
          {myHeadlines && myHeadlines.length > 0 ? (
            <div className="space-y-3">
              {myHeadlines.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border-2 ${
                    item.is_active
                      ? 'bg-green-50 border-green-300'
                      : 'bg-slate-50 border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{item.headline}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Published: {new Date(item.published_at).toLocaleString()}
                      </p>
                      {item.is_active && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                          Live
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(item)}
                        disabled={deleteMutation.isPending}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={item.is_active ? "destructive" : "default"}
                        size="sm"
                        onClick={() => toggleActiveMutation.mutate({ id: item.id, isActive: item.is_active })}
                        disabled={toggleActiveMutation.isPending}
                      >
                        {item.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Headline?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete your headline.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(item.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-8">No headlines published yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
