import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import { ChatProvider, useChat } from '../context/ChatContext';
import { useWorkspace } from '../context/WorkspaceContext';
import ChatSidebar from '../components/chat/ChatSidebar';
import ConversationHeader from '../components/chat/ConversationHeader';
import MessageList from '../components/chat/MessageList';
import MessageComposer from '../components/chat/MessageComposer';
import ConversationDetailsDrawer from '../components/chat/ConversationDetailsDrawer';
import type { WorkspaceMessage } from '../types/workspaceChat';

function WorkspaceChatInner() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const {
    conversations,
    loadingConversations,
    activeConversation,
    setActiveConversationId,
  } = useChat();

  useEffect(() => {
    if (!conversationId || loadingConversations || conversations.length === 0) {
      return;
    }

    const isAccessible = conversations.some((c) => c.id === conversationId);
    if (isAccessible) {
      setActiveConversationId(conversationId);
    } else {
      // Invalid, nonexistent, cross-workspace, or inaccessible conversation ID:
      // never query/subscribe to it; cleanly fall back to /workspace-chat.
      navigate('/workspace-chat', { replace: true });
    }
  }, [conversationId, conversations, loadingConversations, setActiveConversationId, navigate]);

  const [showMobileChannels, setShowMobileChannels] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    senderName: string;
    excerpt: string;
  } | null>(null);

  const handleReply = (message: WorkspaceMessage) => {
    setReplyingTo({
      id: message.id,
      senderName: message.sender?.display_name || 'Member',
      excerpt: message.content.slice(0, 100),
    });
  };

  if (workspaceLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-slate-900">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
          <p className="mt-3 text-sm text-slate-500">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-8 text-center text-slate-900">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">No workspace selected</h2>
          <p className="mt-2 text-sm text-slate-500">
            Please create or switch to a workspace to access team chat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-1 overflow-hidden bg-white text-slate-900">
      {/* Desktop Chat Sidebar */}
      <div className="hidden lg:block lg:shrink-0">
        <ChatSidebar />
      </div>

      {/* Mobile Chat Sidebar Overlay */}
      {showMobileChannels && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowMobileChannels(false)}
          />
          <div className="relative z-10 h-full w-72 bg-white shadow-2xl">
            <ChatSidebar onSelectConversation={() => setShowMobileChannels(false)} />
          </div>
        </div>
      )}

      {/* Center Conversation Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <ConversationHeader
          onToggleSidebar={() => setShowMobileChannels((v) => !v)}
          onToggleDetails={() => setShowDetails((v) => !v)}
          isDetailsOpen={showDetails}
        />

        <MessageList onReply={handleReply} />

        {activeConversation && (
          <MessageComposer
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
        )}
      </div>

      {/* Right Details Panel — Desktop side panel & Mobile slide-over overlay */}
      {showDetails && (
        <>
          <div className="hidden lg:block lg:shrink-0">
            <ConversationDetailsDrawer
              isOpen={showDetails}
              onClose={() => setShowDetails(false)}
            />
          </div>

          <div className="fixed inset-0 z-50 flex justify-end lg:hidden">
            <button
              type="button"
              aria-label="Close conversation details"
              className="absolute inset-0 bg-black/40"
              onClick={() => setShowDetails(false)}
            />
            <div className="relative z-10 h-full max-w-[90vw] bg-white shadow-2xl">
              <ConversationDetailsDrawer
                isOpen={showDetails}
                onClose={() => setShowDetails(false)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function WorkspaceChatPage() {
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  return (
    <div className="app-canvas flex h-screen overflow-hidden text-white">
      {/* Main App Desktop Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-white/[0.06] lg:block">
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar onMenuClick={() => setShowMobileSidebar((v) => !v)} />

        {/* Main App Mobile Sidebar */}
        {showMobileSidebar && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowMobileSidebar(false)}
            />
            <aside className="rise-in relative z-10 h-full w-72 border-r border-white/10 shadow-2xl">
              <Sidebar onClose={() => setShowMobileSidebar(false)} />
            </aside>
          </div>
        )}

        {/* Workspace Chat Main Content Area */}
        <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <ChatProvider>
            <WorkspaceChatInner />
          </ChatProvider>
        </main>
      </div>
    </div>
  );
}

