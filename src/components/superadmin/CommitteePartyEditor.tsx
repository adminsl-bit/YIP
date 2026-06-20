const fieldCls = 'flex-1 bg-surface-container-low border-none rounded-2xl px-5 py-3.5 text-sm font-body focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all appearance-none outline-none placeholder:text-outline/50';

export const defaultCommitteeName = (idx: number) => `Committee ${idx + 1}`;
export const defaultPartyName = (idx: number) =>
  idx < 26 ? `Party ${String.fromCharCode(65 + idx)}` : `Party ${idx + 1}`;

export const defaultCommittees = (count: number) =>
  Array.from({ length: count }, (_, i) => defaultCommitteeName(i));
export const defaultParties = (count: number) =>
  Array.from({ length: count }, (_, i) => defaultPartyName(i));

export interface PartyItem {
  name: string;
  alignment: 'ruling_party' | 'opposition';
}

export const defaultPartyItems = (count: number): PartyItem[] =>
  Array.from({ length: count }, (_, i) => ({
    name: defaultPartyName(i),
    // First half ruling, rest opposition (mirrors the old automatic threshold)
    alignment: i < Math.floor(count / 2) + 1 ? 'ruling_party' : 'opposition',
  }));

const resizeCommittees = (list: string[], count: number) => {
  if (count <= list.length) return list.slice(0, count);
  const next = [...list];
  for (let i = list.length; i < count; i++) next.push(defaultCommitteeName(i));
  return next;
};

const resizeParties = (list: PartyItem[], count: number): PartyItem[] => {
  if (count <= list.length) return list.slice(0, count);
  const next = [...list];
  for (let i = list.length; i < count; i++) {
    next.push({ name: defaultPartyName(i), alignment: 'opposition' });
  }
  return next;
};

// ── Committee list (names only) ────────────────────────────────────────────
interface CommitteeListProps {
  items: string[];
  onChange: (next: string[]) => void;
}

const CommitteeList = ({ items, onChange }: CommitteeListProps) => (
  <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 space-y-4">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Committees</p>
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Count</label>
        <input
          type="number" min={1} value={items.length}
          onChange={e => onChange(resizeCommittees(items, Math.max(1, parseInt(e.target.value, 10) || 1)))}
          className="w-16 bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm font-bold text-center focus:ring-2 focus:ring-primary/20 outline-none"
        />
      </div>
    </div>
    <div className="space-y-2">
      {items.map((name, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0">
            {idx + 1}
          </span>
          <input
            value={name}
            onChange={e => { const next = [...items]; next[idx] = e.target.value; onChange(next); }}
            placeholder={defaultCommitteeName(idx)}
            className={fieldCls}
          />
        </div>
      ))}
    </div>
  </div>
);

// ── Party list with Ruling / Opposition toggle ─────────────────────────────
interface PartyListProps {
  items: PartyItem[];
  onChange: (next: PartyItem[]) => void;
}

const PartyList = ({ items, onChange }: PartyListProps) => {
  const setName = (idx: number, name: string) => {
    const next = [...items]; next[idx] = { ...next[idx], name }; onChange(next);
  };
  const setAlignment = (idx: number, alignment: 'ruling_party' | 'opposition') => {
    const next = [...items]; next[idx] = { ...next[idx], alignment }; onChange(next);
  };

  return (
    <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Parties</p>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Count</label>
          <input
            type="number" min={1} value={items.length}
            onChange={e => onChange(resizeParties(items, Math.max(1, parseInt(e.target.value, 10) || 1)))}
            className="w-16 bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm font-bold text-center focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Ruling Party
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Opposition
        </span>
      </div>

      <div className="space-y-2">
        {items.map((party, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0">
              {idx + 1}
            </span>
            <input
              value={party.name}
              onChange={e => setName(idx, e.target.value)}
              placeholder={defaultPartyName(idx)}
              className={fieldCls}
            />
            {/* Ruling / Opposition toggle */}
            <div className="flex items-center gap-1 p-1 bg-surface-container rounded-2xl shrink-0">
              <button
                type="button"
                onClick={() => setAlignment(idx, 'ruling_party')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  party.alignment === 'ruling_party'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-emerald-600'
                }`}
              >
                Ruling
              </button>
              <button
                type="button"
                onClick={() => setAlignment(idx, 'opposition')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  party.alignment === 'opposition'
                    ? 'bg-red-400 text-white shadow-sm'
                    : 'text-slate-400 hover:text-red-500'
                }`}
              >
                Opposition
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Combined editor ────────────────────────────────────────────────────────
interface CommitteePartyEditorProps {
  committees: string[];
  parties: PartyItem[];
  onCommitteesChange: (next: string[]) => void;
  onPartiesChange: (next: PartyItem[]) => void;
}

export const CommitteePartyEditor = ({
  committees, parties, onCommitteesChange, onPartiesChange,
}: CommitteePartyEditorProps) => (
  <div className="space-y-6">
    <CommitteeList items={committees} onChange={onCommitteesChange} />
    <PartyList items={parties} onChange={onPartiesChange} />
  </div>
);
