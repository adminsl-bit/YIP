import React from "react";
import { Badge } from "@/components/ui/badge";

interface PartyBadgeProps {
  partyNumber: number;
  className?: string;
  size?: "sm" | "md";
}

// Consistent party badge mapping across the app
const partyClasses = [
  "bg-red-500/90 text-white border-red-600",
  "bg-blue-500/90 text-white border-blue-600",
  "bg-green-500/90 text-white border-green-600",
  "bg-yellow-500/90 text-white border-yellow-600",
  "bg-purple-500/90 text-white border-purple-600",
  "bg-pink-500/90 text-white border-pink-600",
  "bg-indigo-500/90 text-white border-indigo-600",
  "bg-teal-500/90 text-white border-teal-600",
];

export const PartyBadge: React.FC<PartyBadgeProps> = ({ partyNumber, className = "", size = "sm" }) => {
  const idx = Math.max(0, (partyNumber - 1) % partyClasses.length);
  const base = partyClasses[idx] ?? "bg-slate-500/90 text-white border-slate-600";
  const padd = size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm";
  return (
    <Badge className={`${base} border font-bold ${padd} ${className}`}>Party {partyNumber}</Badge>
  );
};

export default PartyBadge;
