const crypto = require("crypto");

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);

function parseDataUrlImage(dataUrl) {
  const raw = String(dataUrl || "").trim();
  const match = raw.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);

  if (!match) {
    return { error: "La imagen no tiene un formato valido.", data: null };
  }

  const mimeType = match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, "");
  const buffer = Buffer.from(base64, "base64");

  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    return { error: "Solo se permiten imagenes PNG, JPG, JPEG o WEBP.", data: null };
  }

  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    return { error: "La imagen es demasiado grande. Proba con una imagen menor a 5 MB.", data: null };
  }

  const detectedMimeType = detectImageMimeType(buffer);

  if (detectedMimeType !== mimeType) {
    return { error: "El tipo MIME de la imagen no coincide con el contenido.", data: null };
  }

  return { error: null, data: { buffer, mimeType } };
}

function detectImageMimeType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return "";
}

function validateImageExtension(fileName) {
  const extension = String(fileName || "").trim().toLowerCase().split(".").pop();
  return ALLOWED_IMAGE_EXTENSIONS.has(extension || "");
}

function getCloudinaryConfig() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return { cloudName, apiKey, apiSecret };
}

function signCloudinaryParams(params, apiSecret) {
  const source = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto.createHash("sha1").update(`${source}${apiSecret}`).digest("hex");
}

async function uploadImageToCloudinary({ dataUrl, fileName, folder }) {
  if (fileName && !validateImageExtension(fileName)) {
    throw new Error("La extension de la imagen no es valida.");
  }

  const parsed = parseDataUrlImage(dataUrl);

  if (parsed.error) {
    throw new Error(parsed.error);
  }

  const config = getCloudinaryConfig();

  if (!config) {
    throw new Error("Cloudinary no esta configurado en el servidor.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const uploadFolder = String(folder || "rodado-control/uploads").trim();
  const params = { folder: uploadFolder, timestamp };
  const signature = signCloudinaryParams(params, config.apiSecret);
  const form = new FormData();
  const blob = new Blob([parsed.data.buffer], { type: parsed.data.mimeType });

  form.append("file", blob, fileName || `rodado-control-${timestamp}.jpg`);
  form.append("api_key", config.apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", uploadFolder);
  form.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || "No se pudo subir la imagen a Cloudinary.");
  }

  return {
    secureUrl: result.secure_url,
    publicId: result.public_id || "",
    bytes: result.bytes || parsed.data.buffer.length,
    format: result.format || "",
    resourceType: result.resource_type || "image",
  };
}

module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  parseDataUrlImage,
  uploadImageToCloudinary,
  validateImageExtension,
};
