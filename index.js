// index.js - CaratCam Plus License Server (router-safe version)

require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');
const fs = require('fs');
const cors = require('cors');

const app = express();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const PORT = process.env.PORT || 3000;
const LICENSES_FILE = 'licenses.json';
const PRICE_ID = 'price_1RkbkKCy3uw43pLE1GZrLrX7';

// =============================================
// ✅ 1. Stripe webhook route using raw parser
// =============================================
const webhookRouter = express.Router();
webhookRouter.use(bodyParser.raw({ type: 'application/json' }));

webhookRouter.post('/create-license', (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('📨 Stripe event received:', event.type);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('🔎 Webhook session payload:', session);

    const token = session.id;
    console.log('📦 Parsed token from session:', token);

    let licenses = [];
    if (fs.existsSync(LICENSES_FILE)) {
      const rawData = fs.readFileSync(LICENSES_FILE);
      licenses = JSON.parse(rawData);
    }

    if (!licenses.includes(token)) {
      licenses.push(token);
      fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2));
      console.log('✅ License token saved:', token);
    } else {
      console.log('⚠️ Token already exists:', token);
    }
  }

  res.json({ received: true });
});

app.use(webhookRouter);

// =============================================
// ✅ 2. Regular app routes use JSON body parser
// =============================================
app.use(cors());
app.use(express.static('public'));
app.use(bodyParser.json());

// Health check
app.get('/', (req, res) => {
  res.send('✅ CaratCam Plus license server is running');
});

// Create Checkout Session
app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: 'https://www.camlabs.ai/unlocked-caratcam-plus.html?token={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://www.camlabs.ai/plus-canceled.html',
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Failed to create checkout session:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Validate token
app.get('/check-license', (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(400).json({ valid: false, message: 'Token missing' });
  }

  let licenses = [];
  if (fs.existsSync(LICENSES_FILE)) {
    const rawData = fs.readFileSync(LICENSES_FILE);
    licenses = JSON.parse(rawData);
  }

  const valid = licenses.includes(token);
  res.json({ valid });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CaratCam Plus license server running on port ${PORT}`);
});
