'use client';
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, useSpring, useTransform, SpringOptions } from 'framer-motion';
import { cn } from '@/lib/utils';

type SpotlightProps = {
  className?: string;
  size?: number;
  springOptions?: SpringOptions;
};

export function Spotlight({
  className,
  size = 300,
  springOptions = { stiffness: 150, damping: 15, mass: 0.1 },
}: SpotlightProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [parentElement, setParentElement] = useState<HTMLElement | null>(null);

  const mouseX = useSpring(0, springOptions);
  const mouseY = useSpring(0, springOptions);

  const spotlightLeft = useTransform(mouseX, (x) => `${x - size / 2}px`);
  const spotlightTop = useTransform(mouseY, (y) => `${y - size / 2}px`);

  useEffect(() => {
    // Use a timeout to ensure DOM is ready
    const timer = setTimeout(() => {
      if (containerRef.current) {
        // Find the parent element (should be the Card)
        let parent = containerRef.current.parentElement;
        
        // If wrapped in a div, go up one more level
        if (parent && parent.classList.contains('absolute')) {
          parent = parent.parentElement;
        }
        
        // Traverse up to find the element with relative positioning
        while (parent && parent !== document.body) {
          const computedStyle = window.getComputedStyle(parent);
          // Check if it has relative positioning (the Card should have this)
          if (computedStyle.position === 'relative' || 
              computedStyle.position === 'absolute' ||
              parent.classList.contains('relative')) {
            break;
          }
          parent = parent.parentElement;
        }
        
        if (parent) {
          // Ensure parent has required styles
          parent.style.position = 'relative';
          parent.style.overflow = 'hidden';
          setParentElement(parent);
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!parentElement) return;
      const rect = parentElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      mouseX.set(x);
      mouseY.set(y);
    },
    [mouseX, mouseY, parentElement]
  );

  useEffect(() => {
    if (!parentElement) {
      console.warn('[Spotlight] No parent element, cannot attach event listeners');
      return;
    }

    console.log('[Spotlight] Attaching event listeners to parent');

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => setIsHovered(false);

    parentElement.addEventListener('mousemove', handleMouseMove);
    parentElement.addEventListener('mouseenter', handleMouseEnter);
    parentElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      parentElement.removeEventListener('mousemove', handleMouseMove);
      parentElement.removeEventListener('mouseenter', handleMouseEnter);
      parentElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [parentElement, handleMouseMove]);

  return (
    <motion.div
      ref={containerRef}
      className={cn(
        'pointer-events-none absolute rounded-full blur-3xl',
        className
      )}
      style={{
        width: size,
        height: size,
        left: spotlightLeft,
        top: spotlightTop,
        background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.2) 30%, rgba(255,255,255,0.1) 50%, transparent 80%)',
        opacity: isHovered ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    />
  );
}
