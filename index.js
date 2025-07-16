require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
console.log("✅ Redeploy triggered for Stripe + license routes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.raw({ type: 'application/json' }));

// ✅ Health check
app.get('/', (req, res) => {
  res.send('✅ CaratCam Plus license server is live');
});

// 💳 Create Stripe Checkout Session
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { priceId } = JSON.parse(req.body.toString());
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: 'https://camlabs.ai/unlocked-caratcam-plus.html?token={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://camlabs.ai/thank-you-plus.html',
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Error creating checkout session:', err);
    res.status(500).send('Failed to create Stripe session');
  }
});

// 🧾 Stripe Webhook to issue license
app.post('/create-license', (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const token = session.id;
    const licenses = fs.existsSync('licenses.json')
      ? JSON.parse(fs.readFileSync('licenses.json', 'utf8'))
      : [];

    if (!licenses.includes(token)) {
      licenses.push(token);
      fs.writeFileSync('licenses.json', JSON.stringify(licenses, null, 2));
      console.log('✅ License issued:', token);
    }
  }

  res.status(200).send('OK');
});

// 🔐 Check license validity
app.get('/check-license', (req, res) => {
  const token = req.query.token;
  const licenses = fs.existsSync('licenses.json')
    ? JSON.parse(fs.readFileSync('licenses.json', 'utf8'))
    : [];

  const isValid = licenses.includes(token);
  res.json({ valid: isValid });
});

// 🚀 Start the server
app.listen(PORT, () => {
  console.log(`🚀 CaratCam Plus license server running on port ${PORT}`);
});
