import React, { type SVGProps } from "react";

// Young Indians Logo
export function YoungIndiansIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 100"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="200" height="100" fill="#FF6B35" rx="10"/>
      <text x="100" y="35" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">YOUNG</text>
      <text x="100" y="55" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">INDIANS</text>
      <circle cx="100" cy="75" r="8" fill="white"/>
    </svg>
  );
}

// Thalir Logo 
export function ThalirIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 100"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="200" height="100" fill="#8BC34A" rx="10"/>
      <path d="M50 30 Q100 20 150 30 Q150 50 100 60 Q50 50 50 30 Z" fill="white"/>
      <text x="100" y="45" textAnchor="middle" fill="#2E7D32" fontSize="14" fontWeight="bold">thalir</text>
      <text x="100" y="75" textAnchor="middle" fill="white" fontSize="10">LET'S NURTURE FROM SCHOOL</text>
    </svg>
  );
}

// CII Logo
export function CIIIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 100"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="200" height="100" fill="#1565C0" rx="10"/>
      <rect x="30" y="30" width="140" height="20" fill="white" rx="2"/>
      <text x="100" y="43" textAnchor="middle" fill="#1565C0" fontSize="14" fontWeight="bold">CII</text>
      <text x="100" y="70" textAnchor="middle" fill="white" fontSize="8">Confederation of Indian Industry</text>
    </svg>
  );
}

// Mahatma Global Schools Logo
export function MahatmaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 100"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="200" height="100" fill="#4CAF50" rx="10"/>
      <circle cx="100" cy="40" r="15" fill="white"/>
      <text x="100" y="46" textAnchor="middle" fill="#4CAF50" fontSize="10" fontWeight="bold">MGS</text>
      <text x="100" y="70" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">MAHATMA</text>
      <text x="100" y="85" textAnchor="middle" fill="white" fontSize="8">Global Schools</text>
    </svg>
  );
}

// Sri Kali Swari Logo (Cock Brand)
export function SriKaliSwariIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 100"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="200" height="100" fill="#FFD600" rx="10"/>
      <circle cx="50" cy="50" r="25" fill="white"/>
      <path d="M45 40 Q50 35 55 40 Q55 50 50 60 Q45 50 45 40 Z" fill="#FF5722"/>
      <path d="M48 35 Q50 30 52 35" stroke="#FF5722" strokeWidth="2" fill="none"/>
      <text x="130" y="35" fill="#2E7D32" fontSize="12" fontWeight="bold">SRI KALI SWARI</text>
      <text x="130" y="55" fill="#2E7D32" fontSize="10" fontWeight="bold">PACKAGING (P) LTD</text>
      <text x="130" y="75" fill="#FF5722" fontSize="8">COCK BRAND</text>
    </svg>
  );
}

// Bharat Rising Logo
export function BharatRisingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 100"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="200" height="100" fill="#FF9800" rx="10"/>
      <text x="100" y="40" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">BHARAT</text>
      <text x="100" y="65" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">RISING</text>
      <path d="M160 25 L170 35 L160 45 Z" fill="#4CAF50"/>
      <rect x="80" y="75" width="40" height="3" fill="#4CAF50"/>
      <rect x="80" y="81" width="40" height="3" fill="white"/>
      <rect x="80" y="87" width="40" height="3" fill="#FF5722"/>
    </svg>
  );
}