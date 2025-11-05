import { z } from 'zod';

// Order validation schema
export const orderSchema = z.object({
  talent_id: z.string().uuid('Invalid talent ID'),
  recipient_name: z.string()
    .min(1, 'Recipient name is required')
    .max(100, 'Name too long'),
  recipient_email: z.string()
    .email('Invalid email address')
    .max(255, 'Email too long'),
  occasion: z.string()
    .min(1, 'Occasion is required')
    .max(100, 'Occasion too long'),
  message: z.string()
    .min(1, 'Message is required')
    .max(500, 'Message too long (max 500 characters)'),
  pricing: z.number()
    .positive('Price must be positive')
    .max(10000, 'Price exceeds maximum'),
  video_type: z.union([z.literal('personal'), z.literal('business')]),
  promotional_use: z.boolean().optional(),
});

// Talent profile validation schema
export const talentProfileSchema = z.object({
  temp_full_name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long'),
  bio: z.string()
    .min(10, 'Bio must be at least 10 characters')
    .max(500, 'Bio too long (max 500 characters)'),
  pricing: z.number()
    .positive('Price must be positive')
    .min(5, 'Minimum price is $5')
    .max(10000, 'Price exceeds maximum'),
  category: z.string().min(1, 'Category is required'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username too long')
    .regex(/^[a-z0-9_-]+$/, 'Username can only contain lowercase letters, numbers, underscores, and hyphens'),
  fulfillment_time_hours: z.number()
    .int('Must be whole hours')
    .min(1, 'Minimum 1 hour')
    .max(168, 'Maximum 7 days (168 hours)'),
  charity_percentage: z.number()
    .min(0)
    .max(100)
    .optional(),
});

// Message/chat validation schema
export const messageSchema = z.object({
  message: z.string()
    .min(1, 'Message is required')
    .max(1000, 'Message too long (max 1000 characters)'),
  user_id: z.string().uuid(),
});

// Email validation
export const emailSchema = z.string()
  .email('Invalid email address')
  .max(255, 'Email too long');

// Strong password validation
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain number');

// Signup form validation
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  fullName: z.string()
    .min(1, 'Full name is required')
    .max(100, 'Name too long'),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the terms and conditions'
  })
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

// Login form validation
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
});

// Contact form validation
export const contactSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long'),
  email: emailSchema,
  subject: z.string()
    .min(1, 'Subject is required')
    .max(200, 'Subject too long'),
  message: z.string()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message too long (max 2000 characters)')
});

// Review validation schema
export const reviewSchema = z.object({
  rating: z.number()
    .int('Rating must be a whole number')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating cannot exceed 5'),
  comment: z.string()
    .min(10, 'Comment must be at least 10 characters')
    .max(500, 'Comment too long (max 500 characters)')
    .optional(),
  order_id: z.string().uuid('Invalid order ID'),
  talent_id: z.string().uuid('Invalid talent ID')
});

// Video upload validation
export const videoUploadSchema = z.object({
  file: z.instanceof(File, { message: 'Please select a video file' })
    .refine(file => file.size <= 300 * 1024 * 1024, 'Video must be less than 300MB')
    .refine(
      file => ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'].includes(file.type),
      'Only MP4, MOV, AVI, and WebM formats are supported'
    )
});

// Image upload validation
export const imageUploadSchema = z.object({
  file: z.instanceof(File, { message: 'Please select an image file' })
    .refine(file => file.size <= 5 * 1024 * 1024, 'Image must be less than 5MB')
    .refine(
      file => ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(file.type),
      'Only JPEG, PNG, WebP, and GIF formats are supported'
    )
});

// Helper function to validate and return errors
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach(err => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  
  return { success: false, errors };
}

