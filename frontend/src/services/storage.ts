import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// Replace with your actual Supabase URL and anon key from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Uploads a transcript file to the Supabase Storage bucket.
 * The file is saved following the strict path convention:
 * meeting-transcripts/{workspace_id}/{meeting_id}/{filename}
 */
export async function uploadTranscriptFile(
  workspaceId: string,
  meetingId: string,
  file: File
): Promise<{ path: string | null; error: Error | null }> {
  try {
    const filePath = `meeting-transcripts/${workspaceId}/${meetingId}/${file.name}`;
    
    const { data, error } = await supabase.storage
      .from('transcripts') // Make sure this bucket exists in your Supabase project
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Storage upload error:', error);
      return { path: null, error };
    }

    return { path: data.path, error: null };
  } catch (error) {
    console.error('Unexpected error during file upload:', error);
    return { path: null, error: error as Error };
  }
}

/**
 * Uploads raw pasted text as a text file to Supabase Storage.
 */
export async function uploadTranscriptText(
  workspaceId: string,
  meetingId: string,
  text: string
): Promise<{ path: string | null; error: Error | null }> {
  try {
    const filename = `transcript-${Date.now()}.txt`;
    const blob = new Blob([text], { type: 'text/plain' });
    const file = new File([blob], filename, { type: 'text/plain' });
    
    return await uploadTranscriptFile(workspaceId, meetingId, file);
  } catch (error) {
    console.error('Error uploading text transcript:', error);
    return { path: null, error: error as Error };
  }
}
