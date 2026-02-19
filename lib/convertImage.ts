// lib/convertImage.ts - Convert photos to JPG for better compatibility
import sharp from 'sharp';

export async function convertToJpg(buffer: Buffer, originalMimeType: string): Promise<{ buffer: Buffer; mimeType: string; converted: boolean }> {
  // List of formats to convert to JPG
  const shouldConvert = [
    'image/heic',
    'image/heif',
    'image/webp',
    'image/bmp',
    'image/tiff',
  ].includes(originalMimeType.toLowerCase());

  // Keep PDFs, JPGs, and PNGs as-is
  if (!shouldConvert && (
    originalMimeType === 'application/pdf' ||
    originalMimeType === 'image/jpeg' ||
    originalMimeType === 'image/jpg' ||
    originalMimeType === 'image/png'
  )) {
    return { buffer, mimeType: originalMimeType, converted: false };
  }

  // Convert to JPG
  try {
    console.log(`🔄 Converting ${originalMimeType} to JPG...`);
    
    const convertedBuffer = await sharp(buffer)
      .jpeg({ 
        quality: 90, // High quality
        progressive: true 
      })
      .resize(2000, 2000, { 
        fit: 'inside', // Maintain aspect ratio
        withoutEnlargement: true // Don't upscale small images
      })
      .toBuffer();

    console.log(`✅ Converted to JPG. Original: ${buffer.length} bytes, New: ${convertedBuffer.length} bytes`);
    
    return { 
      buffer: convertedBuffer, 
      mimeType: 'image/jpeg',
      converted: true 
    };
  } catch (error) {
    console.error('❌ Conversion failed:', error);
    // Return original if conversion fails
    return { buffer, mimeType: originalMimeType, converted: false };
  }
}

export function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/heic': 'jpg', // HEIC converts to JPG
    'image/heif': 'jpg',
    'image/webp': 'jpg',
    'image/bmp': 'jpg',
    'image/tiff': 'jpg',
    'application/pdf': 'pdf',
  };
  
  return mimeToExt[mimeType.toLowerCase()] || 'jpg';
}