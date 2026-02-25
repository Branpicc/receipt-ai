// lib/convertHeicClient.ts - Convert HEIC to JPG in the browser

export async function convertHeicToJpg(file: File): Promise<File> {
  // Check if file is HEIC/HEIF
  const isHeic = file.type === 'image/heic' || 
                 file.type === 'image/heif' || 
                 file.name.toLowerCase().endsWith('.heic') ||
                 file.name.toLowerCase().endsWith('.heif');

  if (!isHeic) {
    // Not HEIC, return as-is
    return file;
  }

  try {
    console.log('🔄 Converting HEIC to JPG in browser...');
    
    // Dynamic import to avoid SSR issues
    const heic2any = (await import('heic2any')).default;
    
    // Convert HEIC to JPG blob
    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9, // High quality
    });

    // heic2any can return Blob or Blob[] - handle both
    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

    // Create new File from blob
    const fileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    const convertedFile = new File([blob], fileName, { type: 'image/jpeg' });

    console.log(`✅ HEIC converted: ${file.size} → ${convertedFile.size} bytes`);
    
    return convertedFile;
  } catch (error) {
    console.error('❌ HEIC conversion failed:', error);
    // Return original file if conversion fails
    alert('Failed to convert HEIC image. Please try a JPG or PNG instead.');
    throw error;
  }
}