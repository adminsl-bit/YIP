import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { executeOrQueue } from '@/lib/executeOrQueue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Gavel, Plus, X } from 'lucide-react';

type MotionType =
  | 'adjournment_motion'
  | 'calling_attention_notice'
  | 'breach_of_privilege'
  | 'no_confidence_motion'
  | 'short_duration_discussion'
  | 'obituary_reference'
  | 'laying_of_papers';

type MotionStatus = 'pending' | 'approved' | 'rejected' | 'discussed';

interface Motion {
  id: string;
  event_id: string | null;
  motion_type: MotionType;
  subject: string;
  details: string | null;
  raised_by: string;
  created_by: string;
  status: MotionStatus;
  outcome: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileLite {
  user_id: string;
  name: string;
  party_name?: string | null;
  committee?: string | null;
}

const MOTION_TYPES: Record<MotionType, { label: string; page: string; description: string }> = {
  adjournment_motion: {
    label: 'Adjournment Motion',
    page: 'Handbook p.24',
    description: "Raised to pause regular business to discuss an urgent matter of public importance. Requires Speaker's approval.",
  },
  calling_attention_notice: {
    label: 'Calling Attention Notice',
    page: 'Handbook p.23',
    description: "Draws a Minister's attention to a matter of urgent public importance and seeks an authoritative statement.",
  },
  breach_of_privilege: {
    label: 'Breach of Privilege',
    page: 'Handbook p.23',
    description: 'Raised when a member believes the privileges of the House or its members have been violated.',
  },
  no_confidence_motion: {
    label: 'No-Confidence Motion',
    page: 'Handbook p.24',
    description: 'Tests whether the government continues to enjoy the confidence of the House.',
  },
  short_duration_discussion: {
    label: 'Short Duration Discussion',
    page: 'Handbook p.23',
    description: 'Requests a brief, time-bound discussion on an urgent matter without a formal vote.',
  },
  obituary_reference: {
    label: 'Obituary Reference',
    page: 'Handbook p.24',
    description: 'A formal tribute placed on record following the passing of a member or notable figure.',
  },
  laying_of_papers: {
    label: 'Laying of Papers',
    page: 'Handbook p.23',
    description: 'Formally places official documents or reports before the House for record.',
  },
};

const MOTION_TYPE_ORDER = Object.keys(MOTION_TYPES) as MotionType[];

const STATUS_CONFIG: Record<MotionStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'Pending', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  discussed: { label: 'Discussed', variant: 'secondary' },
};

interface MotionsHubProps {
  /** Render without the page heading — used when embedded inside another tab. */
  embedded?: boolean;
}

export const MotionsHub = ({ embedded = false }: MotionsHubProps) => {
  const { user, profile } = useAuth();
  const { hasRole } = useUserRole(user?.id);
  const isModerator = profile?.user_type === 'organizer' || profile?.user_type === 'super_admin' || hasRole('admin_student');
  const eventId = profile?.event_id ?? null;

  const [motions, setMotions] = useState<Motion[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [students, setStudents] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<MotionType | 'all'>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [motionType, setMotionType] = useState<MotionType>('adjournment_motion');
  const [raisedBy, setRaisedBy] = useState('');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [updateMotion, setUpdateMotion] = useState<Motion | null>(null);
  const [updateType, setUpdateType] = useState<MotionType>('adjournment_motion');
  const [updateSubject, setUpdateSubject] = useState('');
  const [updateDetails, setUpdateDetails] = useState('');
  const [updateStatus, setUpdateStatus] = useState<MotionStatus>('pending');
  const [updateOutcome, setUpdateOutcome] = useState('');
  const [updateSubmitting, setUpdateSubmitting] = useState(false);
  const [deleteMotionId, setDeleteMotionId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchMotions = async () => {
    try {
      let query = supabase
        .from('motions' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (eventId) query = query.eq('event_id', eventId);

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data as any as Motion[]) || [];
      setMotions(rows);

      const userIds = [...new Set(rows.map(m => m.raised_by))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, name, party_name, committee')
          .in('user_id', userIds);
        const map: Record<string, ProfileLite> = {};
        (profilesData || []).forEach((p: any) => { map[p.user_id] = p; });
        setProfiles(map);
      }
    } catch (error) {
      console.error('Error fetching motions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMotions();

    const channel = supabase
      .channel('motions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'motions' }, () => fetchMotions())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  useEffect(() => {
    if (!isModerator) return;
    const fetchStudents = async () => {
      let query = supabase
        .from('profiles' as any)
        .select('user_id, name, party_name, committee')
        .eq('user_type', 'student');
      if (eventId) query = query.eq('event_id', eventId);

      const { data } = await query.order('name');
      setStudents((data as any as ProfileLite[]) || []);
    };
    fetchStudents();
  }, [isModerator, eventId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: motions.length };
    MOTION_TYPE_ORDER.forEach(t => { c[t] = motions.filter(m => m.motion_type === t).length; });
    return c;
  }, [motions]);

  const filteredMotions = useMemo(
    () => (typeFilter === 'all' ? motions : motions.filter(m => m.motion_type === typeFilter)),
    [motions, typeFilter]
  );

  const resetForm = () => {
    setMotionType('adjournment_motion');
    setRaisedBy('');
    setSubject('');
    setDetails('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    const targetRaisedBy = isModerator ? raisedBy : user.id;
    if (isModerator && !targetRaisedBy) {
      toast.error('Select a participant to raise this motion for');
      return;
    }

    setSubmitting(true);
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const { error, queued } = await executeOrQueue({
        table: 'motions',
        type: 'insert',
        payload: {
          id,
          event_id: eventId,
          motion_type: motionType,
          subject: subject.trim(),
          details: details.trim() || null,
          raised_by: targetRaisedBy,
          created_by: user.id,
          status: 'pending',
        },
        description: `Motion: ${MOTION_TYPES[motionType].label}`,
      });
      if (error) throw error;
      resetForm();
      setFormOpen(false);
      if (queued) {
        setMotions(prev => [{
          id,
          event_id: eventId,
          motion_type: motionType,
          subject: subject.trim(),
          details: details.trim() || null,
          raised_by: targetRaisedBy,
          created_by: user.id,
          status: 'pending',
          outcome: null,
          created_at: now,
          updated_at: now,
        }, ...prev]);
        toast.success("Saved offline — will sync once you're back online");
      } else {
        toast.success('Motion raised');
        fetchMotions();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to raise motion');
    } finally {
      setSubmitting(false);
    }
  };

  const openUpdateDialog = (m: Motion) => {
    setUpdateMotion(m);
    setUpdateType(m.motion_type);
    setUpdateSubject(m.subject);
    setUpdateDetails(m.details || '');
    setUpdateStatus(m.status);
    setUpdateOutcome(m.outcome || '');
  };

  const handleUpdateSave = async () => {
    if (!updateMotion) return;
    if (!updateSubject.trim()) { toast.error('Subject is required'); return; }
    setUpdateSubmitting(true);
    const patch: Record<string, any> = {
      motion_type: updateType,
      subject: updateSubject.trim(),
      details: updateDetails.trim() || null,
    };
    // Moderators can also change status + outcome; authors editing their own can only touch content
    if (isModerator) {
      patch.status = updateStatus;
      patch.outcome = updateOutcome.trim() || null;
    }
    try {
      const { error } = await supabase
        .from('motions' as any)
        .update(patch)
        .eq('id', updateMotion.id);
      if (error) throw error;
      toast.success('Motion updated');
      setUpdateMotion(null);
      fetchMotions();
    } catch {
      toast.error('Failed to update motion');
    } finally {
      setUpdateSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteMotionId) return;
    setDeleteSubmitting(true);
    try {
      const { error } = await supabase.from('motions' as any).delete().eq('id', deleteMotionId);
      if (error) throw error;
      toast.success('Motion deleted');
      fetchMotions();
    } catch {
      toast.error('Failed to delete motion');
    } finally {
      setDeleteSubmitting(false);
      setDeleteMotionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const content = (
    <div className="space-y-6">
      {/* Filter chips + raise button */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all font-headline ${
              typeFilter === 'all'
                ? 'bg-primary text-white shadow-sm shadow-primary/20'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            All ({counts.all})
          </button>
          {MOTION_TYPE_ORDER.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all font-headline ${
                typeFilter === t
                  ? 'bg-primary text-white shadow-sm shadow-primary/20'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {MOTION_TYPES[t].label} ({counts[t] || 0})
            </button>
          ))}
        </div>

        <Button
          onClick={() => setFormOpen(o => !o)}
          className="rounded-full bg-primary hover:bg-primary-container text-white font-headline font-black text-[11px] uppercase tracking-[0.15em] px-6 h-11"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Raise Motion
        </Button>
      </div>

      {/* Raise a New Motion form */}
      {formOpen && (
        <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm p-6 lg:p-8">
          <h3 className="text-lg font-extrabold font-headline text-on-surface tracking-tight mb-5">Raise a New Motion</h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className={`grid grid-cols-1 ${isModerator ? 'lg:grid-cols-2' : ''} gap-5`}>
              <div>
                <Label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest block mb-2 font-headline">
                  Motion Type
                </Label>
                <Select value={motionType} onValueChange={(v) => setMotionType(v as MotionType)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTION_TYPE_ORDER.map(t => (
                      <SelectItem key={t} value={t}>{MOTION_TYPES[t].label} ({MOTION_TYPES[t].page})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-on-surface-variant/60 mt-2 leading-relaxed font-body">
                  {MOTION_TYPES[motionType].description}
                </p>
              </div>

              {isModerator && (
                <div>
                  <Label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest block mb-2 font-headline">
                    Raised By
                  </Label>
                  <Select value={raisedBy} onValueChange={setRaisedBy}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select participant" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map(s => (
                        <SelectItem key={s.user_id} value={s.user_id}>
                          {s.name}{s.party_name ? ` · ${s.party_name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div>
              <Label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest block mb-2 font-headline">
                Subject
              </Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="A brief title for the motion"
                className="rounded-xl"
              />
            </div>

            <div>
              <Label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest block mb-2 font-headline">
                Details
              </Label>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Provide supporting context for the House (optional)"
                rows={4}
                className="rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => { setFormOpen(false); resetForm(); }} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="rounded-xl bg-primary hover:bg-primary-container">
                {submitting ? 'Raising…' : 'Raise Motion'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Motions table */}
      {filteredMotions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm p-12 text-center">
          <Gavel className="w-10 h-10 text-on-surface-variant/30 mx-auto mb-4" />
          <p className="font-body text-on-surface-variant font-medium">No motions raised yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Raised By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMotions.map((m) => {
                const p = profiles[m.raised_by];
                const status = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.pending;
                const isOwner = m.raised_by === user?.id || m.created_by === user?.id;
                const canEdit = isModerator || (isOwner && m.status === 'pending');
                const canDelete = isModerator || (isOwner && m.status === 'pending');
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-primary/10 text-primary font-headline whitespace-nowrap">
                        {MOTION_TYPES[m.motion_type]?.label || m.motion_type}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="font-bold font-headline text-on-surface text-sm">{m.subject}</p>
                      {m.details && (
                        <p className="text-xs text-on-surface-variant mt-1 leading-relaxed line-clamp-2">{m.details}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-on-surface">{p?.name || 'Unknown'}</TableCell>
                    <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                    <TableCell className="text-on-surface-variant text-sm max-w-xs">{m.outcome || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                          <Button variant="outline" size="sm" onClick={() => openUpdateDialog(m)} className="rounded-xl font-bold text-xs">
                            Edit
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteMotionId(m.id)} className="rounded-xl text-on-surface-variant/50 hover:text-error hover:bg-error/10" title="Delete motion">
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog — author (pending) or moderator */}
      <Dialog open={!!updateMotion} onOpenChange={(open) => !open && setUpdateMotion(null)}>
        <DialogContent className="rounded-3xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline font-extrabold text-on-surface">Edit Motion</DialogTitle>
            <DialogDescription className="font-body text-on-surface-variant">
              {updateMotion && `Editing: ${updateMotion.subject}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest block mb-2 font-headline">Motion Type</Label>
              <Select value={updateType} onValueChange={(v) => setUpdateType(v as MotionType)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOTION_TYPE_ORDER.map(t => (
                    <SelectItem key={t} value={t}>{MOTION_TYPES[t].label} ({MOTION_TYPES[t].page})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest block mb-2 font-headline">Subject</Label>
              <Input value={updateSubject} onChange={(e) => setUpdateSubject(e.target.value)} placeholder="Motion subject" className="rounded-xl" />
            </div>
            <div>
              <Label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest block mb-2 font-headline">Details</Label>
              <Textarea value={updateDetails} onChange={(e) => setUpdateDetails(e.target.value)} placeholder="Supporting context (optional)" rows={3} className="rounded-xl" />
            </div>
            {isModerator && (
              <>
                <div className="border-t border-outline-variant/20 pt-4">
                  <Label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest block mb-2 font-headline">Status</Label>
                  <Select value={updateStatus} onValueChange={(v) => setUpdateStatus(v as MotionStatus)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_CONFIG) as MotionStatus[]).map(s => (
                        <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest block mb-2 font-headline">Outcome</Label>
                  <Textarea value={updateOutcome} onChange={(e) => setUpdateOutcome(e.target.value)} placeholder="Record the House's decision or remarks..." rows={3} className="rounded-xl" />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUpdateMotion(null)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleUpdateSave} disabled={updateSubmitting} className="rounded-xl bg-primary hover:bg-primary-container">
              {updateSubmitting ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteMotionId} onOpenChange={(open) => !open && setDeleteMotionId(null)}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <div className="w-12 h-12 bg-error/10 rounded-2xl flex items-center justify-center mb-2">
              <X className="w-5 h-5 text-error" />
            </div>
            <DialogTitle className="font-headline font-bold text-on-surface">Delete Motion?</DialogTitle>
            <DialogDescription className="font-body text-on-surface-variant">
              This motion will be permanently removed from the parliamentary record.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteMotionId(null)} className="rounded-xl flex-1">Cancel</Button>
            <Button onClick={handleDelete} disabled={deleteSubmitting} className="rounded-xl flex-1 bg-red-500 hover:bg-red-600 text-white">
              {deleteSubmitting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (embedded) return content;

  return (
    <div>
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
          Parliamentary <span className="text-secondary">Motions</span>
        </h1>
        <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
          <Gavel className="w-3 h-3" />
          Raise & Track Formal Motions
        </p>
      </header>
      {content}
    </div>
  );
};

export default MotionsHub;
