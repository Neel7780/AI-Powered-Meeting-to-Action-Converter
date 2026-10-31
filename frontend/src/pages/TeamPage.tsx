import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";

import AddMemberModal from "../components/workspace/AddMemberModal";
import { Button } from "../components/ui/button";
import { Notice } from "../components/ui/notice";
import { useAuth } from "../context/AuthContext";
import { useWorkspace, type AppRole } from "../context/WorkspaceContext";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { postApi } from "../services/reviewApi";

export interface TeamMember {
  userId: string;
  role: AppRole;
  joinedAt: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  isCurrentUser: boolean;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: AppRole;
  createdAt: string;
  expiresAt: string;
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

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "Recently";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Recently";
  }
}

const DEMO_MEMBERS: TeamMember[] = [
  {
    userId: "00000000-0000-0000-0000-000000000001",
    role: "admin",
    joinedAt: "2026-10-15T10:00:00.000Z",
    displayName: "Neel Khatri",
    email: "neelkhatri7780@gmail.com",
    avatarUrl: null,
    isCurrentUser: true,
  },
  {
    userId: "demo-user-2",
    role: "organiser",
    joinedAt: "2026-10-18T14:30:00.000Z",
    displayName: "Manali Malani",
    email: "manali.malani@actionpulse.io",
    avatarUrl: null,
    isCurrentUser: false,
  },
  {
    userId: "demo-user-3",
    role: "member",
    joinedAt: "2026-10-22T09:15:00.000Z",
    displayName: "Krishna Parmar",
    email: "krishna.parmar@actionpulse.io",
    avatarUrl: null,
    isCurrentUser: false,
  },
  {
    userId: "demo-user-4",
    role: "member",
    joinedAt: "2026-10-25T11:45:00.000Z",
    displayName: "Devansh Rathod",
    email: "devansh.rathod@actionpulse.io",
    avatarUrl: null,
    isCurrentUser: false,
  },
];

export default function TeamPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentWorkspace, currentRole, refreshWorkspaces } = useWorkspace();

  const workspaceId = currentWorkspace?.id;
  const isAdmin = currentRole === "admin";
  const isOrganiserOrAdmin = currentRole === "admin" || currentRole === "organiser";

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadTeamData = useCallback(async () => {
    if (!workspaceId) {
      setMembers([]);
      setPendingInvites([]);
      setLoading(false);
      return;
    }

    // Dev test user gets demo members directly
    if (user?.id === "00000000-0000-0000-0000-000000000001" || !isSupabaseConfigured) {
      setMembers(DEMO_MEMBERS);
      setPendingInvites([]);
      setLoading(false);
      return;
    }

    setError(null);

    try {
      // 1. Fetch all members in this workspace
      const { data: memberRows, error: memberErr } = await supabase
        .from("workspace_members")
        .select("workspace_id, user_id, role, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      if (memberErr) throw memberErr;

      const userIds = (memberRows || []).map((m) => m.user_id);

      // 2. Fetch profiles for user_ids
      const profileMap = new Map<
        string,
        { id: string; display_name: string | null; email: string | null; avatar_url: string | null }
      >();

      if (userIds.length > 0) {
        const { data: profileRows, error: profileErr } = await supabase
          .from("profiles")
          .select("id, display_name, email, avatar_url")
          .in("id", userIds);

        if (!profileErr && profileRows) {
          profileRows.forEach((p) => profileMap.set(p.id, p));
        }
      }

      // 3. Map members with profile data and fallback logic
      const mapped: TeamMember[] = (memberRows || []).map((m) => {
        const prof = profileMap.get(m.user_id);
        const isCurrentUser = m.user_id === user?.id;

        let displayName = prof?.display_name?.trim();
        let email = prof?.email?.trim();

        if (!email && isCurrentUser && user?.email) {
          email = user.email;
        }

        if (!displayName && isCurrentUser && user?.user_metadata?.full_name) {
          displayName = user.user_metadata.full_name;
        }

        if (!displayName && email) {
          displayName = email.split("@")[0];
        }

        if (!displayName) {
          displayName = "Team Member";
        }

        return {
          userId: m.user_id,
          role: m.role as AppRole,
          joinedAt: m.created_at,
          displayName,
          email: email || "No email listed",
          avatarUrl: prof?.avatar_url,
          isCurrentUser,
        };
      });

      setMembers(mapped);

      // 4. If admin or organiser, fetch pending invites
      if (isAdmin) {
        const { data: inviteRows, error: inviteErr } = await supabase
          .from("workspace_invites")
          .select("id, email, role, created_at, expires_at, accepted_at")
          .eq("workspace_id", workspaceId)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false });

        if (!inviteErr && inviteRows) {
          setPendingInvites(
            inviteRows.map((inv) => ({
              id: inv.id,
              email: inv.email,
              role: inv.role as AppRole,
              createdAt: inv.created_at,
              expiresAt: inv.expires_at,
            }))
          );
        } else {
          setPendingInvites([]);
        }
      } else {
        setPendingInvites([]);
      }
    } catch (err: any) {
      console.error("Error loading team data:", err);
      setError(err.message || "Failed to load workspace members.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [workspaceId, user, isAdmin]);

  useEffect(() => {
    setLoading(true);
    loadTeamData();
  }, [loadTeamData]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadTeamData();
  };

  const handleAddMember = async (email: string, role: "organiser" | "member") => {
    if (!workspaceId) throw new Error("Select a workspace first.");
    await postApi(`/api/workspaces/${workspaceId}/invites`, { email, role });
    setActionSuccess(`Invitation sent to ${email}.`);
    setTimeout(() => setActionSuccess(null), 5000);
    await loadTeamData();
  };

  const handleRevokeInvite = async (inviteId: string, email: string) => {
    if (!window.confirm(`Revoke invitation sent to ${email}?`)) return;

    setActionLoadingId(inviteId);
    setActionError(null);

    try {
      const { error: delErr } = await supabase
        .from("workspace_invites")
        .delete()
        .eq("id", inviteId);

      if (delErr) throw delErr;

      setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
      setActionSuccess(`Revoked invitation for ${email}.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error("Error revoking invite:", err);
      setActionError(err.message || "Failed to revoke invitation.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (!workspaceId) return;

    if (member.isCurrentUser) {
      alert("To leave this workspace, please use the Leave Workspace option.");
      return;
    }

    if (!window.confirm(`Are you sure you want to remove ${member.displayName} (${member.email}) from this workspace?`)) {
      return;
    }

    setActionLoadingId(member.userId);
    setActionError(null);

    try {
      const { error: removeErr } = await supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("user_id", member.userId);

      if (removeErr) throw removeErr;

      setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
      setActionSuccess(`Removed ${member.displayName} from workspace.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error("Error removing member:", err);
      setActionError(err.message || "Failed to remove member.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLeaveWorkspace = async () => {
    if (!workspaceId) return;

    if (!window.confirm(`Are you sure you want to leave ${currentWorkspace?.name}?`)) {
      return;
    }

    setActionLoadingId("leave");
    setActionError(null);

    try {
      const { error: leaveErr } = await supabase.rpc("leave_workspace", {
        p_workspace_id: workspaceId,
      });

      if (leaveErr) throw leaveErr;

      await refreshWorkspaces();
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Error leaving workspace:", err);
      setActionError(
        err.message || "Failed to leave workspace. Last administrator cannot leave."
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered members list
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      const matchesRole = roleFilter === "all" || m.role === roleFilter;
      const matchesSearch =
        !q ||
        m.displayName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q);
      return matchesRole && matchesSearch;
    });
  }, [members, searchQuery, roleFilter]);

  const stats = useMemo(() => {
    const total = members.length;
    const admins = members.filter((m) => m.role === "admin").length;
    const organisers = members.filter((m) => m.role === "organiser").length;
    const standardMembers = members.filter((m) => m.role === "member").length;
    return { total, admins, organisers, standardMembers };
  }, [members]);

  const getRoleBadge = (role: AppRole) => {
    switch (role) {
      case "admin":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-300">
            <Shield className="size-3" />
            Admin
          </span>
        );
      case "organiser":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
            <Calendar className="size-3" />
            Organiser
          </span>
        );
      case "member":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-neutral-300">
            <User className="size-3" />
            Member
          </span>
        );
    }
  };

  if (!workspaceId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="panel w-full max-w-md p-8 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-md border border-white/15 bg-white/5 text-white">
            <Building2 className="size-5" />
          </span>
          <h2 className="mt-5 text-xl font-medium tracking-tight text-white">No workspace selected</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Select or create a workspace to view team members.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Users className="size-4" />
            </span>
            <p className="eyebrow">Workspace Members</p>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Team Directory
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            All collaborators who have joined{" "}
            <span className="font-medium text-neutral-200">{currentWorkspace.name}</span>.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
            title="Refresh members list"
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {isOrganiserOrAdmin && (
            <Button
              size="sm"
              onClick={() => setShowInviteModal(true)}
              className="gap-1.5"
            >
              <UserPlus className="size-3.5" />
              <span>Invite Member</span>
            </Button>
          )}
        </div>
      </div>

      {/* Notifications / Feedback */}
      {actionSuccess && (
        <Notice tone="success">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </span>
        </Notice>
      )}

      {actionError && (
        <Notice tone="error">
          <span className="flex items-center gap-2">
            <AlertCircle className="size-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </span>
        </Notice>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      {/* Stats Badges */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="panel p-4 flex items-center justify-between">
          <div>
            <p className="eyebrow">Total Members</p>
            <p className="mt-1 text-2xl font-semibold text-white">{stats.total}</p>
          </div>
          <span className="grid size-9 place-items-center rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
            <Users className="size-4" />
          </span>
        </div>

        <div className="panel p-4 flex items-center justify-between">
          <div>
            <p className="eyebrow">Admins</p>
            <p className="mt-1 text-2xl font-semibold text-purple-300">{stats.admins}</p>
          </div>
          <span className="grid size-9 place-items-center rounded-md border border-purple-500/25 bg-purple-500/10 text-purple-400">
            <Shield className="size-4" />
          </span>
        </div>

        <div className="panel p-4 flex items-center justify-between">
          <div>
            <p className="eyebrow">Organisers</p>
            <p className="mt-1 text-2xl font-semibold text-indigo-300">{stats.organisers}</p>
          </div>
          <span className="grid size-9 place-items-center rounded-md border border-indigo-500/25 bg-indigo-500/10 text-indigo-400">
            <Calendar className="size-4" />
          </span>
        </div>

        <div className="panel p-4 flex items-center justify-between">
          <div>
            <p className="eyebrow">Pending Invites</p>
            <p className="mt-1 text-2xl font-semibold text-amber-300">
              {isAdmin ? pendingInvites.length : "—"}
            </p>
          </div>
          <span className="grid size-9 place-items-center rounded-md border border-amber-500/25 bg-amber-500/10 text-amber-400">
            <Clock className="size-4" />
          </span>
        </div>
      </div>

      {/* Main Panel: Members Directory */}
      <section className="panel overflow-hidden">
        {/* Controls: Search and Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 p-4">
          {/* Search box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="field h-9 pl-9 text-xs w-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {(
              [
                { id: "all", label: `All (${members.length})` },
                { id: "admin", label: `Admins (${stats.admins})` },
                { id: "organiser", label: `Organisers (${stats.organisers})` },
                { id: "member", label: `Members (${stats.standardMembers})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRoleFilter(tab.id)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  roleFilter === tab.id
                    ? "bg-white/15 text-white"
                    : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Member Rows / Table */}
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center gap-3 text-sm text-neutral-500">
            <RefreshCw className="size-4 animate-spin" />
            Loading members…
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-16 text-center">
            <UserCheck className="mx-auto size-8 text-neutral-600" />
            <p className="mt-3 text-sm font-medium text-white">No members found</p>
            <p className="mt-1 text-xs text-neutral-500">
              {searchQuery
                ? `No members match "${searchQuery}".`
                : "No members match the selected role filter."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredMembers.map((member) => {
              const palette = getAvatarPalette(member.userId);
              const initials = getInitials(member.displayName);
              const isBusy = actionLoadingId === member.userId;

              return (
                <div
                  key={member.userId}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Left: Avatar & Identity */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`grid size-10 shrink-0 place-items-center rounded-full border font-semibold text-xs ${palette}`}
                    >
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-white truncate">
                          {member.displayName}
                        </p>
                        {member.isCurrentUser && (
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">
                            You
                          </span>
                        )}
                        <span className="sm:hidden">{getRoleBadge(member.role)}</span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-neutral-400 mt-0.5 truncate">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="size-3 shrink-0 text-neutral-500" />
                          <span className="truncate">{member.email}</span>
                        </span>
                        <span className="text-neutral-600">•</span>
                        <span className="text-neutral-500 shrink-0">
                          Joined {formatDate(member.joinedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Role & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="hidden sm:block">{getRoleBadge(member.role)}</div>

                    {/* Member actions */}
                    <div className="flex items-center gap-2">
                      {isAdmin && !member.isCurrentUser && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member)}
                          disabled={isBusy}
                          className="text-xs text-neutral-400 hover:text-rose-400 gap-1 h-8"
                          title="Remove member from workspace"
                        >
                          <UserMinus className="size-3.5" />
                          <span className="hidden md:inline">Remove</span>
                        </Button>
                      )}

                      {member.isCurrentUser && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleLeaveWorkspace}
                          disabled={actionLoadingId === "leave"}
                          className="text-xs text-neutral-400 hover:text-rose-400 gap-1 h-8"
                          title="Leave this workspace"
                        >
                          <LogOut className="size-3.5" />
                          <span className="hidden md:inline">Leave</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pending Invitations Section (Admins Only) */}
      {isAdmin && pendingInvites.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-amber-400" />
              <h2 className="text-sm font-medium text-white">Pending Invitations</h2>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                {pendingInvites.length}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Invitations expire 7 days after sending.
            </p>
          </div>

          <div className="divide-y divide-white/5">
            {pendingInvites.map((invite) => {
              const isBusy = actionLoadingId === invite.id;
              return (
                <div
                  key={invite.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid size-9 shrink-0 place-items-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold">
                      <Mail className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{invite.email}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Invited {formatDate(invite.createdAt)} as{" "}
                        <span className="text-neutral-300 capitalize">{invite.role}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] uppercase text-amber-300">
                      Pending
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeInvite(invite.id, invite.email)}
                      disabled={isBusy}
                      className="text-xs text-neutral-400 hover:text-rose-400 gap-1 h-8"
                      title="Revoke invite"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Revoke</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Invite Member Modal */}
      <AddMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onAddMember={handleAddMember}
      />
    </div>
  );
}
