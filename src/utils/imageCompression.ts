/**
 * Client-Side Image Compression & WebP Converter
 * Resizes image to max width of 1200px (proportional height)
 * Converts format to .webp with quality 0.8
 */

export interface CompressionResult {
  file: File;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  reductionPercentage: number;
  width: number;
  height: number;
}

export async function compressAndConvertToWebP(
  file: File,
  maxWidth = 1200,
  quality = 0.8
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    // Check if browser supports Canvas / FileReader
    if (!window.FileReader || !window.HTMLCanvasElement) {
      reject(new Error("เบราว์เซอร์ไม่รองรับ HTML5 Canvas สำหรับบีบอัดรูป"));
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio & new dimensions (max width 1200px)
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * ratio);
        }

        // Create canvas
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("ไม่สามารถสร้าง Canvas 2D context ได้"));
          return;
        }

        // Enable high quality image scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to WebP Blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("การแปลงรูปเป็น WebP ล้มเหลว"));
              return;
            }

            // Generate clean filename
            const originalNameWithoutExt = file.name.substring(
              0,
              file.name.lastIndexOf(".")
            ) || file.name;
            const newFileName = `${originalNameWithoutExt}_${Date.now()}.webp`;

            const compressedFile = new File([blob], newFileName, {
              type: "image/webp",
              lastModified: Date.now(),
            });

            const previewUrl = URL.createObjectURL(blob);
            const reduction = Math.max(
              0,
              Math.round(((file.size - blob.size) / file.size) * 100)
            );

            resolve({
              file: compressedFile,
              previewUrl,
              originalSize: file.size,
              compressedSize: blob.size,
              reductionPercentage: reduction,
              width,
              height,
            });
          },
          "image/webp",
          quality
        );
      };

      img.onerror = () => {
        reject(new Error("ไม่สามารถอ่านข้อมูลรูปภาพได้"));
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      }
    };

    reader.onerror = () => {
      reject(new Error("เกิดข้อผิดพลาดในการโหลดไฟล์"));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Helper to format bytes into readable KB/MB
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
