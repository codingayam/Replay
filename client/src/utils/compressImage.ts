const DEFAULT_MAX_DIMENSION = 2048;
const DEFAULT_QUALITY = 0.78;
const DEFAULT_TARGET_SIZE_BYTES = 0.5 * 1024 * 1024; // 500KB default target for uploads
const DEFAULT_MAX_ATTEMPTS = 5;
const MIN_QUALITY = 0.4;

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
  targetSizeBytes?: number;
  maxAttempts?: number;
}

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

const getExtensionForMime = (mimeType: string) => {
  const subtype = mimeType.split('/')[1] ?? 'jpeg';
  if (subtype === 'jpeg') {
    return 'jpg';
  }
  return subtype;
};

const replaceExtension = (fileName: string, newExtension: string) => {
  if (!fileName.includes('.')) {
    return `${fileName}.${newExtension}`;
  }
  return fileName.replace(/\.[^.]+$/, `.${newExtension}`);
};

const loadImageElement = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = (event) => {
      URL.revokeObjectURL(url);
      reject(event);
    };
    image.src = url;
  });
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) => {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
};

export const compressImage = async (file: File, options: CompressImageOptions = {}): Promise<File> => {
  if (!isBrowser) {
    return file;
  }

  if (!file.type.startsWith('image/')) {
    return file;
  }

  const targetSizeBytes = options.targetSizeBytes ?? DEFAULT_TARGET_SIZE_BYTES;
  if (file.size <= targetSizeBytes) {
    return file;
  }

  try {
    const maxWidth = options.maxWidth ?? DEFAULT_MAX_DIMENSION;
    const maxHeight = options.maxHeight ?? DEFAULT_MAX_DIMENSION;
    const mimeType = options.mimeType ?? 'image/jpeg';
    const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

    const image = await loadImageElement(file);

    const widthScale = maxWidth / image.width;
    const heightScale = maxHeight / image.height;
    const scale = Math.min(1, widthScale, heightScale);

    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');

    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    let quality = Math.min(1, Math.max(0, options.quality ?? DEFAULT_QUALITY));
    let bestBlob: Blob | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const blob = await canvasToBlob(canvas, mimeType, quality);
      if (!blob) {
        break;
      }

      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
      }

      if (blob.size <= targetSizeBytes || quality <= MIN_QUALITY) {
        bestBlob = blob;
        break;
      }

      quality = Math.max(MIN_QUALITY, quality * 0.75);
    }

    if (bestBlob && bestBlob.size < file.size) {
      const extension = getExtensionForMime(bestBlob.type || mimeType);
      const compressedName = replaceExtension(file.name, extension);
      return new File([bestBlob], compressedName, {
        type: bestBlob.type || mimeType,
        lastModified: file.lastModified,
      });
    }
  } catch (error) {
    console.error('Image compression failed, using original file:', error);
  }

  return file;
};
