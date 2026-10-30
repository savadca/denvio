import { uploadPresigned } from '@vercel/blob/client';

export const FILE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.ppt,.pptx,.txt';
export const MAX_FILE_MB = 25;

// Sends one file straight to storage and returns its URL. The name is made unique per
// upload; the server signs exactly this path inside `folder` (e.g. notes/<userId>).
export async function uploadFile(file, { folder, handleUploadUrl, onProgress }) {
  const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(-80) || 'file';
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const blob = await uploadPresigned(`${folder}/${unique}-${safeName}`, file, {
    access: 'public',
    handleUploadUrl,
    onUploadProgress: ({ percentage }) => onProgress?.(percentage),
  });
  return blob.url;
}

// Title suggestion from a file name: "neet_mds-2023.pdf" → "neet mds 2023".
export const titleFromFile = (name) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 120);

export const fileSize = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

// Adds newly picked files to a list, skipping exact duplicates and oversized files.
export function addFiles(list, picked) {
  const seen = new Set(list.map((f) => `${f.file.name}:${f.file.size}`));
  const added = [];
  let tooBig = 0;
  for (const file of picked) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) { tooBig += 1; continue; }
    if (seen.has(`${file.name}:${file.size}`)) continue;
    seen.add(`${file.name}:${file.size}`);
    added.push({ key: `${file.name}:${file.size}:${Math.random()}`, file, title: titleFromFile(file.name) });
  }
  return { list: [...list, ...added], tooBig };
}
