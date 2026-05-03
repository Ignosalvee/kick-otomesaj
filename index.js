const express = require('express');
const axios = require('axios');
require('dotenv').config(); // DEĞİŞTİR: .env dosyasından değerleri okur - Railway'de env vars kullanılır

const app = express();
app.use(express.json());

const BEARER_TOKEN = process.env.BEARER_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const WELCOME_MESSAGE = process.env.WELCOME_MESSAGE || 'Hoşgeldin {kullanici}! 🎉';

// Sağlık kontrolü - Railway bu endpoint'i kontrol eder
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

    // Sub eventi mi kontrol et
    if (
      event.type === 'subscription' ||
      event.event === 'App\\Events\\SubscriptionEvent' ||
      event.event === 'channel.subscribed'
    ) {
      const username =
        event?.data?.username ||
        event?.data?.subscriber?.username ||
        event?.username ||
        null;

      if (username) {
        const message = WELCOME_MESSAGE.replace(/\{kullanici\}/gi, username);
        await sendMessage(message);
        console.log(`Mesaj gönderildi: ${username}`);
      }
    }

    // Gifted sub eventi mi kontrol et
    if (
      event.type === 'gifted_subscription' ||
      event.event === 'App\\Events\\GiftedSubscriptionsEvent' ||
      event.event === 'channel.subscription.gifted'
    ) {
      const giver =
        event?.data?.gifted_by ||
        event?.data?.gifter?.username ||
        event?.username ||
        null;

      const receiver =
        event?.data?.gifted_username ||
        event?.data?.receiver?.username ||
        null;

      if (giver) {
        const giftMessage = process.env.GIFT_MESSAGE || '{gonderen} hediye abone gönderdi! 🎁';
        const message = giftMessage
          .replace(/\{gonderen\}/gi, giver)
          .replace(/\{alan\}/gi, receiver || '');
        await sendMessage(message);
        console.log(`Gift mesajı gönderildi: ${giver}`);
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook hatası:', err.message);
    res.status(500).send('Error');
  }
});

// Chat'e mesaj gönderme fonksiyonu
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
  } catch (err) {
    console.error('Mesaj gönderilemedi:', err?.response?.data || err.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`KickBot ${PORT} portunda çalışıyor`);
});