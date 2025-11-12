import React from "react";

// Component to render actual logo images
interface LogoImageProps {
  src: string;
  alt: string;
  className?: string;
}

const LogoImage: React.FC<LogoImageProps> = ({ src, alt, className }) => (
  <img 
    src={src} 
    alt={alt} 
    className={`h-20 w-20 max-h-[80%] max-w-[80%] object-contain md:h-32 md:w-32 ${className}`}
  />
);

// Updated partner logo components using actual images
export const YoungIndiansIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <LogoImage 
    src="/lovable-uploads/b93a2667-930b-46e3-8255-3dd39f221efa.png"
    alt="Young Indians Logo"
    {...props}
  />
);

export const ThalirIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <LogoImage 
    src="/lovable-uploads/e2443cf2-1a59-4c3f-bc2d-bff47813fca2.png"
    alt="Thalir Logo"
    {...props}
  />
);

export const CIIIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <LogoImage 
    src="/lovable-uploads/db62c137-04e3-4da3-9a7b-0c5e69a9a9ed.png"
    alt="CII Logo"
    {...props}
  />
);

export const MahatmaIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <LogoImage 
    src="/lovable-uploads/777acbc8-8619-4301-8157-ecc04d8a3bd5.png"
    alt="Mahatma Truth Triumphs Logo"
    {...props}
  />
);

export const SriKaliSwariIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <LogoImage 
    src="/lovable-uploads/af8acb1d-8b4a-4953-8417-d68cb25de6b7.png"
    alt="Sri Kali Swari Packaging Logo"
    {...props}
  />
);

export const BharatRisingIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <LogoImage 
    src="/lovable-uploads/695b5310-e626-4f28-a51f-ef93a30f00d1.png"
    alt="Bharat Rising Logo"
    {...props}
  />
);

export const WondrDiamondsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <LogoImage 
    src="/lovable-uploads/00711fa5-1798-4c2f-9e0f-1c92b1be1dda.png"
    alt="Wondr Diamonds Logo"
    {...props}
  />
);

export const StrawlabsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <LogoImage 
    src="/lovable-uploads/strawlabs.png"
    alt="Strawlabs Logo"
    {...props}
  />
);