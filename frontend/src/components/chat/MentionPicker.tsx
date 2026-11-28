import { useEffect, useState, useMemo } from 'react';
import type { UserProfile } from '../../types/workspaceChat';

interface MentionPickerProps {
  query: string;
  members: UserProfile[];
  onSelect: (member: UserProfile) => void;
  onClose: () => void;
}

export default function MentionPicker({
  query,
  members,
  onSelect,
  onClose,
}: MentionPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members.slice(0, 8);
    return members
      .filter((m) => {
        const name = (m.display_name || '').toLowerCase();
        const email = (m.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 8);
  }, [members, query]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredMembers]);

  // Listen to keyboard navigation globally while active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredMembers.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredMembers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filteredMembers[selectedIndex]) {
          e.preventDefault();
          onSelect(filteredMembers[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [filteredMembers, selectedIndex, onSelect, onClose]);

  if (filteredMembers.length === 0) {
    return null;
  }

  return (
    <div
      role="listbox"
      aria-label="Mention members"
      className="absolute bottom-full left-4 mb-2 z-50 w-64 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl transition animate-in fade-in slide-in-from-bottom-2 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Mention Member
      </div>
      {filteredMembers.map((member, index) => {
        const isSelected = index === selectedIndex;
        const displayName = member.display_name || member.email?.split('@')[0] || 'Member';
        const initial = displayName.charAt(0).toUpperCase();

        return (
          <button
            key={member.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(member)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition ${
              isSelected
                ? 'bg-indigo-50 font-medium text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200'
                : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
            }`}
          >
            {member.avatar_url ? (
              <img
                src={member.avatar_url}
                alt={displayName}
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-[10px] font-bold text-white shadow-xs">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{displayName}</p>
              {member.email && (
                <p className="truncate text-[10px] text-slate-400">{member.email}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

