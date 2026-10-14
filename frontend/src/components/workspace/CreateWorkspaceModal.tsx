import { useState } from "react";
import type { FormEvent } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Button } from "../ui/button";
import { Notice } from "../ui/notice";

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateWorkspaceModal({
  isOpen,
  onClose,
}: CreateWorkspaceModalProps) {
  const { createWorkspace } = useWorkspace();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Please enter a workspace name.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await createWorkspace(trimmedName);

      setName("");
      onClose();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create workspace."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-workspace-title"
        className="panel w-full max-w-md p-6 shadow-2xl"
      >
        <div className="mb-5">
          <p className="eyebrow">New workspace</p>
          <h2 id="create-workspace-title" className="mt-1.5 text-lg font-medium tracking-tight text-white">
            Create workspace
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            Create a workspace to start using ActionPulse.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="workspace-name" className="field-label">
              Workspace name
            </label>
            <input
              id="workspace-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Software Engineering Team"
              className="field"
              autoFocus
            />
          </div>

          {error && <Notice tone="error">{error}</Notice>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create workspace"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
