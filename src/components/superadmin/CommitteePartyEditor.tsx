const fieldCls = 'w-full bg-surface-container-low border-none rounded-2xl px-6 py-4 text-sm font-body focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all appearance-none outline-none placeholder:text-outline/50';

export const defaultCommitteeName = (idx: number) => `Committee ${idx + 1}`;
export const defaultPartyName = (idx: number) =>
  idx < 26 ? `Party ${String.fromCharCode(65 + idx)}` : `Party ${idx + 1}`;

export const defaultCommittees = (count: number) =>
  Array.from({ length: count }, (_, i) => defaultCommitteeName(i));
export const defaultParties = (count: number) =>
  Array.from({ length: count }, (_, i) => defaultPartyName(i));

const resizeList = (list: string[], count: number, namer: (idx: number) => string) => {
  if (count <= list.length) return list.slice(0, count);
  const next = [...list];
  for (let i = list.length; i < count; i++) next.push(namer(i));
  return next;
};

interface EditableListProps {
  title: string;
  items: string[];
  onChange: (next: string[]) => void;
  namer: (idx: number) => string;
}

const EditableList = ({ title, items, onChange, namer }: EditableListProps) => {
  const handleCountChange = (raw: string) => {
    const n = Math.max(1, parseInt(raw, 10) || 1);
    onChange(resizeList(items, n, namer));
  };

  const handleNameChange = (idx: number, value: string) => {
    const next = [...items];
    next[idx] = value;
    onChange(next);
  };

  return (
    <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Count</label>
          <input
            type="number"
            min={1}
            value={items.length}
            onChange={e => handleCountChange(e.target.value)}
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
              onChange={e => handleNameChange(idx, e.target.value)}
              placeholder={namer(idx)}
              className={fieldCls}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

interface CommitteePartyEditorProps {
  committees: string[];
  parties: string[];
  onCommitteesChange: (next: string[]) => void;
  onPartiesChange: (next: string[]) => void;
}

export const CommitteePartyEditor = ({ committees, parties, onCommitteesChange, onPartiesChange }: CommitteePartyEditorProps) => (
  <div className="space-y-6">
    <EditableList title="Committees" items={committees} onChange={onCommitteesChange} namer={defaultCommitteeName} />
    <EditableList title="Parties" items={parties} onChange={onPartiesChange} namer={defaultPartyName} />
  </div>
);
