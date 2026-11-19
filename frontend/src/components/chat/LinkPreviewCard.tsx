import { useEffect, useState } from 'react';
import { ExternalLink, Globe } from 'lucide-react';

import type { LinkPreviewData } from '../../types/workspaceChat';
import { fetchLinkPreview, sanitizeAttachmentUrl } from '../../services/chatService';
import { extractSafeHostname } from '../../utils/chatHelpers';

interface LinkPreviewCardProps {
  url: string;
}

export default function LinkPreviewCard({ url }: LinkPreviewCardProps) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchLinkPreview(url).then((data) => {
      if (!cancelled && data && (data.title || data.description || data.image)) {
        setPreview(data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!preview) return null;

  const safeHref = /^https?:\/\//i.test(preview.url) ? preview.url : url;
  const safeImage = sanitizeAttachmentUrl(preview.image);

  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex max-w-md overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 transition hover:border-indigo-300 hover:bg-indigo-50/40"
    >
      <div className="min-w-0 flex-1 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
          <Globe className="h-3 w-3 shrink-0 text-indigo-500" />
          <span className="truncate">{preview.site_name || extractSafeHostname(safeHref)}</span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
        </div>

        {preview.title && (
          <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-900">
            {preview.title}
          </p>
        )}

        {preview.description && (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-600">
            {preview.description}
          </p>
        )}
      </div>

      {safeImage && (
        <div className="w-24 shrink-0 border-l border-slate-200 bg-slate-100">
          <img
            src={safeImage}
            alt={preview.title || 'Link preview'}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      )}
    </a>
  );
}

