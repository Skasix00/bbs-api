import { MongoClient } from 'mongodb';
import 'dotenv/config';

const client = new MongoClient(process.env.MONGODB_URI);
let db;

export async function connect() {
  if (!db) {
    await client.connect();
    db = client.db(); // uses database name from URI
  }
  return db;
}
