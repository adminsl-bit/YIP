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

// ── Sub-components ────────────────────────────────────────────────────────────

const OrganizerOverrideBanner = () => (
  <section className="mb-8 rounded-2xl bg-primary-container/10 border border-primary-container/20 p-6 flex items-center justify-between overflow-hidden relative group">
    <div className="absolute right-4 top-0 h-full flex items-center opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
      <span
        className="material-symbols-outlined text-primary"
        style={{ fontSize: '120px', fontVariationSettings: "'FILL' 1" }}
      >
        admin_panel_settings
      </span>
    </div>
    <div className="flex items-center gap-5 relative z-10">
      <div className="h-12 w-12 rounded-xl bg-primary-container flex items-center justify-center text-white shadow-lg shadow-primary/20 shrink-0">
        <span className="material-symbols-outlined">gavel</span>
      </div>
      <div>
        <h3 className="text-primary font-bold font-headline text-lg">Organizer Override Mode</h3>
        <p className="text-on-surface-variant text-sm font-body max-w-2xl">
          Global override is active. You have full priority to edit, activate, or purge news headlines from all student journalists.
        </p>
      </div>
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────

interface NewsEditorCardProps {
  headline: string;
  wordCount: number;
  editingId: string | null;
  isPending: boolean;
  onChange: (text: string) => void;
  onPublish: () => void;
  onCancelEdit: () => void;
  isOrganizer: boolean;
}

const NewsEditorCard = ({
  headline, wordCount, editingId, isPending,
  onChange, onPublish, onCancelEdit, isOrganizer,
}: NewsEditorCardProps) => (
  <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-xl shadow-primary/5 border border-outline-variant/10 relative overflow-hidden h-full">
    {/* Gradient orb */}
    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary to-primary-container opacity-5 rounded-bl-full pointer-events-none" />

    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
        <h2 className="text-xl font-bold font-headline text-primary">
          {editingId ? 'Edit Headline' : 'Publish New Headline'}
        </h2>
      </div>
      <span className={`px-3 py-1 text-[10px] font-bold tracking-tight rounded-full uppercase font-headline ${wordCount > 950 ? 'bg-error/10 text-error' : 'bg-surface-container text-outline'}`}>
        {wordCount} / 1000
      </span>
    </div>

    <div className="mb-6">
      <textarea
        className="w-full min-h-[200px] p-6 rounded-2xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary-container/20 font-body text-base text-on-surface placeholder:text-on-surface-variant/40 resize-none outline-none transition-all"
        placeholder={
          isOrganizer
            ? 'Type your breaking news headline here… (e.g. Speaker calls for an emergency session on National Security)'
            : 'Share a live update from inside the Parliament chamber…'
        }
        value={headline}
        onChange={e => onChange(e.target.value)}
      />
    </div>

    <div className="flex items-center justify-between">
      <div>
        {editingId && (
          <button
            onClick={onCancelEdit}
            disabled={isPending}
            className="px-6 py-3 bg-surface-container text-on-surface-variant rounded-full font-bold text-sm font-body hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
      <button
        onClick={onPublish}
        disabled={isPending || wordCount === 0 || wordCount > 1000}
        className="bg-gradient-to-r from-primary to-primary-container text-white px-10 py-3.5 rounded-full font-bold text-sm flex items-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 font-body"
      >
        {isPending
          ? (editingId ? 'Updating…' : 'Broadcasting…')
          : (editingId ? 'Update Headline' : 'Broadcast News')
        }
        <span className={`material-symbols-outlined text-[18px] ${isPending ? 'animate-spin' : ''}`}>
          {isPending ? 'refresh' : 'send'}
        </span>
      </button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────

interface PublishedHeadlinesListProps {
  headlines: any[];
  isOrganizer: boolean;
  currentUserId?: string;
  onEdit: (item: any) => void;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  isTogglePending: boolean;
  isDeletePending: boolean;
}

const PublishedHeadlinesList = ({
  headlines, isOrganizer, currentUserId,
  onEdit, onToggle, onDelete,
  isTogglePending, isDeletePending,
}: PublishedHeadlinesListProps) => (
  <section className="bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/10 shadow-sm">
    <div className="flex items-center justify-between mb-8">
      <div>
        <h2 className="text-2xl font-bold font-headline text-primary mb-1">Published Headlines</h2>
        <p className="text-on-surface-variant text-sm font-body">
          {isOrganizer
            ? 'Control the narrative of the current session in real-time.'
            : 'Manage your active and past headlines.'}
        </p>
      </div>
      {headlines.length > 0 && (
        <div className="flex items-center gap-2 bg-tertiary/10 text-tertiary-fixed-dim px-4 py-2 rounded-full shrink-0">
          <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim animate-pulse" />
          <span className="text-xs font-bold font-headline uppercase tracking-wide">
            {headlines.filter(h => h.is_active).length} Live
          </span>
        </div>
      )}
    </div>

    {headlines.length === 0 ? (
      <div className="py-16 text-center">
        <span
          className="material-symbols-outlined text-[48px] text-on-surface-variant/20 block mb-3"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          newspaper
        </span>
        <p className="text-sm text-on-surface-variant/50 font-body">No headlines published yet.</p>
      </div>
    ) : (
      <div className="divide-y divide-outline-variant/8">
        {headlines.map(item => (
          <div key={item.id} className="group flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-surface-container-low/60 transition-colors">

            {/* Live / Paused dot badge */}
            {item.is_active ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-tertiary-fixed/30 text-tertiary-container rounded-full shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse shrink-0" />
                <span className="text-[9px] font-black font-headline uppercase tracking-wide">Live</span>
              </div>
            ) : (
              <div className="px-2.5 py-1 bg-surface-container text-outline rounded-full shrink-0">
                <span className="text-[9px] font-black font-headline uppercase tracking-wide">Paused</span>
              </div>
            )}

            {/* Headline truncated */}
            <p className="flex-1 text-sm font-semibold text-on-surface font-body truncate group-hover:text-primary transition-colors">
              {item.headline}
            </p>

            {/* Meta: by · time */}
            <div className="hidden md:flex items-center gap-3 shrink-0 text-[10px] text-on-surface-variant/50 font-body">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">person</span>
                {item.journalist_name}
              </span>
              <span>{new Date(item.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            {/* Actions — appear on hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => onEdit(item)}
                disabled={isDeletePending || isTogglePending}
                className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                title="Edit"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
              </button>
              <button
                onClick={() => onToggle(item.id, item.is_active)}
                disabled={isTogglePending}
                className={`p-1.5 rounded-lg transition-all ${item.is_active ? 'text-secondary hover:bg-secondary/5' : 'text-tertiary-fixed-dim hover:bg-tertiary/5'}`}
                title={item.is_active ? 'Pause' : 'Activate'}
              >
                <span className="material-symbols-outlined text-[16px]">{item.is_active ? 'pause_circle' : 'play_circle'}</span>
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={isDeletePending}
                    className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/5 rounded-lg transition-all"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2rem] border-none bg-surface-container-lowest shadow-2xl overflow-hidden p-0 max-w-md [&>button]:hidden">
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
                      <AlertDialogAction onClick={() => onDelete(item.id)} className="flex-1 h-12 bg-error text-on-error border-none rounded-2xl font-bold text-sm font-body">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

// ── Main component ────────────────────────────────────────────────────────────

export const BreakingNewsPublisher = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [headline, setHeadline] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const isOrganizer = profile?.user_type === 'organizer';

  const { data: myHeadlines } = useQuery({
    queryKey: ['journalist-headlines', user?.id, isOrganizer, profile?.event_id],
    queryFn: async () => {
      const query = supabase
        .from('breaking_news')
        .select('*')
        .eq('event_id', profile?.event_id ?? '')
        .order('created_at', { ascending: false });
      if (!isOrganizer) query.eq('journalist_id', user?.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!profile?.event_id,
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
          event_id: profile?.event_id ?? null,
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
    <div className="animate-in fade-in duration-700 space-y-8">

      {/* Organizer Override Banner */}
      {isOrganizer && <OrganizerOverrideBanner />}

      {/* Editor + Advisory pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Editor — 8 cols */}
        <div className="lg:col-span-8">
          <NewsEditorCard
            headline={headline}
            wordCount={wordCount}
            editingId={editingId}
            isPending={publishMutation.isPending}
            isOrganizer={isOrganizer}
            onChange={handleTextChange}
            onPublish={handlePublish}
            onCancelEdit={handleCancelEdit}
          />
        </div>

        {/* Advisory pane — 4 cols */}
        <div className="lg:col-span-4 space-y-4">

          {/* How it works */}
          <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_16px_40px_-12px_rgba(19,41,143,0.08)] overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-primary to-primary-container" />
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
                <h4 className="font-headline font-extrabold text-on-surface text-sm uppercase tracking-wide">How it works</h4>
              </div>
              <ol className="space-y-3">
                {[
                  { icon: 'edit_note', label: 'Write your headline',  desc: 'Describe the live event happening inside the parliament chamber.' },
                  { icon: 'send',      label: 'Publish instantly',    desc: 'Your headline goes live on all stage displays the moment you broadcast.' },
                  { icon: 'monitor',   label: 'Scrolls on screen',    desc: 'News scrolls across the bottom of the Combined Display and Student Dashboard.' },
                  { icon: 'toggle_on', label: 'Toggle anytime',       desc: 'Pause or re-activate a headline without deleting it.' },
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-[14px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>{step.icon}</span>
                    </div>
                    <div>
                      <p className="text-xs font-headline font-bold text-on-surface">{step.label}</p>
                      <p className="text-[11px] text-on-surface-variant font-body leading-snug mt-0.5">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Writing guidelines */}
          <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_16px_40px_-12px_rgba(19,41,143,0.08)] overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>rule</span>
                <h4 className="font-headline font-extrabold text-on-surface text-sm uppercase tracking-wide">Writing Guidelines</h4>
              </div>
              <ul className="space-y-2.5">
                {[
                  { ok: true,  text: 'State what is happening, not what might happen' },
                  { ok: true,  text: 'Name the minister, party, or committee involved' },
                  { ok: true,  text: 'Keep it to one clear event per headline' },
                  { ok: false, text: 'Avoid vague phrases like "big announcement soon"' },
                  { ok: false, text: 'Do not publish unverified or personal remarks' },
                ].map((g, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${g.ok ? 'bg-tertiary/10' : 'bg-error/10'}`}>
                      <span className={`material-symbols-outlined text-[12px] ${g.ok ? 'text-tertiary-fixed-dim' : 'text-error'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                        {g.ok ? 'check' : 'close'}
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant font-body leading-snug">{g.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Display locations */}
          <div className="bg-primary/5 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>live_tv</span>
              <h4 className="font-headline font-bold text-primary text-xs uppercase tracking-wide">Where news appears</h4>
            </div>
            <div className="space-y-2">
              {[
                { icon: 'desktop_windows', label: 'Combined Display',  desc: 'LED / stage screen ticker bar' },
                { icon: 'person',          label: 'Student Dashboard', desc: 'Participant app footer' },
              ].map((loc, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[13px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>{loc.icon}</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-headline font-bold text-on-surface">{loc.label}</p>
                    <p className="text-[10px] text-on-surface-variant font-body">{loc.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Published Headlines */}
      <PublishedHeadlinesList
        headlines={myHeadlines || []}
        isOrganizer={isOrganizer}
        currentUserId={user?.id}
        onEdit={handleEdit}
        onToggle={(id, isActive) => toggleActiveMutation.mutate({ id, isActive })}
        onDelete={(id) => deleteMutation.mutate(id)}
        isTogglePending={toggleActiveMutation.isPending}
        isDeletePending={deleteMutation.isPending}
      />
    </div>
  );
};
