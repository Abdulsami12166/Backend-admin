const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

require('dotenv').config();

const adminRoutes = require('./routes/adminRoutes');
const adminExtendedRoutes = require('./routes/adminExtendedRoutes');
const webhookController = require('./controllers/webhookController');
const bodyParser = require('body-parser');
const { requestLogger } = require('./middleware/requestLogger');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { corsOptions } = require('./utils/corsOptions');

const app = express();

app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Admin backend is running',
  });
});

app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    message: 'Admin backend is running',
  });
});

app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/admin', adminExtendedRoutes);

// Razorpay webhook endpoint (raw body required for signature verification)
app.post('/webhooks/razorpay', bodyParser.raw({ type: 'application/json' }), webhookController.razorpayWebhook);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

