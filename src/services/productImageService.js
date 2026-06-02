const { v2: cloudinary } = require('cloudinary');

const hasCloudinaryConfig = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME
      && process.env.CLOUDINARY_API_KEY
      && process.env.CLOUDINARY_API_SECRET,
  );

const configureCloudinary = () => {
  if (!hasCloudinaryConfig()) {
    return false;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return true;
};

const uploadBufferToCloudinary = file =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_PRODUCT_FOLDER || 'ecommerce/products',
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );

    stream.end(file.buffer);
  });

const uploadProductImages = async files => {
  if (!files?.length) {
    return [];
  }

  if (!configureCloudinary()) {
    const error = new Error('Cloudinary image storage is not configured');
    error.statusCode = 500;
    throw error;
  }

  return Promise.all(files.map(uploadBufferToCloudinary));
};

module.exports = {
  uploadProductImages,
};
