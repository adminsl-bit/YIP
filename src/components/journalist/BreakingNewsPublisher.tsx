import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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

  const isOrganizer = profile?.user_type === 'organizer';

  const { data: myHeadlines } = useQuery({
    queryKey: ['journalist-headlines', user?.id, isOrganizer],
    queryFn: async () => {
      const query = supabase
        .from('breaking_news')
        .select('*')
        .order('created_at', { ascending: false });
      if (!isOrganizer) query.eq('journalist_id', user?.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const publishMutation = useMutation({
    mutationFn: async (text: string) => {
      if (editingId) {
        const { error } = await supabase
          .from('breaking_news')
          .update({ headline: text, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('breaking_news').insert({
          journalist_id: user?.id,
          journalist_name: isOrganizer ? 'Organizer' : (profile?.name || 'Anonymous'),
          headline: text,
          is_active: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? 'Headline Updated!' : 'Breaking News Published!', description: editingId ? 'Your headline has been updated.' : 'Your headline is now live on stage displays.' });
      setHeadline('');
      setWordCount(0);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['journalist-headlines'] });
      queryClient.invalidateQueries({ queryKey: ['active-breaking-news'] });
    },
    onError: (error: any) => {
      toast({ title: editingId ? 'Failed to update' : 'Failed to publish', description: error.message, variant: 'destructive' });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('breaking_news').update({ is_active: !isActive }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journalist-headlines'] });
      queryClient.invalidateQueries({ queryKey: ['active-breaking-news'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('breaking_news').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Headline Deleted', description: 'Your headline has been permanently deleted.' });
      queryClient.invalidateQueries({ queryKey: ['journalist-headlines'] });
      queryClient.invalidateQueries({ queryKey: ['active-breaking-news'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
    },
  });

  const handleTextChange = (text: string) => {
    if (text.length > 1000) {
      setHeadline(text.slice(0, 1000));
      setWordCount(1000);
      toast({ title: 'Character limit reached', description: 'Maximum 1000 characters allowed.', variant: 'destructive' });
    } else {
      setWordCount(text.length);
      setHeadline(text);
    }
  };

  const handleEdit = (item: any) => {
    setHeadline(item.headline);
    setWordCount(item.headline.length);
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => { setHeadline(''); setWordCount(0); setEditingId(null); };

  const handlePublish = () => {
    if (wordCount === 0) { toast({ title: 'Empty headline', description: 'Please enter a headline before publishing.', variant: 'destructive' }); return; }
    if (wordCount > 1000) { toast({ title: 'Too long', description: 'Headline cannot exceed 1000 characters.', variant: 'destructive' }); return; }
    publishMutation.mutate(headline);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">

      {/* Organizer override banner */}
      {isOrganizer && (
        <div className="flex items-start gap-4 p-5 bg-primary-container/30 rounded-2xl">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
          </div>
          <div>
            <p className="font-headline font-bold text-on-surface text-sm">Organizer Override Mode</p>
            <p className="text-xs text-on-surface-variant font-body mt-0.5">
              You can view and manage all breaking news headlines from journalists — edit, activate/deactivate, or delete any headline.
            </p>
          </div>
        </div>
      )}

      {/* Compose card */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary to-primary-container" />
        <div className="p-8 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
              <h3 className="font-headline font-extrabold text-on-surface text-lg">
                {editingId ? 'Edit Breaking News' : 'Publish Breaking News'}
              </h3>
            </div>
            <p className="text-xs text-on-surface-variant font-body">
              {editingId
                ? 'Update this headline'
                : isOrganizer
                  ? 'Publish breaking news to all displays (as Organizer)'
                  : 'Share live updates from inside the Parliament to stage displays'
              }
            </p>
          </div>

          <textarea
            placeholder="Example: The parliament is trying to pass the security bill, opposition minister is in a heated debate…"
            value={headline}
            onChange={e => handleTextChange(e.target.value)}
            rows={5}
            className="w-full bg-surface-container border-none rounded-2xl px-5 py-4 text-xl font-medium text-on-surface font-body focus:ring-2 focus:ring-primary/20 outline-none resize-none"
          />

          <div className="flex justify-between items-center">
            <span className={`text-xs font-bold font-body ${wordCount > 950 ? 'text-error' : 'text-on-surface-variant'}`}>
              {wordCount} / 1000 characters
            </span>
            <div className="flex gap-3">
              {editingId && (
                <button
                  onClick={handleCancelEdit}
                  disabled={publishMutation.isPending}
                  className="px-5 py-2.5 bg-surface-container text-on-surface-variant rounded-xl font-bold text-sm font-body hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handlePublish}
                disabled={publishMutation.isPending || wordCount === 0 || wordCount > 1000}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary-container text-white rounded-xl font-bold text-sm font-body shadow-[0_4px_12px_rgba(19,41,143,0.25)] hover:shadow-[0_6px_16px_rgba(19,41,143,0.35)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={`material-symbols-outlined text-[18px] ${publishMutation.isPending ? 'animate-spin' : ''}`}>
                  {publishMutation.isPending ? 'refresh' : 'send'}
                </span>
                {publishMutation.isPending
                  ? (editingId ? 'Updating…' : 'Publishing…')
                  : (editingId ? 'Update Headline' : 'Publish Breaking News')
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Headlines list */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] overflow-hidden">
        <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>newspaper</span>
          </div>
          <div>
            <h3 className="font-headline font-extrabold text-on-surface">
              {isOrganizer ? 'All Published Headlines' : 'Your Published Headlines'}
            </h3>
            <p className="text-xs text-on-surface-variant font-body">
              {isOrganizer ? 'Manage all breaking news from journalists and organizers' : 'Manage your active and past headlines'}
            </p>
          </div>
        </div>

        {!myHeadlines || myHeadlines.length === 0 ? (
          <div className="px-8 py-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>newspaper</span>
            <p className="text-sm text-on-surface-variant/50 font-body">No headlines published yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/5">
            {myHeadlines.map(item => (
              <div key={item.id} className="px-8 py-5 flex items-start gap-4 hover:bg-primary-container/[0.02] transition-colors group">
                {/* Live indicator */}
                <div className="mt-1 shrink-0">
                  {item.is_active
                    ? <span className="w-2.5 h-2.5 rounded-full bg-tertiary-fixed-dim block animate-pulse" />
                    : <span className="w-2.5 h-2.5 rounded-full bg-outline-variant block" />
                  }
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface font-body leading-relaxed">{item.headline}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {item.is_active && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-tertiary/10 text-tertiary-fixed-dim text-[11px] font-bold rounded-full font-body uppercase tracking-wider">
                        <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>fiber_manual_record</span>
                        Live
                      </span>
                    )}
                    {isOrganizer && item.journalist_id !== user?.id && (
                      <span className="px-2.5 py-0.5 bg-primary-fixed text-on-primary-fixed text-[11px] font-bold rounded-full font-body">
                        Can Override
                      </span>
                    )}
                    <span className="text-[11px] text-on-surface-variant font-body">
                      By {item.journalist_name} · {new Date(item.published_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => handleEdit(item)}
                    disabled={deleteMutation.isPending || toggleActiveMutation.isPending}
                    className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-container"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    onClick={() => toggleActiveMutation.mutate({ id: item.id, isActive: item.is_active })}
                    disabled={toggleActiveMutation.isPending}
                    className={`p-2 transition-colors rounded-lg hover:bg-surface-container ${item.is_active ? 'text-error hover:text-error' : 'text-tertiary-fixed-dim hover:text-tertiary-fixed-dim'}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{item.is_active ? 'pause_circle' : 'play_circle'}</span>
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button disabled={deleteMutation.isPending} className="p-2 text-on-surface-variant hover:text-error transition-colors rounded-lg hover:bg-surface-container">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-2xl overflow-hidden p-0">
                      <div className="h-1.5 bg-error" />
                      <div className="p-8 space-y-4">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-xl font-extrabold font-headline text-error">Delete Headline?</AlertDialogTitle>
                          <AlertDialogDescription className="text-sm text-on-surface-variant font-body">
                            This action cannot be undone. This headline will be permanently deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex gap-3 pt-2">
                          <AlertDialogCancel className="flex-1 h-12 bg-surface-container border-none rounded-2xl font-bold text-sm text-on-surface-variant font-body">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(item.id)} className="flex-1 h-12 bg-error text-on-error border-none rounded-2xl font-bold text-sm font-body">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </div>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
