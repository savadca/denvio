const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const NOTES_DIR = path.join(UPLOAD_DIR, 'notes');
const AVATAR_DIR = path.join(UPLOAD_DIR, 'avatars');
fs.mkdirSync(NOTES_DIR, { recursive: true });
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const NOTE_TYPES = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]);
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function storage(dir) {
  return multer.diskStorage({
    destination: dir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
      cb(null, crypto.randomBytes(16).toString('hex') + ext);
    },
  });
}

function filter(allowed, label) {
  return (req, file, cb) => {
    if (allowed.has(file.mimetype)) return cb(null, true);
    const err = new Error(`Only ${label} files are allowed`);
    err.status = 400;
    cb(err);
  };
}

const noteUpload = multer({
  storage: storage(NOTES_DIR),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: filter(NOTE_TYPES, 'PDF, image, Word, PowerPoint or text'),
});

const avatarUpload = multer({
  storage: storage(AVATAR_DIR),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: filter(IMAGE_TYPES, 'image'),
});

function removeFile(dir, name) {
  if (!name) return;
  fs.rm(path.join(dir, path.basename(name)), { force: true }, () => {});
}

module.exports = { UPLOAD_DIR, NOTES_DIR, AVATAR_DIR, noteUpload, avatarUpload, removeFile };
