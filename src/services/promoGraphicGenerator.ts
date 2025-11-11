/**
 * Promo Graphic Generator
 * 
 * Generates a promotional graphic by:
 * 1. Loading the talent's avatar and fitting it to white space
 * 2. Overlaying the BackgroundNew.png transparent frame
 * 3. Adding talent name with Montserrat SemiBold font
 * 4. Adding profile URL with Open Sans font
 */

interface PromoGraphicOptions {
  avatarUrl: string;
  talentName: string;
  profileUrl: string; // e.g., "ShoutOut.us/username"
}

/**
 * Generates a promotional graphic for a talent
 * @param options Configuration for the graphic generation
 * @returns Promise<Blob> The generated image as a blob
 */
export async function generatePromoGraphic(options: PromoGraphicOptions): Promise<Blob> {
  const { avatarUrl, talentName, profileUrl } = options;

  // Canvas dimensions (Instagram post 4:5 ratio to match mockup)
  const width = 1080;
  const height = 1350;

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Load and draw the avatar (fitted to white space, using featured card alignment)
  await loadAndDrawAvatar(ctx, avatarUrl, width, height);

  // Load and draw the overlay (BackgroundNew.png frame) with cache-busting
  const cacheBuster = Date.now();
  await loadAndDrawOverlay(ctx, `/BackgroundNew.png?v=${cacheBuster}`, width, height);

  // Add talent name text (Montserrat SemiBold)
  await drawTalentNameText(ctx, talentName, width, height);

  // Add profile URL text (Open Sans, bottom left)
  await drawProfileUrlText(ctx, profileUrl, width, height);

  // Convert canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert canvas to blob'));
      }
    }, 'image/png');
  });
}

/**
 * Load and draw the avatar, fitting it to the white space area (top portion of canvas)
 * Uses featured card face alignment (top-center crop)
 */
async function loadAndDrawAvatar(
  ctx: CanvasRenderingContext2D,
  avatarUrl: string,
  canvasWidth: number,
  canvasHeight: number
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('📸 Loading avatar from:', avatarUrl);
      
      // Use Supabase proxy to bypass CORS (Wasabi isn't returning proper headers)
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!;
      const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY!;
      const proxyUrl = `${supabaseUrl}/functions/v1/proxy-image?url=${encodeURIComponent(avatarUrl)}`;
      
      console.log('🔄 Using proxy:', proxyUrl);
      
      // Fetch through proxy with authorization
      const response = await fetch(proxyUrl, {
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey
        }
      });
      if (!response.ok) {
        throw new Error(`Proxy failed: ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const img = new Image();
      
      img.onload = () => {
        console.log('✅ Avatar loaded successfully via proxy');
        
        // BackgroundNew.png transparent area dimensions:
        // Starts at 63px from top, ends at 1040px from top
        // Height: 977px (1040 - 63)
        const transparentAreaTop = 63;
        const transparentAreaBottom = 1040;
        const transparentAreaHeight = transparentAreaBottom - transparentAreaTop; // 977px
        
        // Calculate dimensions to match featured card alignment
        // Featured cards use object-cover with object-top for face-focused cropping
        const aspectRatio = img.width / img.height;
        const targetAspectRatio = canvasWidth / transparentAreaHeight;
        
        let srcX = 0;
        let srcY = 0;
        let srcWidth = img.width;
        let srcHeight = img.height;
        
        if (aspectRatio > targetAspectRatio) {
          // Image is wider than target - crop sides (center horizontally)
          srcWidth = img.height * targetAspectRatio;
          srcX = (img.width - srcWidth) / 2;
        } else {
          // Image is taller than target - crop from top (featured card alignment)
          srcHeight = img.width / targetAspectRatio;
          srcY = 0; // Crop from top to keep face visible
        }
        
        // Draw avatar in the transparent area (63px from top, 977px tall)
        console.log('🎨 Drawing avatar:');
        console.log('  - Canvas size:', canvasWidth, 'x', canvasHeight);
        console.log('  - Transparent area: 63px to 1040px (height: 977px)');
        console.log('  - Drawing to:', 0, transparentAreaTop, canvasWidth, 'x', transparentAreaHeight);
        
        ctx.drawImage(
          img,
          srcX, srcY, srcWidth, srcHeight,  // Source (cropped)
          0, transparentAreaTop, canvasWidth, transparentAreaHeight // Destination (transparent area)
        );
        
        // Clean up blob URL
        URL.revokeObjectURL(blobUrl);
        resolve();
      };
      
      img.onerror = (error) => {
        console.error('❌ Failed to load avatar from blob:', error);
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Failed to load avatar'));
      };
      
      img.src = blobUrl;
    } catch (error) {
      console.error('❌ Failed to fetch avatar via proxy:', error);
      reject(error);
    }
  });
}

/**
 * Load and draw the transparent border overlay
 */
async function loadAndDrawOverlay(
  ctx: CanvasRenderingContext2D,
  overlayUrl: string,
  canvasWidth: number,
  canvasHeight: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
      resolve();
    };
    
    img.onerror = () => reject(new Error('Failed to load overlay'));
    img.src = overlayUrl;
  });
}

/**
 * Draw talent name text with Montserrat SemiBold font
 * Text: "Get your personalized ShoutOut video from [talent name]"
 * LEFT-ALIGNED to match mockup exactly
 */
async function drawTalentNameText(
  ctx: CanvasRenderingContext2D,
  talentName: string,
  canvasWidth: number,
  canvasHeight: number
): Promise<void> {
  // Load fonts if not already loaded
  await loadFonts();
  
  // Text configuration based on mockup
  const text = `Get your personalized ShoutOut video from ${talentName}`;
  const fontSize = 56; // Large text
  const lineHeight = 62; // Reduced from 72 to 62 for tighter spacing
  const leftMargin = 100; // Left margin for text
  const maxWidth = canvasWidth - (leftMargin * 2); // Max width for text wrapping
  
  // Set font - Montserrat SemiBold, white color
  ctx.font = `600 ${fontSize}px "Montserrat", sans-serif`; // 600 = SemiBold
  ctx.fillStyle = '#ffffff'; // White text
  ctx.textAlign = 'left'; // LEFT-ALIGNED
  ctx.textBaseline = 'top';
  
  // NO SHADOW - removed for cleaner look
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Word wrap
  const words = text.split(' ');
  let lines: string[] = [];
  let currentLine = words[0];
  
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine + ' ' + word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  
  // Position text in the bottom purple section (LEFT-ALIGNED)
  // Start at 1065px from top (below the transparent photo area)
  const textY = 1065; // Fixed position at 1065px from top
  const textX = leftMargin;
  
  lines.forEach((line, index) => {
    ctx.fillText(line, textX, textY + (index * lineHeight));
  });
  
  // No shadow to reset (already set to transparent above)
}

/**
 * Draw profile URL text with Open Sans font
 * Positioned in bottom left next to ShoutOut icon
 */
async function drawProfileUrlText(
  ctx: CanvasRenderingContext2D,
  profileUrl: string,
  canvasWidth: number,
  canvasHeight: number
): Promise<void> {
  // Load fonts if not already loaded
  await loadFonts();
  
  // Text configuration
  const fontSize = 32;
  
  // Set font - Open Sans, regular weight, white color with 70% opacity
  ctx.font = `400 ${fontSize}px "Open Sans", sans-serif`; // Back to 400 (regular weight)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // White with 70% opacity
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  
  // Add subtle shadow for readability
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  
  // Position text in bottom left, next to icon
  // Moved down 5px from 1230px to 1235px
  const textX = 180; // Leave space for ShoutOut icon (80px icon + 20px gap)
  const textY = 1235; // Moved down 5px from 1230px
  
  ctx.fillText(profileUrl, textX, textY);
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * Load Montserrat SemiBold and Open Sans fonts
 */
async function loadFonts(): Promise<void> {
  try {
    // Check if Montserrat SemiBold is already loaded
    const montLoaded = document.fonts.check('600 56px "Montserrat"');
    
    if (!montLoaded) {
      console.log('🔤 Loading Montserrat SemiBold font from file...');
      
      // Load Montserrat SemiBold from the public/fonts directory
      const montFontFace = new FontFace(
        'Montserrat',
        `url(${process.env.PUBLIC_URL || ''}/fonts/MontSemiBold/font.woff2)`,
        { weight: '600' }
      );
      
      const loadedFont = await montFontFace.load();
      document.fonts.add(loadedFont);
      console.log('✅ Montserrat SemiBold font loaded successfully');
    }
    
    // Open Sans should already be loaded from Google Fonts
    await document.fonts.ready;
    console.log('✅ All fonts ready');
  } catch (error) {
    console.error('❌ Error loading fonts:', error);
    // Continue anyway - will fall back to system fonts
  }
}

/**
 * Download the generated graphic
 */
export function downloadPromoGraphic(blob: Blob, filename: string = 'promo-graphic.png'): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

