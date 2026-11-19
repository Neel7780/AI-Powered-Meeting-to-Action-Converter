import { AlertCircle } from 'lucide-react';
import ChatInterface from '../components/chat/ChatInterface';
import { useWorkspace } from '../context/WorkspaceContext';

export default function ChatPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  if (!workspaceId) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6 text-center">
        <div className="panel max-w-md p-8">
          <AlertCircle className="mx-auto size-8 text-neutral-500" />
          <h2 className="mt-3 text-lg font-medium text-white">No Workspace Selected</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Select or create a workspace to ask about your meetings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-61px)] w-full flex flex-col">
      <ChatInterface workspaceId={workspaceId} isCompact={false} />
    </div>
  );
}
