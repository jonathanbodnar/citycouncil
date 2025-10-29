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
    // Validate file - check MIME type OR file extension
    const validExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const isVideo = file.type.startsWith('video/') || validExtensions.includes(fileExtension);
    
    if (!isVideo) {
      return { success: false, error: 'Please select a video file (MP4, MOV, WEBM, etc.)' };
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      return { success: false, error: 'Video must be less than 100MB' };
    }

    // Upload to Wasabi S3
    const AWS = (await import('aws-sdk')).default;
    
    const wasabi = new AWS.S3({
      endpoint: 's3.us-central-1.wasabisys.com',
      accessKeyId: process.env.REACT_APP_WASABI_ACCESS_KEY_ID!,
      secretAccessKey: process.env.REACT_APP_WASABI_SECRET_ACCESS_KEY!,
      region: 'us-central-1',
      s3ForcePathStyle: true,
      signatureVersion: 'v4'
    });

    const fileExt = file.name.split('.').pop();
    const fileName = `videos/${orderId}-${Date.now()}.${fileExt}`;
    
    const uploadParams = {
      Bucket: 'shoutoutorders',
      Key: fileName,
      Body: file,
      ContentType: file.type,
      ACL: 'public-read' as const,
    };

    const result = await wasabi.upload(uploadParams).promise();
    
    // Use CloudFlare CDN URL for public access
    const videoUrl = `https://videos.shoutout.us/${fileName}`;
    
    return {
      success: true,
      videoUrl: videoUrl
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
