# ActionPulse Frontend (React + Vite + TypeScript)

> **Role in Sprint 1:** Workspace Dashboard, Meeting Review Split-Screen, and Kanban Board.

---

## 1. Quick Start

### Step 1: Initialize Project (if starting fresh)
If your sub-team is creating the React app from scratch, run inside `frontend/`:
```bash
npm create vite@latest . -- --template react-ts
npm install
```

### Step 2: Install Core Dependencies
```bash
# Supabase client + Lucide icons + Router
npm install @supabase/supabase-js lucide-react react-router-dom

# Tailwind CSS (optional but highly recommended for fast styling)
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_BASE_URL`.

### Step 4: Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 2. Architectural Guidelines & Boundaries

1. **Client-Side Supabase Client (`src/lib/supabase.ts`):**
   ```typescript
   import { createClient } from '@supabase/supabase-js';

   const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
   const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

   export const supabase = createClient(supabaseUrl, supabaseAnonKey);
   ```

2. **Mutation Boundaries (Strict RLS Rule):**
   * **Allowed on Frontend:**
     * `supabase.from('meetings').select(...)`
     * `supabase.from('tasks').select(...)`
     * `supabase.from('tasks').update({ status: 'in_progress' }).eq('id', taskId)` (Kanban drag-and-drop)
     * `supabase.rpc('create_workspace', { p_name: 'Team Name' })`
   * **NOT Allowed on Frontend (Must call FastAPI backend):**
     * ❌ Do NOT call `supabase.from('tasks').insert(...)` $\rightarrow$ Tasks must only be created by the backend upon approval.
     * ❌ Do NOT call `supabase.from('extracted_items').update(...)` $\rightarrow$ Approvals must go through `POST ${VITE_API_BASE_URL}/api/meetings/{id}/approve`.

3. **Storage Upload Path Rule:**
   When uploading transcripts (`.vtt`, `.srt`, `.txt`, `.docx`) to the `meeting-transcripts` bucket, the path must be:
   ```typescript
   const filePath = `${workspaceId}/${meetingId}/${file.name}`;
   const { data, error } = await supabase.storage
     .from('meeting-transcripts')
     .upload(filePath, file);
   ```
