import { useState } from "react";
import type { FormEvent } from "react";

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
        `Member ${trimmedEmail} is ready to be added as ${role}.`
      );

      setEmail("");
    } catch (error) {
      console.error("Add member error:", error);
      setError("Unable to add member. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white text-slate-900 shadow-2xl">

        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Add Member
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Add a registered user to this workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 p-6"
        >
          <div>
            <label
              htmlFor="member-email"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
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
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="member-role"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Workspace role
            </label>

            <select
              id="member-role"
              value={role}
              onChange={(event) =>
                setRole(event.target.value as MemberRole)
              }
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
            >
              <option value="member">
                Team Member
              </option>

              <option value="organiser">
                Meeting Organiser
              </option>
            </select>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-sm text-green-700">
                {success}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}