import React from "react";
import { Badge } from "@/components/ui/badge";

interface PartyBadgeProps {
  partyNumber: number;
  className?: string;
  size?: "sm" | "md";
}

// Unified party badge style to match reference (red pill)
export const PartyBadge: React.FC<PartyBadgeProps> = ({ partyNumber, className = "", size = "sm" }) => {
  const padd = size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm";
  const base = "rounded-full bg-red-500 text-white border border-red-600 shadow-sm";
  return (
    <Badge className={`${base} font-semibold tracking-tight ${padd} ${className}`}>Party {partyNumber}</Badge>
  );
};

export default PartyBadge;
