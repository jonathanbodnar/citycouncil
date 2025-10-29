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
    };

    await wasabi.upload(uploadParams).promise();
    
    // Generate a pre-signed URL that expires in 7 days (max allowed)
    const videoUrl = wasabi.getSignedUrl('getObject', {
      Bucket: 'shoutoutorders',
      Key: fileName,
      Expires: 604800 // 7 days in seconds
    });
    
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
