// Wasabi S3 Upload Service
// For production Wasabi S3 integration

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

    // Upload to Supabase Storage instead of base64
    const { supabase } = await import('./supabase');
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${uploadPath}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('shoutout-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase Storage upload error:', error);
      return { success: false, error: 'Upload failed: ' + error.message };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('shoutout-images')
      .getPublicUrl(filePath);

    return {
      success: true,
      imageUrl: publicUrl
    };

  } catch (error) {
    console.error('Image upload error:', error);
    return { success: false, error: 'Upload failed' };
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
