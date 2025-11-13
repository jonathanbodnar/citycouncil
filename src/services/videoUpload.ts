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
    // Log detailed file information for debugging
    console.log('🎬 Starting Wasabi upload:', {
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

    if (file.size > 500 * 1024 * 1024) { // 500MB limit
      console.error('❌ File too large:', { 
        fileSize: file.size, 
        maxSize: 500 * 1024 * 1024,
        sizeMB: (file.size / 1024 / 1024).toFixed(2) 
      });
      return { success: false, error: 'Video must be less than 500MB' };
    }
    
    console.log('✅ File validation passed, starting AWS SDK upload...');

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
    
    // Use direct Wasabi URL (CloudFlare CDN can be added later)
    // Direct access: https://shoutoutorders.s3.us-central-1.wasabisys.com/videos/file.mp4
    const videoUrl = `https://shoutoutorders.s3.us-central-1.wasabisys.com/${fileName}`;
    
    console.log('Video uploaded successfully:', videoUrl);
    
    return {
      success: true,
      videoUrl: videoUrl
    };

  } catch (error: any) {
    console.error('❌ Wasabi upload error:', error);
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
      errorMessage = 'Network error - check your internet connection';
    } else if (error?.code === 'RequestTimeout' || error?.message?.includes('timeout')) {
      errorMessage = 'Upload timeout - file may be too large for your connection';
    } else if (error?.statusCode === 403) {
      errorMessage = 'Access denied - please contact support';
    } else if (error?.message) {
      errorMessage = `Upload failed: ${error.message}`;
    }
    
    return { success: false, error: errorMessage };
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
