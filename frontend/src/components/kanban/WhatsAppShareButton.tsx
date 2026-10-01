import React from 'react';
import { Share2 } from 'lucide-react';

export interface WhatsAppShareButtonProps {
  taskTitle: string;
  deadlineUtc?: string | null;
  priority: string;
  status: string;
  assigneeName?: string | null;
  meetingTitle?: string | null;
  className?: string;
}

const statusDisplayMap: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
};

export const WhatsAppShareButton: React.FC<WhatsAppShareButtonProps> = ({
  taskTitle,
  deadlineUtc,
  priority,
  status,
  assigneeName,
  meetingTitle,
  className = '',
}) => {
  const getWhatsAppUrl = () => {
    let message = `*ActionPulse Task Assignment*\n\n`;
    message += `*Task:* ${taskTitle}\n`;
    message += `*Status:* ${statusDisplayMap[status] || status}\n`;
    message += `*Priority:* ${priority.toUpperCase()}\n`;

    if (deadlineUtc) {
      try {
        const d = new Date(deadlineUtc);
        const formattedDate = d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const formattedTime = d.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        });
        message += `*Due Date:* ${formattedDate} at ${formattedTime}\n`;
      } catch {
        message += `*Due Date:* ${deadlineUtc}\n`;
      }
    } else {
      message += `*Due Date:* No deadline specified\n`;
    }

    if (meetingTitle) {
      message += `*Source Meeting:* ${meetingTitle}\n`;
    }
    if (assigneeName) {
      message += `*Assignee:* ${assigneeName}\n`;
    }

    message += `\n_View on ActionPulse Kanban Board_`;

    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
  };

  return (
    <a
      href={getWhatsAppUrl()}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      title="1-Tap WhatsApp Share"
      aria-label={`Share ${taskTitle} on WhatsApp`}
      className={`group/wa inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all duration-200 
        bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/25 hover:border-emerald-500/40 
        focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 shadow-sm ${className}`}
    >
      {/* WhatsApp standard branded icon SVG */}
      <svg
        className="w-3.5 h-3.5 fill-current transition-transform duration-200 group-hover/wa:scale-110 shrink-0"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.04 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.04 20.16C10.67 20.16 9.33 19.82 8.14 19.17L7.85 19.01L4.72 19.83L5.56 16.78L5.38 16.49C4.66 15.34 4.28 13.64 4.28 11.91C4.28 7.37 7.98 3.67 12.04 3.67ZM9.12 7.03C8.94 7.03 8.76 7.04 8.6 7.12C8.42 7.2 7.99 7.61 7.99 8.44C7.99 9.28 8.6 10.08 8.68 10.2C8.76 10.32 9.87 12.03 11.58 12.77C12.99 13.38 13.28 13.26 13.58 13.23C13.88 13.2 14.54 12.84 14.68 12.45C14.82 12.06 14.82 11.73 14.78 11.66C14.74 11.59 14.62 11.55 14.44 11.46C14.26 11.37 13.38 10.94 13.22 10.88C13.06 10.82 12.94 10.79 12.82 10.97C12.7 11.15 12.35 11.56 12.24 11.68C12.13 11.8 12.02 11.82 11.84 11.73C11.66 11.64 11.08 11.45 10.39 10.84C9.85 10.36 9.49 9.77 9.38 9.59C9.27 9.41 9.37 9.31 9.46 9.22C9.54 9.14 9.64 9.02 9.74 8.91C9.84 8.8 9.87 8.71 9.93 8.59C9.99 8.47 9.96 8.36 9.91 8.27C9.86 8.18 9.5 7.29 9.35 6.93C9.2 6.57 9.06 6.62 8.95 6.62C8.85 6.62 8.73 6.62 8.61 6.62L9.12 7.03Z" />
      </svg>
      <span className="hidden sm:inline">WhatsApp</span>
      <Share2 className="w-3 h-3 opacity-60 group-hover/wa:opacity-100 shrink-0" />
    </a>
  );
};

export default WhatsAppShareButton;
