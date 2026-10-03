const express = require('express');
const app = express();
const { DATABASE_URL, REDIS_URL } = process.env;
const port = process.env.PORT || 3000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.get('/', (_, res) => res.send(process.env.APP_NAME));
app.listen(port);
