/**
 * Idempotent demo-data repair for the Medzo dev database.
 *
 * Run:  node seed-demo.js            # repair + report
 *       node seed-demo.js --report   # report only, change nothing
 *
 * Fixes the data problems that made the end-to-end demo fail:
 *   1. Medicines referencing store ids that no longer exist (broken populate).
 *   2. Demo pharmacies left isVerified:false — order routing only sells from
 *      verified + active stores, so checkout returned "no stores found".
 *   3. Duplicate placeholder "Med Store" rows with no inventory.
 *   4. Empty preset-message table, so chat had no quick replies.
 *
 * This only ever touches the seeded demo pharmacies (MedzoPlus / MediCare Plus)
 * and never invents a verification for a store that carries no inventory.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const REPORT_ONLY = process.argv.includes('--report');

// The pharmacies the demo actually sells from, by name.
const DEMO_STORES = ['MedzoPlus', 'MedzoPlus 2', 'MediCare Plus'];

// Field names and category values must match models/PresetMessage.ts
// (`message`, and category ∈ greeting|symptom|product|followup).
const PRESETS = [
  { message: 'Hi! How can we help you today?', category: 'greeting', triggerKeywords: ['hi', 'hello'] },
  { message: 'Is this medicine in stock?', category: 'product', triggerKeywords: ['stock', 'available'] },
  { message: 'Do you have a generic alternative?', category: 'product', triggerKeywords: ['generic', 'cheaper'] },
  { message: 'I have a fever and headache — what do you suggest?', category: 'symptom', triggerKeywords: ['fever', 'headache'] },
  { message: 'How long will delivery take?', category: 'followup', triggerKeywords: ['delivery', 'time'] },
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const stores = db.collection('stores');
  const medicines = db.collection('medicines');
  const presets = db.collection('presetmessages');

  const log = (...a) => console.log(REPORT_ONLY ? '[report]' : '[fix]   ', ...a);
  console.log(REPORT_ONLY ? '=== REPORT ONLY — no writes ===' : '=== REPAIRING DEMO DATA ===');

  // ── 1. Drop medicine → store references that point at deleted stores ───────
  const liveIds = new Set((await stores.find({}, { projection: { _id: 1 } }).toArray()).map(s => String(s._id)));
  const meds = await medicines.find({}).toArray();
  let danglingTotal = 0;
  for (const m of meds) {
    const before = (m.stores || []).map(String);
    const after = before.filter(id => liveIds.has(id));
    if (after.length !== before.length) {
      danglingTotal += before.length - after.length;
      log(`${m.name}: dropping ${before.length - after.length} dead store ref(s)`);
      if (!REPORT_ONLY) {
        await medicines.updateOne(
          { _id: m._id },
          { $set: { stores: after.map(id => new mongoose.Types.ObjectId(id)) } }
        );
      }
    }
  }
  log(`dangling store refs: ${danglingTotal}`);

  // ── 2. Verify + activate demo pharmacies that actually hold inventory ──────
  for (const name of DEMO_STORES) {
    const store = await stores.findOne({ name });
    if (!store) { log(`store "${name}" not present — skipped`); continue; }
    const stocked = await medicines.countDocuments({ stores: store._id });
    if (stocked === 0) { log(`"${name}" carries no medicines — NOT verifying`); continue; }
    if (store.isVerified && store.isActive) { log(`"${name}" already verified (${stocked} medicines)`); continue; }
    log(`verifying "${name}" (${stocked} medicines)`);
    if (!REPORT_ONLY) {
      await stores.updateOne({ _id: store._id }, { $set: { isVerified: true, isActive: true } });
    }
  }

  // ── 3. Deactivate empty placeholder stores so they stop polluting results ──
  const placeholders = await stores.find({ name: /^Med Store/ }).toArray();
  for (const s of placeholders) {
    const stocked = await medicines.countDocuments({ stores: s._id });
    if (stocked === 0 && s.isActive) {
      log(`deactivating empty placeholder "${s.name}" (${s._id})`);
      if (!REPORT_ONLY) await stores.updateOne({ _id: s._id }, { $set: { isActive: false } });
    }
  }

  // ── 4. Seed chat preset messages per verified store ───────────────────────
  const verified = await stores.find({ isVerified: true }).toArray();
  for (const s of verified) {
    // Drop rows that don't match the schema (an earlier seed wrote `text`).
    const bad = await presets.countDocuments({ storeId: s._id, message: { $exists: false } });
    if (bad > 0) {
      log(`"${s.name}": removing ${bad} malformed preset message(s)`);
      if (!REPORT_ONLY) await presets.deleteMany({ storeId: s._id, message: { $exists: false } });
    }
    const have = await presets.countDocuments({ storeId: s._id, message: { $exists: true } });
    if (have > 0) { log(`"${s.name}" already has ${have} preset messages`); continue; }
    log(`seeding ${PRESETS.length} preset messages for "${s.name}"`);
    if (!REPORT_ONLY) {
      await presets.insertMany(
        PRESETS.map(p => ({ ...p, storeId: s._id, isActive: true, createdAt: new Date(), updatedAt: new Date() }))
      );
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n=== DEMO READINESS ===');
  const sellable = await stores.find({ isVerified: true, isActive: true }).toArray();
  for (const s of sellable) {
    const n = await medicines.countDocuments({ stores: s._id });
    console.log(` ✓ ${s.name} — ${n} medicines @ [${s.location?.coordinates}]`);
  }
  if (sellable.length === 0) console.log(' ✗ No verified+active store — checkout WILL fail.');
  console.log(` catalogue: ${await medicines.countDocuments({ isAvailable: true, stock: { $gte: 1 } })} medicines in stock`);
  console.log(` preset messages: ${await presets.countDocuments()}`);

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
