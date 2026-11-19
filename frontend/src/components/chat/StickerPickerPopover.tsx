import { useEffect, useRef } from 'react';
import { STICKER_LIST } from './stickers';

interface StickerPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (stickerCode: string) => void;
}

export default function StickerPickerPopover({
  isOpen,
  onClose,
  onSelect,
}: StickerPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-14 right-16 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Work Stickers
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
        {STICKER_LIST.map((sticker) => (
          <button
            key={sticker.id}
            type="button"
            onClick={() => {
              onSelect(sticker.id);
              onClose();
            }}
            className={`group flex flex-col items-center justify-center rounded-xl bg-gradient-to-br ${sticker.color} p-3 text-center shadow-sm transition hover:scale-105 active:scale-95`}
          >
            <span className={`text-xs font-bold ${sticker.textClass}`}>
              {sticker.label}
            </span>
            <span className={`mt-1 text-[10px] ${sticker.descClass} line-clamp-1`}>
              {sticker.desc}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

