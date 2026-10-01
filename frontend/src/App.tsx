import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ActionPulseLanding from './components/landing/ActionPulseLanding';
import CreateMeeting from './pages/CreateMeeting';
import KanbanBoard from './pages/KanbanBoard';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ActionPulseLanding />} />
        <Route path="/create-meeting" element={<CreateMeeting />} />
        <Route path="/kanban" element={<KanbanBoard />} />
      </Routes>
    </Router>
  );
}
