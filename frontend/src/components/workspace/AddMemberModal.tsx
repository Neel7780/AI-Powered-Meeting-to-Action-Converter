import { useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { Notice } from "../ui/notice";

type MemberRole = "organiser" | "member";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMember?: (
    email: string,
    role: MemberRole
  ) => Promise<void> | void;
}

export default function AddMemberModal({
  isOpen,
  onClose,
  onAddMember,
}: AddMemberModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!isOpen) {
    return null;
  }

  const resetForm = () => {
    setEmail("");
    setRole("member");
    setError("");
    setSuccess("");
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError("Please enter an email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);

      if (onAddMember) {
        await onAddMember(trimmedEmail, role);
      }

      setSuccess(
        `Invite sent to ${trimmedEmail} as ${role}.`
      );

      setEmail("");
    } catch (error) {
      console.error("Add member error:", error);
      setError(error instanceof Error ? error.message : "Unable to add member. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-title"
        className="panel w-full max-w-md shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <p className="eyebrow">Workspace access</p>
            <h2 id="add-member-title" className="mt-1.5 text-lg font-medium tracking-tight text-white">
              Add member
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              Send an email invite to join this workspace.
            </p>
          </div>

          <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close modal">
            <X />
          </Button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 p-6"
        >
          <div>
            <label htmlFor="member-email" className="field-label">
              Email address
            </label>
            <input
              id="member-email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="member@example.com"
              disabled={loading}
              className="field"
            />
          </div>

          <div>
            <label htmlFor="member-role" className="field-label">
              Workspace role
            </label>
            <select
              id="member-role"
              value={role}
              onChange={(event) =>
                setRole(event.target.value as MemberRole)
              }
              disabled={loading}
              className="field cursor-pointer"
            >
              <option value="member">
                Team Member
              </option>

              <option value="organiser">
                Meeting Organiser
              </option>
            </select>
          </div>

          {error && <Notice tone="error">{error}</Notice>}
          {success && <Notice tone="success">{success}</Notice>}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
