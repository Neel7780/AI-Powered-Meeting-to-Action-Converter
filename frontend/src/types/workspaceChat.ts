export type ConversationType = 'channel' | 'dm';

export interface UserProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_online?: boolean;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  type: ConversationType;
  name: string | null;
  topic: string | null;
  description: string | null;
  is_private: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  unread_count?: number;
  other_user?: UserProfile;
  last_message?: WorkspaceMessage;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  conversation_id: string;
  workspace_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  conversation_id: string;
  workspace_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface WorkspaceMessage {
  id: string;
  conversation_id: string;
  workspace_id: string;
  sender_id: string;
  parent_id: string | null;
  content: string;
  is_sticker: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  sender?: UserProfile;
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  parent?: {
    id: string;
    content: string;
    sender_name: string;
  } | null;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  profile?: UserProfile;
}

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  site_name?: string;
}

