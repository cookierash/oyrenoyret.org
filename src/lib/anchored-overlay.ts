'use client';

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

/**
 * Positions a small overlay (menus/popovers) relative to a trigger element and
 * clamps it into the viewport on mobile to avoid off-screen dropdowns.
 */
export type AnchoredOverlayAlign = 'start' | 'center' | 'end';
export type AnchoredOverlaySide = 'bottom' | 'top';

export interface AnchoredOverlayOptions {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  overlayRef: RefObject<HTMLElement | null>;
  align?: AnchoredOverlayAlign;
  preferSide?: AnchoredOverlaySide;
  sideOffset?: number;
  collisionPadding?: number;
  zIndex?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function useAnchoredOverlayStyle({
  open,
  triggerRef,
  overlayRef,
  align = 'start',
  preferSide = 'bottom',
  sideOffset = 6,
  collisionPadding = 8,
  zIndex = 1000,
}: AnchoredOverlayOptions): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties>();

  useLayoutEffect(() => {
    if (!open) {
      setStyle(undefined);
      return;
    }

    const trigger = triggerRef.current;
    const overlay = overlayRef.current;
    if (!trigger || !overlay) {
      return;
    }

    const update = () => {
      const triggerRect = trigger.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const availableBelow = viewportHeight - collisionPadding - (triggerRect.bottom + sideOffset);
      const availableAbove = triggerRect.top - collisionPadding - sideOffset;

      const overlayHeight = overlayRect.height;
      const canFitBelow = overlayHeight <= availableBelow;
      const canFitAbove = overlayHeight <= availableAbove;

      let side: AnchoredOverlaySide = preferSide;
      if (preferSide === 'bottom' && !canFitBelow && canFitAbove) side = 'top';
      if (preferSide === 'top' && !canFitAbove && canFitBelow) side = 'bottom';
      if (!canFitBelow && !canFitAbove) side = availableBelow >= availableAbove ? 'bottom' : 'top';

      const maxHeight =
        side === 'bottom'
          ? Math.max(0, viewportHeight - collisionPadding - (triggerRect.bottom + sideOffset))
          : Math.max(0, triggerRect.top - sideOffset - collisionPadding);

      let top =
        side === 'bottom'
          ? triggerRect.bottom + sideOffset
          : triggerRect.top - sideOffset - overlayRect.height;
      top = clamp(top, collisionPadding, viewportHeight - collisionPadding - Math.min(overlayRect.height, maxHeight));

      let left = triggerRect.left;
      if (align === 'center') left = triggerRect.left + triggerRect.width / 2 - overlayRect.width / 2;
      if (align === 'end') left = triggerRect.right - overlayRect.width;
      left = clamp(left, collisionPadding, viewportWidth - collisionPadding - overlayRect.width);

      setStyle({
        position: 'fixed',
        top: Math.round(top),
        left: Math.round(left),
        maxHeight: Math.floor(maxHeight),
        zIndex,
      });
    };

    update();

    const supportsResizeObserver = typeof ResizeObserver !== 'undefined';
    const ro = supportsResizeObserver ? new ResizeObserver(update) : null;
    ro?.observe(trigger);
    ro?.observe(overlay);

    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('scroll', update, true);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, triggerRef, overlayRef, align, preferSide, sideOffset, collisionPadding, zIndex]);

  return style;
}
