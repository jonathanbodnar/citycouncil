// Wasabi S3 Upload Service for Bio App
import AWS from 'aws-sdk';

interface UploadResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

// Initialize Wasabi S3 client
const getWasabiClient = () => {
  return new AWS.S3({
    endpoint: 's3.us-central-1.wasabisys.com',
    accessKeyId: process.env.REACT_APP_WASABI_ACCESS_KEY_ID!,
    secretAccessKey: process.env.REACT_APP_WASABI_SECRET_ACCESS_KEY!,
    region: 'us-central-1',
    s3ForcePathStyle: true,
    signatureVersion: 'v4'
  });
};

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

    const wasabi = getWasabiClient();

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
    
    const uploadParams = {
      Bucket: 'shoutout-assets',
      Key: fileName,
      Body: file,
      ContentType: file.type,
      ACL: 'public-read' as const,
    };

    await wasabi.upload(uploadParams).promise();
    
    // Use direct Wasabi URL
    const imageUrl = `https://s3.us-central-1.wasabisys.com/shoutout-assets/${fileName}`;
    
    return {
      success: true,
      imageUrl
    };

  } catch (error: any) {
    console.error('Image upload error:', error);
    return { 
      success: false, 
      error: error.message || 'Upload failed. Please try again.' 
    };
  }
};

