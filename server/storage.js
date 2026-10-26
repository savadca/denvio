const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { put, del, head } = require('@vercel/blob');

// Files live in Vercel Blob. Connecting a Blob store in Vercel → Storage adds either
// BLOB_STORE_ID (+ automatic OIDC auth on Vercel) or a classic BLOB_READ_WRITE_TOKEN;
// the SDK accepts both. Note files are uploaded straight from the browser so they can
// be larger than Vercel's 4.5 MB request limit.

const NOTE_TYPES = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const NOTE_MAX_BYTES = 25 * 1024 * 1024;

function blobConfigured() {
  return !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

// Only accept file URLs that point at a Vercel Blob store.
function isBlobUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

async function blobInfo(url) {
  try {
    return await head(url);
  } catch {
    return null;
  }
}

async function removeBlob(url) {
  if (!url || !isBlobUrl(url)) return;
  try {
    await del(url);
  } catch (e) {
    console.warn('Could not delete blob', url, e.message);
  }
}

// Avatars are small, so they go through the server (multer keeps them in memory).
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES.has(file.mimetype)) return cb(null, true);
    const err = new Error('Only image files are allowed');
    err.status = 400;
    cb(err);
  },
});

async function saveAvatar(userId, file) {
  if (!blobConfigured()) {
    const err = new Error('File storage is not set up (connect a Vercel Blob store)');
    err.status = 503;
    throw err;
  }
  const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.jpg';
  const blob = await put(`avatars/${userId}-${crypto.randomBytes(6).toString('hex')}${ext}`, file.buffer, {
    access: 'public', contentType: file.mimetype, addRandomSuffix: true,
  });
  return blob.url;
}

module.exports = { NOTE_TYPES, NOTE_MAX_BYTES, blobConfigured, isBlobUrl, blobInfo, removeBlob, avatarUpload, saveAvatar };
