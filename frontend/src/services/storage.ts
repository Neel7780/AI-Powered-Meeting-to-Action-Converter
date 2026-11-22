import { supabase } from '../lib/supabase';

export interface StorageUploadResult {
  path?: string;
  error?: { message: string } | null;
}

export async function uploadTranscriptFile(
  workspaceId: string,
  meetingId: string,
  file: File
): Promise<StorageUploadResult> {
  try {
    const filePath = `${workspaceId}/${meetingId}/${file.name}`;
    const { data, error } = await supabase.storage
      .from('meeting-transcripts')
      .upload(filePath, file, {
        upsert: true,
      });

    if (error) {
      return { error: { message: error.message } };
    }

    return { path: data?.path || filePath };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown upload error';
    return { error: { message: errorMsg } };
  }
}

export async function uploadTranscriptText(
  workspaceId: string,
  meetingId: string,
  content: string
): Promise<StorageUploadResult> {
  try {
    const filename = `transcript-${Date.now()}.txt`;
    const filePath = `${workspaceId}/${meetingId}/${filename}`;
    const blob = new Blob([content], { type: 'text/plain' });

    const { data, error } = await supabase.storage
      .from('meeting-transcripts')
      .upload(filePath, blob, {
        contentType: 'text/plain',
        upsert: true,
      });

    if (error) {
      return { error: { message: error.message } };
    }

    return { path: data?.path || filePath };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown upload error';
    return { error: { message: errorMsg } };
  }
}

