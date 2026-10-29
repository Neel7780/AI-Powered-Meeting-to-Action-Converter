import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  Mail,
  Plus,
  Search,
  Shield,
  User,
  Users,
  X,
} from "lucide-react";

import { Button } from "../ui/button";
import { reviewApi } from "../../services/reviewApi";
import type { WorkspaceMember } from "../../types/review";

interface ParticipantPickerProps {
  workspaceId: string;
  selectedMemberIds: string[];
  onSelectedMemberIdsChange: (ids: string[]) => void;
  externalParticipants: string[];
  onExternalParticipantsChange: (externals: string[]) => void;
  onMembersLoaded?: (members: WorkspaceMember[]) => void;
}

const AVATAR_PALETTES = [
  "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  "border-indigo-500/30 bg-indigo-500/15 text-indigo-300",
  "border-purple-500/30 bg-purple-500/15 text-purple-300",
  "border-amber-500/30 bg-amber-500/15 text-amber-300",
  "border-rose-500/30 bg-rose-500/15 text-rose-300",
  "border-cyan-500/30 bg-cyan-500/15 text-cyan-300",
  "border-blue-500/30 bg-blue-500/15 text-blue-300",
];

function getAvatarPalette(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ParticipantPicker({
  workspaceId,
  selectedMemberIds,
  onSelectedMemberIdsChange,
  externalParticipants,
  onExternalParticipantsChange,
  onMembersLoaded,
}: ParticipantPickerProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [guestInput, setGuestInput] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch workspace members
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    reviewApi
      .fetchWorkspaceMembers(workspaceId)
      .then((data) => {
        if (!cancelled) {
          setMembers(data);
          onMembersLoaded?.(data);
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch workspace members for picker:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, onMembersLoaded]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  const selectedMembers = useMemo(() => {
    return members.filter((m) =>
      selectedMemberIds.includes(m.user_id || m.id)
    );
  }, [members, selectedMemberIds]);

  const isAllSelected = members.length > 0 && selectedMemberIds.length >= members.length;

  const toggleMember = (memberId: string) => {
    if (selectedMemberIds.includes(memberId)) {
      onSelectedMemberIdsChange(selectedMemberIds.filter((id) => id !== memberId));
    } else {
      onSelectedMemberIdsChange([...selectedMemberIds, memberId]);
    }
  };

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      onSelectedMemberIdsChange([]);
    } else {
      const allIds = members.map((m) => m.user_id || m.id);
      onSelectedMemberIdsChange(allIds);
    }
  };

  const handleAddGuest = () => {
    const trimmed = guestInput.trim();
    if (!trimmed) return;

    // Check if comma-separated list was pasted
    const parts = trimmed
      .split(/[,;\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);

    const newGuests = parts.filter(
      (p) => !externalParticipants.includes(p)
    );

    if (newGuests.length > 0) {
      onExternalParticipantsChange([...externalParticipants, ...newGuests]);
    }
    setGuestInput("");
  };

  const handleRemoveGuest = (guest: string) => {
    onExternalParticipantsChange(
      externalParticipants.filter((g) => g !== guest)
    );
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-300">
            <Shield className="size-2.5" />
            Admin
          </span>
        );
      case "meeting_organiser":
      case "organiser":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
            <Calendar className="size-2.5" />
            Organiser
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
            <User className="size-2.5" />
            Member
          </span>
        );
    }
  };

  return (
    <div className="space-y-3">
      {/* Label and Quick Actions */}
      <div className="flex items-center justify-between">
        <div>
          <label className="field-label mb-0">Meeting participants</label>
          <p className="text-xs text-neutral-400">
            Select joined workspace members and optional external guests.
          </p>
        </div>

        {members.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSelectAllToggle}
            className="h-7 px-2 text-xs text-neutral-300 hover:text-white"
          >
            {isAllSelected ? "Deselect all members" : `Select all (${members.length})`}
          </Button>
        )}
      </div>

      {/* Workspace Member Dropdown Picker */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="field flex min-h-[42px] w-full items-center justify-between gap-2 px-3 py-2 text-left hover:border-white/20 transition-colors"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Users className="size-4 text-neutral-400 shrink-0" />
            {loading ? (
              <span className="text-xs text-neutral-500">Loading workspace members…</span>
            ) : selectedMemberIds.length === 0 ? (
              <span className="text-xs text-neutral-400">
                Click to select joined workspace members…
              </span>
            ) : (
              <div className="flex items-center gap-1.5 truncate">
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300 shrink-0">
                  {selectedMemberIds.length} member{selectedMemberIds.length !== 1 ? "s" : ""} selected
                </span>
                <span className="text-xs text-neutral-300 truncate">
                  {selectedMembers.map((m) => m.full_name).join(", ")}
                </span>
              </div>
            )}
          </div>

          <ChevronDown
            className={`size-4 text-neutral-400 shrink-0 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-hidden rounded-md border border-white/15 bg-black/95 shadow-2xl backdrop-blur-md">
            {/* Search filter inside dropdown */}
            <div className="border-b border-white/10 p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-neutral-500 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by name or email…"
                  className="field h-8 pl-8 pr-2 text-xs w-full"
                  autoFocus
                />
              </div>
            </div>

            {/* Members List */}
            <div className="max-h-56 overflow-y-auto divide-y divide-white/5 p-1">
              {filteredMembers.length === 0 ? (
                <div className="py-6 text-center text-xs text-neutral-500">
                  {searchQuery ? "No members match your search" : "No members found in workspace"}
                </div>
              ) : (
                filteredMembers.map((member) => {
                  const memberId = member.user_id || member.id;
                  const isSelected = selectedMemberIds.includes(memberId);
                  const palette = getAvatarPalette(memberId);
                  const initials = member.initials || getInitials(member.full_name);

                  return (
                    <button
                      key={memberId}
                      type="button"
                      onClick={() => toggleMember(memberId)}
                      className={`flex w-full items-center justify-between gap-3 rounded p-2 text-left text-xs transition-colors ${
                        isSelected
                          ? "bg-white/10 text-white"
                          : "text-neutral-300 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Custom checkbox */}
                        <div
                          className={`grid size-4 shrink-0 place-items-center rounded border transition-colors ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-500 text-black"
                              : "border-white/20 bg-white/5"
                          }`}
                        >
                          {isSelected && <Check className="size-3 stroke-[3]" />}
                        </div>

                        {/* Avatar */}
                        <div
                          className={`grid size-7 shrink-0 place-items-center rounded-full border text-[10px] font-semibold ${palette}`}
                        >
                          {initials}
                        </div>

                        {/* Identity */}
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{member.full_name}</p>
                          <p className="text-[11px] text-neutral-400 truncate">{member.email}</p>
                        </div>
                      </div>

                      <div className="shrink-0">{getRoleBadge(member.role)}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected Members Chips */}
      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedMembers.map((member) => {
            const memberId = member.user_id || member.id;
            const palette = getAvatarPalette(memberId);
            const initials = member.initials || getInitials(member.full_name);

            return (
              <span
                key={memberId}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-1 pl-1.5 pr-2 text-xs text-neutral-200"
              >
                <span
                  className={`grid size-5 place-items-center rounded-full border text-[9px] font-bold ${palette}`}
                >
                  {initials}
                </span>
                <span className="font-medium text-white">{member.full_name}</span>
                <button
                  type="button"
                  onClick={() => toggleMember(memberId)}
                  className="rounded-full p-0.5 text-neutral-400 hover:bg-white/10 hover:text-white"
                  title={`Remove ${member.full_name}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* External Guests Input */}
      <div className="pt-2">
        <label htmlFor="guest-input" className="field-label text-xs text-neutral-400">
          Additional external guests <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-500 pointer-events-none" />
            <input
              id="guest-input"
              type="text"
              value={guestInput}
              onChange={(e) => setGuestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddGuest();
                }
              }}
              placeholder="e.g. client@external.com, advisor@consulting.com"
              className="field h-9 pl-9 text-xs w-full"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddGuest}
            disabled={!guestInput.trim()}
            className="h-9 gap-1 px-3 text-xs"
          >
            <Plus className="size-3.5" />
            <span>Add</span>
          </Button>
        </div>
      </div>

      {/* External Guests Chips */}
      {externalParticipants.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {externalParticipants.map((guest) => (
            <span
              key={guest}
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 py-1 pl-2.5 pr-2 text-xs text-indigo-200"
            >
              <Mail className="size-3 text-indigo-400 shrink-0" />
              <span>{guest}</span>
              <button
                type="button"
                onClick={() => handleRemoveGuest(guest)}
                className="rounded-full p-0.5 text-indigo-400 hover:bg-indigo-500/20 hover:text-white"
                title={`Remove ${guest}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
