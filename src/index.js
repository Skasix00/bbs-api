import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import fs from 'fs';
import path from 'path';
import { connect } from '../lib/mongodb.js';

const app = Fastify({ logger: true });

// --- CORS ---
await app.register(cors, {
  origin: '*', // Aceita todas as origens
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition'],
  credentials: true
});

// --- Multipart (upload de ficheiros) ---
await app.register(multipart);

// --- Uploads e ficheiros estáticos ---
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Serve a pasta de uploads
await app.register(staticPlugin, {
  root: UPLOADS_DIR,
  prefix: '/uploads/',
});

// --- Endpoints ---

// GET /users
app.get('/users', async (req, reply) => {
  const db = await connect();
  const users = await db.collection('users').find().toArray();
  return users.map(u => ({ id: u._id.toString(), name: u.name, nickname: u.nickname }));
});

// POST /users
app.post('/users', async (req, reply) => {
  const { name, nickname } = req.body;
  if (!name || !nickname) return reply.code(400).send({ error: 'Name and nickname required' });

  const db = await connect();
  const res = await db.collection('users').insertOne({ name, nickname });
  return { id: res.insertedId.toString(), name, nickname };
});

// GET /photos
app.get('/photos', async (req, reply) => {
  const db = await connect();
  const photos = await db.collection('photos').find().sort({ createdAt: -1 }).toArray();
  const users = await db.collection('users').find().toArray();
  const mapNick = Object.fromEntries(users.map(u => [u._id.toString(), u.nickname]));

  return photos.map(p => ({
    id: p._id.toString(),
    url: `/uploads/${p.filename}`,
    nickname: mapNick[p.userId] || 'Unknown',
    message: p.message || ''
  }));
});

// POST /photos
app.post('/photos', async (req, reply) => {
  const { userId } = req.query;
  if (!userId) return reply.code(400).send({ error: 'userId required' });

  let message = '';
  let filePart;

  for await (const part of req.parts()) {
    if (part.fieldname === 'message') {
      message = await part.value;
    }
    if (part.file) {
      filePart = part;
    }
  }

  if (!filePart) return reply.code(400).send({ error: 'file missing' });

  const filename = `${Date.now()}-${filePart.filename}`;
  const filepath = path.join(UPLOADS_DIR, filename);

  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(filepath);
    filePart.file.pipe(ws);
    ws.on('finish', resolve);
    ws.on('error', reject);
  });

  const db = await connect();
  await db.collection('photos').insertOne({ userId, filename, message, createdAt: new Date() });

  // Retornar os dados do ficheiro
  return { id: filename, url: `/uploads/${filename}`, message };
});

// --- Start server ---
const port = process.env.PORT || 4000;
app.listen({ port, host: '0.0.0.0' }, err => {
  if (err) throw err;
  app.log.info(`API listening on http://localhost:${port}`);
});
