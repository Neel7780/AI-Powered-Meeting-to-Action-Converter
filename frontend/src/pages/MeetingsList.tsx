import { Navigate } from 'react-router-dom';

/** Kept as a compatibility entry point for older imports. */
export default function MeetingsList() {
  return <Navigate to="/meetings" replace />;
}
