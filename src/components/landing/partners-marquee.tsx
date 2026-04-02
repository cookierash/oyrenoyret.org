const partners = [
  'Partner 1',
  'Partner 2',
  'Partner 3',
  'Partner 4',
  'Partner 5',
  'Partner 6',
  'Partner 7',
];

export function PartnersMarquee() {
  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 text-left sm:flex-row sm:items-center sm:gap-6">
        <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
          our partners
        </p>
        <div className="partners-marquee w-full flex-1">
          <div className="partners-track text-sm text-muted-foreground">
            {partners.map((partner) => (
              <div
                key={partner}
                className="rounded-full border border-border/60 bg-background/70 px-4 py-2"
              >
                {partner}
              </div>
            ))}
            {partners.map((partner, index) => (
              <div
                key={`${partner}-${index}`}
                className="rounded-full border border-border/60 bg-background/70 px-4 py-2"
              >
                {partner}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
