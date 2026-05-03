const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const BEARER_TOKEN = process.env.BEARER_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Mesajlar
const MSG_NEW      = process.env.MSG_NEW      || 'Hoşgeldin {kullanici}!';   // 1. ay
const MSG_REGULAR  = process.env.MSG_REGULAR  || 'Tekrar hoşgeldin {kullanici}!'; // 2-5. ay
const MSG_VETERAN  = process.env.MSG_VETERAN  || '{kullanici} {ay} ay oldu!'; // 6+ ay
const GIFT_MESSAGE = process.env.GIFT_MESSAGE || '{gonderen} hediye abone gönderdi, hoşgeldin {alan}!';

// Sağlık kontrolü
app.get('/', (req, res) => {
  res.send('KickBot çalışıyor ✅');
});

// Kick buraya POST atacak
app.post('/webhook', async (req, res) => {
  try {
    // Güvenlik kontrolü
    const secret = req.headers['x-kick-signature'] || req.headers['x-webhook-secret'];
    if (secret !== WEBHOOK_SECRET) {
      console.log('Geçersiz webhook secret');
      return res.status(401).send('Unauthorized');
    }

    const event = req.body;
    console.log('Gelen event:', JSON.stringify(event));
    if (process.env.ACTIVE === 'false') {
     console.log('Bot pasif, mesaj atılmadı.');
     return res.status(200).send('OK');
}

    // Sub eventi
    if (
      event.type === 'subscription' ||
      event.event === 'App\\Events\\SubscriptionEvent' ||
      event.event === 'channel.subscribed'
    ) {
      const username = event?.data?.username || event?.data?.subscriber?.username || event?.username || null;
      const months   = event?.data?.months || event?.data?.duration || event?.months || 1;

      if (username) {
        let template;
        if (months === 1) {
          template = MSG_NEW;
        } else if (months >= 6) {
          template = MSG_VETERAN;
        } else {
          template = MSG_REGULAR;
        }

        const message = template
          .replace(/\{kullanici\}/gi, username)
          .replace(/\{ay\}/gi, months);

        const ok = await sendMessage(message);
        console.log(`[${months}. ay] Mesaj gönderildi → ${username} | ok: ${ok}`);
      }
    }

    // Gifted sub eventi
    if (
      event.type === 'gifted_subscription' ||
      event.event === 'App\\Events\\GiftedSubscriptionsEvent' ||
      event.event === 'channel.subscription.gifted'
    ) {
      const giver    = event?.data?.gifted_by || event?.data?.gifter?.username || event?.username || null;
      const receiver = event?.data?.gifted_username || event?.data?.receiver?.username || null;

      if (giver) {
        const message = GIFT_MESSAGE
          .replace(/\{gonderen\}/gi, giver)
          .replace(/\{alan\}/gi, receiver || '');
        await sendMessage(message);
        console.log(`Gift mesajı gönderildi → ${giver}`);
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook hatası:', err.message);
    res.status(500).send('Error');
  }
});

// Chat'e mesaj gönderme
async function sendMessage(text) {
  try {
    await axios.post(
      `https://kick.com/api/v2/messages/send/${CHANNEL_ID}`,
      { content: text, type: 'message' },
      {
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    return true;
  } catch (err) {
    console.error('Mesaj gönderilemedi:', err?.response?.data || err.message);
    return false;
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`KickBot ${PORT} portunda çalışıyor`);
});