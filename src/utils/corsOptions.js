const defaultAllowedOrigins = [
  'https://admin-app-web.onrender.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
];

const configuredOrigins = [
  process.env.CLIENT_URL,
  process.env.ADMIN_CLIENT_URL,
  process.env.ADMIN_WEB_URL,
  process.env.ALLOWED_ORIGINS,
]
  .filter(Boolean)
  .flatMap(value => value.split(','))
  .map(value => value.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...configuredOrigins]));

const isAllowedOrigin = origin => {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes('*')) {
    return true;
  }

  return allowedOrigins.includes(origin);
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
};

module.exports = {
  allowedOrigins,
  corsOptions,
};
