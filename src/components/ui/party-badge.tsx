import React from "react";
import { Badge } from "@/components/ui/badge";

interface PartyBadgeProps {
  partyNumber: number;
  partyName?: string;
  className?: string;
  size?: "sm" | "md";
}

// Party badge: pill shape with unique color per party
const partyPillClasses = [
  "bg-red-500 text-white border-red-600",
  "bg-blue-500 text-white border-blue-600",
  "bg-green-500 text-white border-green-600",
  "bg-yellow-500 text-white border-yellow-600",
  "bg-purple-500 text-white border-purple-600",
  "bg-pink-500 text-white border-pink-600",
  "bg-indigo-500 text-white border-indigo-600",
  "bg-teal-500 text-white border-teal-600",
];

export const PartyBadge: React.FC<PartyBadgeProps> = ({ partyNumber, partyName, className = "", size = "sm" }) => {
  const idx = Math.abs(partyNumber || 0) % partyPillClasses.length;
  const base = partyPillClasses[idx] ?? "bg-slate-500 text-white border-slate-600";
  const padd = size === "sm" ? "px-4 py-1 text-xs" : "px-5 py-1.5 text-sm";
  return (
    <Badge className={`rounded-full border shadow-sm font-semibold tracking-tight whitespace-nowrap ${base} ${padd} ${className}`}>
      {partyName ? `${partyName} (${partyNumber})` : `Party ${partyNumber}`}
    </Badge>
  );
};

export default PartyBadge;
