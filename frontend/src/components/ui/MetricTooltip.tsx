import React, { useState, useRef } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricTooltipProps {
  content: string;
  title?: string;
  className?: string;
  side?: 'top' | 'bottom' | 'auto';
  align?: 'left' | 'center' | 'right' | 'auto';
}

export const MetricTooltip: React.FC<MetricTooltipProps> = ({
  content,
  title,
  className,
  side: preferredSide = 'auto',
  align: preferredAlign = 'auto',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [side, setSide] = useState<'top' | 'bottom'>('bottom');
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('right');
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      // Determine vertical side
      if (preferredSide !== 'auto') {
        setSide(preferredSide);
      } else {
        setSide(rect.top < 150 ? 'bottom' : 'top');
      }

      // Determine horizontal alignment
      if (preferredAlign !== 'auto') {
        setAlign(preferredAlign);
      } else {
        const spaceRight = viewportWidth - rect.right;
        const spaceLeft = rect.left;
        if (spaceRight < 240) {
          setAlign('right');
        } else if (spaceLeft < 240) {
          setAlign('left');
        } else {
          setAlign('center');
        }
      }
    }
    setIsVisible(true);
  };

  // Format calculation formulas cleanly
  const renderContent = () => {
    if (content.startsWith('Formula:')) {
      const withoutPrefix = content.slice('Formula:'.length).trim();
      const parts = withoutPrefix.split(' • ');
      const formula = parts[0];
      const interpretation = parts.slice(1).join(' • ');

      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1">
            <span>Calculation Rule</span>
            {title && <span className="text-slate-300 font-semibold normal-case">{title}</span>}
          </div>
          <div className="bg-slate-950/90 px-2 py-1.5 rounded-md border border-slate-800 font-mono text-[11px] text-teal-300 leading-snug break-words">
            {formula}
          </div>
          {interpretation && (
            <p className="text-[11px] text-slate-300 leading-relaxed pt-0.5">
              <span className="text-slate-400 font-medium">Interpretation:</span> {interpretation}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {title && (
          <div className="text-[11px] font-bold text-slate-200 border-b border-slate-800 pb-1 mb-1">
            {title}
          </div>
        )}
        <p className="text-[11px] text-slate-300 leading-relaxed">{content}</p>
      </div>
    );
  };

  const getPlacementClasses = () => {
    const vertical = side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';
    const horizontal =
      align === 'right'
        ? 'right-0 translate-x-0'
        : align === 'left'
        ? 'left-0 translate-x-0'
        : 'left-1/2 -translate-x-1/2';

    return `${vertical} ${horizontal}`;
  };

  const getArrowClasses = () => {
    const vertical =
      side === 'top'
        ? 'top-full -mt-1 border-t-slate-900 border-b-transparent'
        : 'bottom-full -mb-1 border-b-slate-900 border-t-transparent';

    const horizontal =
      align === 'right'
        ? 'right-2'
        : align === 'left'
        ? 'left-2'
        : 'left-1/2 -translate-x-1/2';

    return `${vertical} ${horizontal}`;
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          'text-slate-400 hover:text-slate-600 focus:outline-none transition-colors p-0.5 rounded hover:bg-slate-100',
          className
        )}
        onMouseEnter={handleOpen}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={handleOpen}
        onBlur={() => setIsVisible(false)}
        aria-label="Metric details"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isVisible && (
        <div
          role="tooltip"
          className={cn(
            'absolute z-50 w-72 max-w-[calc(100vw-32px)] p-3 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-800 pointer-events-none transition-all duration-150',
            'normal-case font-normal tracking-normal text-left select-none',
            getPlacementClasses()
          )}
        >
          {renderContent()}
          <div
            className={cn(
              'absolute border-4 border-transparent pointer-events-none',
              getArrowClasses()
            )}
          />
        </div>
      )}
    </div>
  );
};
