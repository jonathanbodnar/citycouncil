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

    // Check for required environment variables
    const accessKeyId = process.env.REACT_APP_WASABI_ACCESS_KEY_ID;
    const secretAccessKey = process.env.REACT_APP_WASABI_SECRET_ACCESS_KEY;
    
    if (!accessKeyId || !secretAccessKey) {
      console.error('Wasabi credentials missing:', { 
        hasAccessKey: !!accessKeyId, 
        hasSecretKey: !!secretAccessKey 
      });
      return { success: false, error: 'Storage configuration error - credentials missing' };
    }

    // Upload to Wasabi S3
    const AWS = (await import('aws-sdk')).default;
    
    const wasabi = new AWS.S3({
      endpoint: 's3.us-central-1.wasabisys.com',
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
      region: 'us-central-1',
      s3ForcePathStyle: true,
      signatureVersion: 'v4'
    });

    const fileExt = file.name.split('.').pop();
    const fileName = `${uploadPath}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    console.log('Uploading to Wasabi:', { fileName, fileType: file.type, fileSize: file.size });
    
    const uploadParams = {
      Bucket: 'shoutout-assets',
      Key: fileName,
      Body: file,
      ContentType: file.type,
      ACL: 'public-read' as const,
    };

    const result = await wasabi.upload(uploadParams).promise();
    
    // Use direct Wasabi URL (CloudFlare CDN can be added later)
    // Direct access: https://shoutout-assets.s3.us-central-1.wasabisys.com/path/file.jpg
    const imageUrl = `https://shoutout-assets.s3.us-central-1.wasabisys.com/${fileName}`;
    
    console.log('Wasabi upload successful:', imageUrl);
    
    return {
      success: true,
      imageUrl: imageUrl
    };

  } catch (error: any) {
    console.error('Image upload error:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      statusCode: error?.statusCode,
      name: error?.name
    });
    
    // Provide more specific error messages
    let errorMessage = 'Upload failed';
    if (error?.code === 'NetworkingError') {
      errorMessage = 'Network error - check your connection';
    } else if (error?.code === 'AccessDenied' || error?.statusCode === 403) {
      errorMessage = 'Access denied - check storage credentials';
    } else if (error?.code === 'InvalidAccessKeyId') {
      errorMessage = 'Invalid storage credentials';
    } else if (error?.message) {
      errorMessage = error.message;
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
