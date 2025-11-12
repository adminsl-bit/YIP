import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Newspaper, Send } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const BreakingNewsPublisher = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [headline, setHeadline] = useState('');
  const [wordCount, setWordCount] = useState(0);

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
      const { error } = await supabase
        .from('breaking_news')
        .insert({
          journalist_id: user?.id,
          headline: text,
          is_active: true,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Breaking News Published!',
        description: 'Your headline is now live on stage displays.',
      });
      setHeadline('');
      setWordCount(0);
      queryClient.invalidateQueries({ queryKey: ['journalist-headlines'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to publish',
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
    },
  });

  const handleTextChange = (text: string) => {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
    setHeadline(text);
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
            Publish Breaking News
          </CardTitle>
          <CardDescription>
            Share live updates from inside the Parliament to stage displays
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Example: The parliament is trying to pass the security bill, opposition minister is in a heated debate against it..."
              value={headline}
              onChange={(e) => handleTextChange(e.target.value)}
              className="min-h-[150px] resize-none text-base"
              maxLength={7000} // Character limit to ensure word count stays reasonable
            />
            <div className="flex justify-between items-center">
              <span className={`text-sm font-medium ${wordCount > 1000 ? 'text-red-600' : 'text-slate-600'}`}>
                {wordCount} / 1000 words
              </span>
              <Button
                onClick={handlePublish}
                disabled={publishMutation.isPending || wordCount === 0 || wordCount > 1000}
                className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Publish Breaking News
              </Button>
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
                    </div>
                    <Button
                      variant={item.is_active ? "destructive" : "default"}
                      size="sm"
                      onClick={() => toggleActiveMutation.mutate({ id: item.id, isActive: item.is_active })}
                    >
                      {item.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
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
