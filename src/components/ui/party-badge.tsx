import React from "react";
import { Badge } from "@/components/ui/badge";

interface PartyBadgeProps {
  partyNumber: number;
  partyName?: string;
  partyLogoUrl?: string;
  className?: string;
  size?: "sm" | "md";
}

// Party badge: pill shape with unique color per party
const partyPillClasses = [
  "bg-red-500/10 text-red-700 border-red-200",
  "bg-blue-500/10 text-blue-700 border-blue-200",
  "bg-green-500/10 text-green-700 border-green-200",
  "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  "bg-purple-500/10 text-purple-700 border-purple-200",
  "bg-pink-500/10 text-pink-700 border-pink-200",
  "bg-indigo-500/10 text-indigo-700 border-indigo-200",
  "bg-teal-500/10 text-teal-700 border-teal-200",
];

// Map party numbers to letters for display
const partyNumberToLetter: Record<number, string> = {
  1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 
  6: 'F', 7: 'G', 8: 'H', 9: 'I', 10: 'J'
};

export const PartyBadge: React.FC<PartyBadgeProps> = ({ partyNumber, partyName, partyLogoUrl, className = "", size = "sm" }) => {
  const idx = Math.abs(partyNumber || 0) % partyPillClasses.length;
  const base = partyPillClasses[idx] ?? "bg-slate-100 text-slate-700 border-slate-200";
  const padd = size === "sm" ? "px-3 py-1 text-[10px]" : "px-4 py-1.5 text-xs";
  const partyLetter = partyNumberToLetter[partyNumber] || partyNumber.toString();
  
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {partyLogoUrl && (
        <div className="w-8 h-8 rounded-lg overflow-hidden bg-white shadow-sm border border-slate-100 flex-shrink-0">
          <img src={partyLogoUrl} alt="Party Logo" className="w-full h-full object-cover" />
        </div>
      )}
      <Badge variant="outline" className={`rounded-full border font-black uppercase tracking-widest whitespace-nowrap shadow-none ${base} ${padd}`}>
        {partyName ? `${partyName} (${partyLetter})` : `Party ${partyLetter}`}
      </Badge>
    </div>
  );
};

export default PartyBadge;
