// Image Upload Service for Bio App
// Uses Supabase Storage which handles CORS properly
import { supabase } from './supabase';

interface UploadResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export const uploadImageToWasabi = async (
  file: File, 
  folder: string = 'bio-images'
): Promise<UploadResponse> => {
  try {
    // Validate file
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'Please select an image file' };
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return { success: false, error: 'Image must be less than 5MB' };
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('bio-assets')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return { 
        success: false, 
        error: error.message || 'Upload failed' 
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('bio-assets')
      .getPublicUrl(data.path);

    return {
      success: true,
      imageUrl: urlData.publicUrl
    };

  } catch (error: any) {
    console.error('Image upload error:', error);
    return { 
      success: false, 
      error: error.message || 'Upload failed. Please try again.' 
    };
  }
};

