import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getPartyLetter(partyNumber: number): string {
  const partyMap: Record<number, string> = { 0: 'No Party', 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H', 9: 'I', 10: 'J' };
  return partyMap[partyNumber] || partyNumber.toString();
}

export const PARLIAMENT_COMMITTEES = [
  'IT & Education',
  'Women and Child Safety',
  'Health & Sports',
  'Environment & Road Transport',
  'Tourism and Culture',
] as const;

export type ParliamentCommittee = typeof PARLIAMENT_COMMITTEES[number];
