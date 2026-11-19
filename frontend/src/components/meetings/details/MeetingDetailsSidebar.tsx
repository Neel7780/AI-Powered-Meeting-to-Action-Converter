import { Link } from 'react-router-dom';
import { useWorkspace } from '../../../context/WorkspaceContext';
export function MeetingDetailsSidebar({ onCloseMobile }: { onCloseMobile?: () => void }) {
  const { currentWorkspace, currentRole } = useWorkspace();
  return <aside className="w-64 h-full bg-[#0d0f12] border-r border-white/10 p-5 space-y-6">
    <div><p>{currentWorkspace?.name}</p><p className="text-sm text-slate-400">{currentRole}</p></div>
    <nav className="flex flex-col gap-4">
      {[['Dashboard', '/dashboard'], ['Meetings', '/meetings'], ['Tasks', '/tasks'], ['Team', '/team'], ['Settings', '/settings']].map(([label, path]) => <Link key={path} to={path} onClick={onCloseMobile}>{label}</Link>)}
    </nav>
  </aside>;
}
