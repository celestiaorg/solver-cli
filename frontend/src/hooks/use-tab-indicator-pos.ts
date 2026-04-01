import { useEffect, useRef } from 'react';

import { useIsMobileDevice } from './use-is-mobile-device';

/**
 * @description This hook is used to position the indicator of the tab using the width and transform properties.
 *
 * @note If this hook does not work specially in dialog components, check out the implementation in
 * src/app/(group)/(home-tabs)/stake/components/transact.tsx:Tabs
 */
export const useTabIndicatorPosition = <
  TNavItem extends { id: string },
>(config: {
  navItems: TNavItem[];
  activeId: string;
  widthScale?: number;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const childRefs = useRef<Map<number, HTMLElement | null>>(new Map());
  const isMobile = useIsMobileDevice();

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.setProperty('position', 'relative');
    }

    if (indicatorRef.current) {
      const properties = {
        position: 'absolute',
        transformOrigin: 'left',
        'transition-property': 'transform, translate, scale, rotate, width',
        'transition-timing-function':
          'var(--tw-ease, var(--default-transition-timing-function)',
        'transition-duration':
          'var(--tw-duration, var(--default-transition-duration)',
      };
      Object.entries(properties).forEach(([key, value]) => {
        indicatorRef.current?.style.setProperty(key, value);
      });
    }
  }, [containerRef, indicatorRef]);

  useEffect(() => {
    const idx =
      config.navItems.findIndex(item => item.id === config.activeId) ?? 0;
    const target = childRefs.current.get(idx);
    const container = containerRef.current;

    if (!target || !container) {
      indicatorRef.current?.style.setProperty(
        'transform',
        'translateX(0) scaleX(0)'
      );
      return;
    }

    const cRect = container.getBoundingClientRect();
    if (cRect.width === 0) return;

    const widthScale = config.widthScale ?? 1;
    const translateXScale = (1 - widthScale) / 2;

    const tRect = target.getBoundingClientRect();
    const buttonWidth = tRect.width;
    // const containerWidth = cRect.width
    // const scaleX = (buttonWidth / containerWidth) * widthScale // 70% of button width
    const translateX = tRect.left - cRect.left + buttonWidth * translateXScale; // Center the indicator

    indicatorRef.current?.style.setProperty(
      'transform',
      `translateX(${translateX}px)`
    );

    // using width instead of scale cuz the border radius
    // the border radius will get distorted when using scale
    indicatorRef.current?.style.setProperty('width', `${buttonWidth}px`);
  }, [containerRef, config, isMobile]);

  return { containerRef, indicatorRef, childRefs };
};
