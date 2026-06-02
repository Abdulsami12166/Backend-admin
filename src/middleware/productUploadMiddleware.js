const multer = require('multer');

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_COUNT = 8;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: MAX_IMAGE_COUNT,
  },
  fileFilter(req, file, callback) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      callback(new Error('Only JPEG, PNG, WebP, and AVIF product images are allowed'));
      return;
    }

    callback(null, true);
  },
});

module.exports = {
  MAX_IMAGE_COUNT,
  MAX_IMAGE_SIZE_BYTES,
  uploadProductImages: upload.array('images', MAX_IMAGE_COUNT),
};
