// Video Upload Service using Supabase Storage
// This handles CORS properly unlike direct Wasabi uploads

import { supabase } from './supabase';

interface UploadResponse {
  success: boolean;
  videoUrl?: string;
  error?: string;
}

export const uploadVideoToSupabase = async (
  file: File, 
  uploadPath: string
): Promise<UploadResponse> => {
  try {
    // Log detailed file information for debugging
    console.log('🎬 Starting Supabase video upload:', {
      fileName: file.name,
      fileSize: file.size,
      fileSizeMB: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      fileType: file.type,
      uploadPath: uploadPath,
    });
    
    // Validate file - check MIME type OR file extension
    const validExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const isVideo = file.type.startsWith('video/') || validExtensions.includes(fileExtension);
    
    if (!isVideo) {
      console.error('❌ Invalid file type:', { fileType: file.type, fileName: file.name });
      return { success: false, error: 'Please select a video file (MP4, MOV, WEBM, etc.)' };
    }

    if (file.size > 500 * 1024 * 1024) { // 500MB limit for Supabase
      console.error('❌ File too large:', { 
        fileSize: file.size, 
        maxSize: 500 * 1024 * 1024,
        sizeMB: (file.size / 1024 / 1024).toFixed(2) 
      });
      return { success: false, error: 'Video must be less than 500MB' };
    }
    
    console.log('✅ File validation passed, uploading to Supabase Storage...');

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const fileName = `videos/${uploadPath}-${Date.now()}.${fileExt}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('platform-assets')
      .upload(fileName, file, {
        contentType: file.type || 'video/mp4',
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('❌ Supabase storage upload error:', error);
      return { success: false, error: `Upload failed: ${error.message}` };
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('platform-assets')
      .getPublicUrl(fileName);
    
    console.log('✅ Video uploaded successfully:', publicUrl);
    
    return {
      success: true,
      videoUrl: publicUrl
    };

  } catch (error: any) {
    console.error('❌ Video upload error:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      statusCode: error?.statusCode,
      name: error?.name,
      stack: error?.stack
    });
    
    return { success: false, error: error?.message || 'Upload failed' };
  }
};

