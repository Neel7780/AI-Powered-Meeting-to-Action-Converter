import { useState, useRef, useEffect } from 'react';

interface EmojiPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Frequently Used',
    emojis: ['👍', '❤️', '🔥', '🚀', '🎉', '😂', '👀', '👏', '💯', '✅', '🙌', '✨'],
  },
  {
    name: 'Smileys & People',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇',
      '🥰', '😍', '🤩', '😘', '😋', '😜', '🤪', '😎', '🤓', '🧐', '🥳', '😏',
      '🤔', '🤫', '🤭', '🥱', '😴', '😷', '🤒', '🤯', '🤠', '🥳', '🥺', '😭',
    ],
  },
  {
    name: 'Gestures & Reactions',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤙', '👈', '👉', '👆', '👇', '☝️',
      '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪', '🧠', '👀', '👁️', '👂', '👃',
    ],
  },
  {
    name: 'Objects & Symbols',
    emojis: [
      '🔥', '⭐', '🌟', '✨', '⚡', '💡', '💬', '📢', '🎯', '🚀', '🎉', '🏆',
      '🥇', '🎖️', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '⚠️',
      '✅', '❌', '❓', '❗', '📌', '📎', '🔒', '🔑', '📊', '📈', '📦', '💻',
    ],
  },
];

export default function EmojiPickerPopover({
  isOpen,
  onClose,
  onSelect,
}: EmojiPickerPopoverProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [filter, setFilter] = useState('');
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

  const currentCategory = EMOJI_CATEGORIES[activeTab];
  const displayedEmojis = filter.trim()
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((e) => e.includes(filter.trim()))
    : currentCategory.emojis;

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-14 right-4 z-50 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:w-88"
    >
      {/* Category Tabs */}
      <div className="flex border-b border-slate-100 pb-2">
        {EMOJI_CATEGORIES.map((cat, idx) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => {
              setActiveTab(idx);
              setFilter('');
            }}
            className={`flex-1 py-1 text-xs font-medium transition ${
              activeTab === idx && !filter
                ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {cat.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="mt-3 grid max-h-56 grid-cols-8 gap-1 overflow-y-auto p-1">
        {displayedEmojis.map((emoji, index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:scale-125 hover:bg-slate-100 active:scale-95"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Quick Reaction Row */}
      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-400">
        <span>Click emoji to insert</span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600"
        >
          Close
        </button>
      </div>
    </div>
  );
}

