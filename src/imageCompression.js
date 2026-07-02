export const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`${file.name} could not be opened`));
    };
    image.src = objectUrl;
  });
}

export async function compressImageUnder8MB(file) {
  if (file.size <= MAX_IMAGE_SIZE) return file;

  const { image, objectUrl } = await loadImage(file);
  let width = image.width;
  let height = image.height;
  let quality = 0.85;
  let compressedBlob = null;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  for (let attempt = 0; attempt < 12; attempt++) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    compressedBlob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );

    if (compressedBlob && compressedBlob.size <= MAX_IMAGE_SIZE) break;
    quality -= 0.08;

    if (quality < 0.45) {
      width = Math.round(width * 0.85);
      height = Math.round(height * 0.85);
      quality = 0.8;
    }
  }

  URL.revokeObjectURL(objectUrl);

  if (!compressedBlob || compressedBlob.size > MAX_IMAGE_SIZE) {
    throw new Error(`${file.name} could not be compressed under 8 MB`);
  }

  const cleanName = file.name.replace(/\.[^/.]+$/, "");
  return new File([compressedBlob], `${cleanName}.jpg`, { type: "image/jpeg" });
}
