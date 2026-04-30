import React from 'react';

export type DocumentLogoKey = 'pramod_hotels_resorts' | 'pramod_lands_end_radisson';

export const DOCUMENT_LOGOS: Array<{ value: DocumentLogoKey; label: string }> = [
  { value: 'pramod_hotels_resorts', label: 'Pramod Hotels & Resorts' },
  { value: 'pramod_lands_end_radisson', label: 'Pramod Lands End Gopalpur' },
];

interface DocumentLogoProps {
  logo?: string | null;
  className?: string;
}

export function normalizeDocumentLogo(logo?: string | null): DocumentLogoKey {
  return logo === 'pramod_lands_end_radisson' ? 'pramod_lands_end_radisson' : 'pramod_hotels_resorts';
}

export function DocumentLogo({ logo, className = '' }: DocumentLogoProps) {
  const key = normalizeDocumentLogo(logo);

  if (key === 'pramod_lands_end_radisson') {
    return (
      <svg viewBox="0 0 520 260" role="img" aria-label="Pramod Lands End Gopalpur, member of Radisson Individuals" className={className}>
        <path d="M76 83 C158 43, 361 43, 444 83" fill="none" stroke="#565b60" strokeWidth="4" />
        <path d="M222 68 L237 105 L250 40 L260 108 L270 40 L283 105 L298 68 L292 119 C271 110 250 110 229 119 Z" fill="#565b60" />
        <text x="260" y="152" textAnchor="middle" fontFamily="Georgia, serif" fontSize="58" letterSpacing="5" fill="#565b60">PRAMOD</text>
        <text x="260" y="190" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="20" fontWeight="700" letterSpacing="10" fill="#565b60">LANDS END GOPALPUR</text>
        <line x1="96" y1="218" x2="424" y2="218" stroke="#777" strokeWidth="5" />
        <text x="260" y="244" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="16" letterSpacing="4" fill="#64686d">MEMBER OF RADISSON INDIVIDUALS</text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 520 190" role="img" aria-label="Pramod Hotels and Resorts" className={className}>
      <path d="M76 75 C158 35, 361 35, 444 75" fill="none" stroke="#565b60" strokeWidth="4" />
      <path d="M222 60 L237 97 L250 32 L260 100 L270 32 L283 97 L298 60 L292 111 C271 102 250 102 229 111 Z" fill="#565b60" />
      <text x="260" y="144" textAnchor="middle" fontFamily="Georgia, serif" fontSize="58" letterSpacing="5" fill="#565b60">PRAMOD</text>
      <text x="260" y="178" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="20" fontWeight="700" fontStyle="italic" letterSpacing="10" fill="#565b60">HOTELS &amp; RESORTS</text>
    </svg>
  );
}
