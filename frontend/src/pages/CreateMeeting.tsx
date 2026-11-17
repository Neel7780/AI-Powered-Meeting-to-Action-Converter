import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { MeetingCreationForm } from '../components/meetings/MeetingCreationForm';
import type { CreatedMeeting } from '../components/meetings/MeetingCreationForm';

export interface CreateMeetingProps {
  onSuccess?: (meeting: CreatedMeeting) => void;
  onCancel?: () => void;
}

export function CreateMeeting({ onSuccess, onCancel }: CreateMeetingProps = {}) {
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl">
      <button type="button" onClick={onCancel || (() => navigate('/meetings'))} className="mb-5 text-sm text-neutral-400 hover:text-white">← Back to meetings</button>
      <h1 className="text-2xl font-semibold text-white">Create meeting</h1>
      <MeetingCreationForm workspaceId={currentWorkspace?.id || ''} onComplete={onSuccess || ((meeting) => navigate(`/meetings/${meeting.id}?tab=overview`))} />
    </div>
  );
}

export default CreateMeeting;
