// Video upload service - Uses Supabase Storage (handles CORS properly)

import { supabase } from './supabase';

interface UploadResponse {
  success: boolean;
  videoUrl?: string;
  error?: string;
}

export const uploadVideoToWasabi = async (
  file: File, 
  orderId: string
): Promise<UploadResponse> => {
  try {
    // Log detailed file information for debugging
    console.log('🎬 Starting video upload:', {
      fileName: file.name,
      fileSize: file.size,
      fileSizeMB: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      fileType: file.type,
      orderId: orderId,
      browser: navigator.userAgent,
      mobile: /Mobile|Android|iPhone/i.test(navigator.userAgent)
    });
    
    // Validate file - check MIME type OR file extension
    const validExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const isVideo = file.type.startsWith('video/') || validExtensions.includes(fileExtension);
    
    if (!isVideo) {
      console.error('❌ Invalid file type:', { fileType: file.type, fileName: file.name });
      return { success: false, error: 'Please select a video file (MP4, MOV, WEBM, etc.)' };
    }

    if (file.size > 1000 * 1024 * 1024) { // 1GB limit
      console.error('❌ File too large:', { 
        fileSize: file.size, 
        maxSize: 1000 * 1024 * 1024,
        sizeMB: (file.size / 1024 / 1024).toFixed(2) 
      });
      return { success: false, error: 'Video must be less than 1GB' };
    }
    
    console.log('✅ File validation passed, starting Supabase Storage upload...');

    // Upload to Supabase Storage (handles CORS properly)
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const fileName = `videos/${orderId}-${Date.now()}.${fileExt}`;
    
    console.log('📤 Uploading to Supabase Storage:', { fileName, bucket: 'platform-assets' });

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
    
    // Provide more specific error messages
    let errorMessage = 'Upload failed';
    
    if (error?.code === 'NetworkingError' || error?.message?.includes('Network')) {
      errorMessage = 'Network error - please check your connection and try again';
    } else if (error?.code === 'RequestTimeout' || error?.message?.includes('timeout')) {
      errorMessage = 'Upload timeout - file may be too large for your connection';
    } else if (error?.statusCode === 403 || error?.code === 'AccessDenied') {
      errorMessage = 'Access denied - please contact support';
    } else if (error?.statusCode === 413 || error?.message?.includes('too large')) {
      errorMessage = 'File too large - please use a smaller video';
    } else if (error?.message) {
      errorMessage = `Upload failed: ${error.message}`;
    }
    
    return { success: false, error: errorMessage };
  }
};
