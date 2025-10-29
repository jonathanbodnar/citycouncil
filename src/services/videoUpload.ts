// Video upload service for Wasabi S3 integration

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
    // Validate file
    if (!file.type.startsWith('video/')) {
      return { success: false, error: 'Please select a video file' };
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      return { success: false, error: 'Video must be less than 100MB' };
    }

    // Upload to Supabase Storage instead of base64
    const { supabase } = await import('./supabase');
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${orderId}-${Date.now()}.${fileExt}`;
    const filePath = `videos/${fileName}`;

    const { data, error } = await supabase.storage
      .from('shoutout-videos')
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
      .from('shoutout-videos')
      .getPublicUrl(filePath);

    return {
      success: true,
      videoUrl: publicUrl
    };

  } catch (error) {
    console.error('Video upload error:', error);
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

export const uploadVideoToWasabi = async (file: File, orderId: string): Promise<UploadResponse> => {
  try {
    const key = `videos/${orderId}-${Date.now()}.${file.name.split('.').pop()}`;
    
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
      videoUrl: result.Location
    };
  } catch (error) {
    console.error('Wasabi upload error:', error);
    return { success: false, error: 'Upload to Wasabi failed' };
  }
};
*/
