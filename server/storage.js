const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { put, del, head, issueSignedToken } = require('@vercel/blob');
const { handleUploadPresigned } = require('@vercel/blob/client');

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

// Express handler for step 1 of a browser upload: the browser asks for a presigned URL
// for one exact pathname, then sends the file straight to Vercel Blob (so files can be
// bigger than Vercel's 4.5 MB request limit). `allowPath(req, pathname)` decides whether
// this user may write there; `types` / `maxBytes` limit what Blob will accept.
function presignedUpload({ allowPath, types, maxBytes }) {
  return async (req, res) => {
    if (!blobConfigured()) return res.status(503).json({ error: 'File storage is not set up yet (connect a Vercel Blob store)' });
    const result = await handleUploadPresigned({
      body: req.body,
      request: req,
      // Only used to verify upload-completed callbacks, which this app doesn't request.
      webhookPublicKey: process.env.BLOB_WEBHOOK_PUBLIC_KEY || 'unused',
      getSignedToken: async (pathname) => {
        if (!req.user) throw Object.assign(new Error('Please log in'), { status: 401 });
        if (!allowPath(req, pathname)) throw Object.assign(new Error('Invalid upload path'), { status: 400 });
        const limits = { allowedContentTypes: types, maximumSizeInBytes: maxBytes };
        const token = await issueSignedToken({ pathname, operations: ['put'], ...limits });
        return { token, urlOptions: limits };
      },
    });
    res.json(result);
  };
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

module.exports = { presignedUpload, NOTE_TYPES, NOTE_MAX_BYTES, blobConfigured, isBlobUrl, blobInfo, removeBlob, avatarUpload, saveAvatar };
