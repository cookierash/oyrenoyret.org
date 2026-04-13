'use client';

import { useEffect, useMemo, useState } from 'react';
import { PiCaretLeft as CaretLeft, PiCaretRight as CaretRight, PiX as X } from 'react-icons/pi';
import { cn } from '@/src/lib/utils';
import { sanitizeDiscussionRichTextHtml } from '@/src/security/validation';
import { getDiscussionImageSrc } from '@/src/lib/discussion-images';

type DiscussionImage = { src: string; alt: string };

function extractImagesFromHtml(html: string): { html: string; images: DiscussionImage[] } {
  if (typeof window === 'undefined') return { html, images: [] };
  const images: DiscussionImage[] = [];

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return { html, images: [] };

  const imgs = Array.from(root.querySelectorAll('img'));
  for (const img of imgs) {
    const srcRaw = img.getAttribute('src')?.trim() ?? '';
    const src = getDiscussionImageSrc(srcRaw) ?? '';
    if (!src) {
      img.remove();
      continue;
    }
    const alt = img.getAttribute('alt')?.trim() ?? '';
    images.push({ src, alt });

    const parent = img.parentElement;
    const shouldRemoveParent =
      parent?.tagName === 'P' &&
      parent.querySelectorAll('img').length === 1 &&
      parent.querySelectorAll('*').length === 1 &&
      (parent.textContent ?? '').trim() === '';

    if (shouldRemoveParent) {
      parent?.remove();
    } else {
      img.remove();
    }
  }

  // Remove empty paragraphs left behind.
  for (const p of Array.from(root.querySelectorAll('p'))) {
    const text = (p.textContent ?? '').replace(/\u00a0/g, ' ').trim();
    const hasMedia = p.querySelector('img, video, iframe') != null;
    if (!text && !hasMedia) {
      const raw = (p.innerHTML ?? '').replace(/\s+/g, '').toLowerCase();
      if (!raw || raw === '<br>' || raw === '<br/>' || raw === '<br></br>') {
        p.remove();
      }
    }
  }

  return { html: root.innerHTML, images };
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function PreviewOverlay({
  open,
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  open: boolean;
  images: DiscussionImage[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, onPrev, onNext]);

  if (!open) return null;
  const img = images[index];
  if (!img) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close preview"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/60"
        >
          <X className="h-4 w-4" />
        </button>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={onPrev}
              className="absolute left-2 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/60"
            >
              <CaretLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={onNext}
              className="absolute right-2 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/60"
            >
              <CaretRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        <div className="overflow-hidden rounded-xl bg-black">
          <img
            src={img.src}
            alt={img.alt}
            className="h-[80vh] w-full object-contain"
            loading="eager"
            decoding="async"
          />
        </div>

        {images.length > 1 ? (
          <p className="mt-3 text-center text-xs text-white/80">
            {index + 1} / {images.length}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DiscussionImageCarousel({ images }: { images: DiscussionImage[] }) {
  const [index, setIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setIndex((current) => mod(current, images.length));
  }, [images.length]);

  const current = images[index];
  if (!current) return null;

  const prev = () => setIndex((i) => mod(i - 1, images.length));
  const next = () => setIndex((i) => mod(i + 1, images.length));

  return (
    <>
      <div className="relative h-64 w-full overflow-hidden rounded-lg bg-muted/30 sm:h-72">
        <button
          type="button"
          className="absolute inset-0"
          aria-label="Open image preview"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPreviewOpen(true);
          }}
        >
          <img
            src={current.src}
            alt={current.alt}
            className="h-full w-full object-contain"
            loading="lazy"
            decoding="async"
          />
        </button>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                prev();
              }}
              className="absolute left-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm hover:bg-background"
            >
              <CaretLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                next();
              }}
              className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm hover:bg-background"
            >
              <CaretRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-2 right-2 rounded-full bg-background/80 px-2 py-1 text-[11px] font-medium text-foreground shadow-sm">
              {index + 1}/{images.length}
            </div>
          </>
        ) : null}
      </div>

      <PreviewOverlay
        open={previewOpen}
        images={images}
        index={index}
        onClose={() => setPreviewOpen(false)}
        onPrev={prev}
        onNext={next}
      />
    </>
  );
}

export function DiscussionRichText({
  content,
  className,
  contentClassName,
}: {
  content: string;
  className?: string;
  contentClassName?: string;
}) {
  const sanitized = useMemo(() => sanitizeDiscussionRichTextHtml(content), [content]);
  const extracted = useMemo(() => extractImagesFromHtml(sanitized), [sanitized]);

  const textHtml = extracted.html.trim();
  const images = extracted.images;

  return (
    <div className={cn('space-y-4', className)}>
      {textHtml ? (
        <div
          className={cn(
            'document-editor-content text-sm text-foreground/90 leading-relaxed break-words',
            contentClassName,
          )}
          dangerouslySetInnerHTML={{ __html: textHtml }}
        />
      ) : null}
      {images.length ? <DiscussionImageCarousel images={images} /> : null}
    </div>
  );
}
