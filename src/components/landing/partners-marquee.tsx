'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useI18n } from '@/src/i18n/i18n-provider';

interface PartnerLogo {
  src: string;
  name: string;
}

interface PartnersMarqueeProps {
  partners: PartnerLogo[];
}

function PartnerLogoImage({
  src,
  alt,
  priority,
}: {
  src: string;
  alt: string;
  priority: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={[
        'relative h-7 w-[120px]',
        'rounded-md',
        !loaded ? 'bg-muted/40 animate-pulse' : 'bg-transparent',
      ].join(' ')}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="120px"
        priority={priority}
        className={[
          'object-contain',
          'transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </div>
  );
}

export function PartnersMarquee({ partners }: PartnersMarqueeProps) {
  const { messages } = useI18n();
  const copy = messages.landing;
  if (!partners.length) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="mx-auto flex w-full flex-row flex-wrap items-center justify-center gap-4 text-center sm:gap-6 lg:max-w-4xl lg:flex-nowrap">
        <p className="text-[11px] font-medium uppercase text-muted-foreground">
          {copy.partnersLabel}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {partners.map((partner, idx) => (
            <div
              key={partner.src}
              className="flex h-10 items-center justify-center px-4"
            >
              <PartnerLogoImage
                src={partner.src}
                alt={partner.name}
                priority={idx < 3}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
