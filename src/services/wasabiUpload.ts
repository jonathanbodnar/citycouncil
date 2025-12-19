// Image Upload Service
// Uses Supabase Storage (handles CORS properly)

import { supabase } from './supabase';

interface UploadResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export const uploadImageToWasabi = async (
  file: File, 
  uploadPath: string
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
    const fileName = `${uploadPath}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    console.log('Uploading to Supabase Storage:', { fileName, fileType: file.type, fileSize: file.size });
    
    // Upload to Supabase Storage (platform-assets bucket - same as CommsCenterManagement)
    const { data, error } = await supabase.storage
      .from('platform-assets')
      .upload(fileName, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      return { success: false, error: `Upload failed: ${error.message}` };
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('platform-assets')
      .getPublicUrl(fileName);
    
    console.log('Upload successful:', publicUrl);
    
    return {
      success: true,
      imageUrl: publicUrl
    };

  } catch (error: any) {
    console.error('Image upload error:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      statusCode: error?.statusCode,
      name: error?.name
    });
    
    return { success: false, error: error?.message || 'Upload failed' };
  }
};

// For production Wasabi S3 integration, you would use:
/*
import AWS from 'aws-sdk';

const wasabi = new AWS.S3({
  endpoint: new AWS.Endpoint('s3.us-central-1.wasabisys.com'),
  accessKeyId: process.env.REACT_APP_WASABI_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_WASABI_SECRET_ACCESS_KEY,
  region: process.env.REACT_APP_WASABI_REGION,
});

export const uploadImageToWasabi = async (file: File, uploadPath: string): Promise<UploadResponse> => {
  try {
    const fileExt = file.name.split('.').pop();
    const key = `${uploadPath}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    const uploadParams = {
      Bucket: process.env.REACT_APP_WASABI_BUCKET_NAME!,
      Key: key,
      Body: file,
      ContentType: file.type,
      ACL: 'public-read',
    };

    const result = await wasabi.upload(uploadParams).promise();
    
    return {
      success: true,
      imageUrl: result.Location
    };
  } catch (error) {
    console.error('Wasabi upload error:', error);
    return { success: false, error: 'Upload to Wasabi failed' };
  }
};
*/
