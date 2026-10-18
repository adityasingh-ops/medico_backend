// Run: node clear-orders.js
// Deletes all orders from the database (dev/reset use only)
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) { console.error('MONGO_URI not set in .env'); process.exit(1); }

(async () => {
  await mongoose.connect(MONGO_URI);
  const result = await mongoose.connection.collection('orders').deleteMany({});
  console.log(`Deleted ${result.deletedCount} orders.`);
  await mongoose.disconnect();
})();
