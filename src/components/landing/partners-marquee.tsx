import Image from 'next/image';

interface PartnerLogo {
  src: string;
  name: string;
}

interface PartnersMarqueeProps {
  partners: PartnerLogo[];
}

export function PartnersMarquee({ partners }: PartnersMarqueeProps) {
  if (!partners.length) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="mx-auto flex w-full flex-row flex-wrap items-center justify-center gap-4 text-center sm:gap-6 lg:max-w-4xl lg:flex-nowrap">
        <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
          our partners
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {partners.map((partner) => (
            <div
              key={partner.src}
              className="flex h-10 items-center justify-center px-4"
            >
              <Image
                src={partner.src}
                alt={partner.name}
                width={120}
                height={40}
                className="h-7 w-auto object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
