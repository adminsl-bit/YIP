import React from "react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Play, Pause, CheckCircle } from "lucide-react";

interface SessionItem {
  id: string;
  title: string;
  bill_type: 'private_member_bill' | 'government_bill' | 'committee_report' | 'question_hour' | 'general_discussion';
  description: string | null;
  sort_order: number;
  timer_id: string | null;
  poll_id: string | null;
  status: 'pending' | 'active' | 'completed';
  is_active: boolean;
  session_date: string | null;
  created_at: string;
}

interface TimerSession {
  id: string;
  title: string;
  status: string;
  remaining_seconds: number;
  duration_seconds: number;
  updated_at: string;
}

interface Poll {
  id: string;
  title: string;
  is_active: boolean;
  show_results_publicly: boolean;
}

interface SortableSessionItemProps {
  item: SessionItem;
  index: number;
  availableTimers: TimerSession[];
  availablePolls: Poll[];
  loading: boolean;
  onTimerControl: (timerId: string | null, action: 'start' | 'pause' | 'stop' | 'reset') => void;
  onPollToggle: (pollId: string | null, currentActive: boolean) => void;
  onEditSession: (session: SessionItem) => void;
  onDeleteSession: (sessionId: string) => void;
  onActivateItem: (itemId: string, currentActive: boolean) => void;
  onCompleteItem: (itemId: string) => void;
  formatTime: (seconds: number) => string;
  isAdminStudent?: boolean;
  getDisplayedRemaining: (timer: TimerSession | undefined) => number;
}

export const SortableSessionItem = React.memo(({
  item,
  index,
  availableTimers,
  availablePolls,
  loading,
  onTimerControl,
  onPollToggle,
  onEditSession,
  onDeleteSession,
  onActivateItem,
  onCompleteItem,
  formatTime,
  isAdminStudent = false,
  getDisplayedRemaining,
}: SortableSessionItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const linkedTimer = availableTimers.find(t => t.id === item.timer_id);
  const linkedPoll   = availablePolls.find(p => p.id === item.poll_id);

  const typeLabel: Record<string, string> = {
    government_bill:    'Govt Bill',
    private_member_bill:'Private Bill',
    committee_report:   'Committee',
    question_hour:      'Question Hour',
    general_discussion: 'Discussion',
  };

  return (
    <div ref={setNodeRef} style={style} className={`group relative transition-all duration-300 ${isDragging ? 'z-50' : 'z-0'}`}>
      <div className={`
        relative bg-surface-container-lowest rounded-3xl p-5 shadow-sm border-l-4 transition-all duration-300
        ${item.is_active ? 'border-primary shadow-md -translate-x-1' : 'border-transparent'}
        ${item.status === 'completed' ? 'opacity-60' : ''}
        hover:shadow-md hover:border-primary/20
      `}>

        {/* Active indicator dot */}
        {item.is_active && (
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-primary rounded-full flex items-center justify-center ring-4 ring-surface-container z-10">
            <span className="material-symbols-outlined text-white text-xs font-black">play_arrow</span>
          </div>
        )}

        <div className="flex justify-between items-start gap-4">

          {/* Left — info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[9px] font-black uppercase tracking-widest ${
                item.is_active ? 'text-primary' :
                item.status === 'completed' ? 'text-tertiary' : 'text-on-surface-variant/40'
              }`}>
                {item.is_active ? 'Ongoing' : item.status === 'completed' ? 'Completed' : `#${index}`}
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest bg-surface-container px-2 py-0.5 rounded-lg text-on-surface-variant/60">
                {typeLabel[item.bill_type] ?? item.bill_type}
              </span>
            </div>

            <h3 className="font-headline font-bold text-sm text-on-surface tracking-tight truncate">{item.title}</h3>

            {/* Timer + Poll status badges */}
            <div className="flex flex-wrap gap-2 mt-3">
              {linkedTimer && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                  linkedTimer.status === 'running'
                    ? 'bg-secondary/10 text-secondary border-secondary/20'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant/10'
                }`}>
                  <span className="material-symbols-outlined text-sm">timer</span>
                  {formatTime(item.is_active ? getDisplayedRemaining(linkedTimer) : linkedTimer.duration_seconds)}
                  {item.is_active && (
                    <button
                      onClick={() => onTimerControl(item.timer_id, linkedTimer.status === 'running' ? 'pause' : 'start')}
                      className="ml-1 pl-1.5 border-l border-current opacity-60 hover:opacity-100"
                    >
                      {linkedTimer.status === 'running'
                        ? <Pause className="w-2.5 h-2.5" />
                        : <Play className="w-2.5 h-2.5" />}
                    </button>
                  )}
                </div>
              )}

              {linkedPoll && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                  linkedPoll.is_active
                    ? 'bg-tertiary/10 text-tertiary border-tertiary/20'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant/10'
                }`}>
                  <span className="material-symbols-outlined text-sm">how_to_vote</span>
                  Poll {linkedPoll.is_active ? 'Open' : 'Closed'}
                  {item.is_active && (
                    <button
                      onClick={() => onPollToggle(item.poll_id, linkedPoll.is_active)}
                      className="ml-1 pl-1.5 border-l border-current opacity-60 hover:opacity-100"
                    >
                      <span className="material-symbols-outlined text-xs">{linkedPoll.is_active ? 'lock' : 'lock_open'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right — actions */}
          <div className="flex flex-col items-end gap-3 shrink-0">
            <div className="flex items-center gap-1">
              {!isAdminStudent && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEditSession(item)} className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-xl transition-colors">
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button onClick={() => onDeleteSession(item.id)} className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/5 rounded-xl transition-colors">
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              )}
              <button
                {...attributes}
                {...listeners}
                className="p-1.5 text-on-surface-variant/30 hover:text-on-surface-variant cursor-grab active:cursor-grabbing"
              >
                <span className="material-symbols-outlined text-base">drag_indicator</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {item.status !== 'completed' ? (
                <button
                  onClick={() => onActivateItem(item.id, item.is_active)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all ${
                    item.is_active
                      ? 'bg-secondary/10 text-secondary hover:bg-secondary/20'
                      : 'bg-primary text-white hover:shadow-lg hover:shadow-primary/20 active:scale-95'
                  }`}
                >
                  {item.is_active ? 'Deactivate' : 'Activate'}
                </button>
              ) : (
                <span className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-tertiary/10 text-tertiary border border-tertiary/20">
                  Done
                </span>
              )}
              {item.is_active && item.status === 'active' && (
                <button onClick={() => onCompleteItem(item.id)} className="p-1.5 bg-tertiary/10 text-tertiary rounded-xl hover:bg-tertiary/20 transition-colors">
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
});

SortableSessionItem.displayName = "SortableSessionItem";
