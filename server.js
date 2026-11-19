require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const connectDatabase = require('./config/database');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

async function start() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('Configura SESSION_SECRET en .env con al menos 32 caracteres.');
  }
  await connectDatabase();
  app.use(session({
    name: 'umatronix.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI, collectionName: 'sessions', ttl: 60 * 60 * 24 * 7 }),
    cookie: { httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge: 1000 * 60 * 60 * 24 * 7 }
  }));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/products', require('./routes/products'));
  app.use('/api/orders', require('./routes/orders'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/api/health', (req, res) => res.json({ status: 'ok', database: 'connected' }));
  app.use((req, res) => res.status(404).json({ message: 'Ruta no encontrada.' }));
  app.use((err, req, res, next) => {
    console.error(err);
    const status = err.status || (err.code === 11000 ? 409 : 500);
    res.status(status).json({ message: status === 500 ? 'Ocurrió un error interno.' : err.message });
  });
  app.listen(PORT, () => console.log(`Umatronix disponible en http://localhost:${PORT}`));
}
start().catch(err => { console.error('No se pudo iniciar Umatronix:', err.message); process.exit(1); });
