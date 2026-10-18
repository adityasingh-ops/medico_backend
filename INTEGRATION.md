# Medzo — Integration Guide

How the consumer app (`Medico/`) talks to the backend, and the contracts the
**store/inventory app** and the **doctor verification service** must implement to
plug in. Base URL is `EXPO_PUBLIC_API_URL` (default `http://192.168.1.7:5858`).
All consumer endpoints require `Authorization: Bearer <jwt>` unless noted.

---

## 1. Store / Inventory side

The consumer browses two ways:

- **Zepto-style (nearby inventory)** — `GET /api/medicines/nearby?longitude&latitude&maxDistance`
  Returns medicines stocked by stores within `maxDistance` metres (default 5000).
  Each medicine's `stores[]` is narrowed to the **nearby** stores that carry it, so
  the app adds to cart from a reachable store. **This is the "set by distance / nearest"
  behaviour** — it is driven by each store's `location` (GeoJSON `Point`, 2dsphere index)
  vs the customer's coordinates.
- **Swiggy-style (per store)** — `GET /api/medicines/store/:storeId` → `{ success, medicines: [...] }`.

### What the store app must do
1. **Keep `Store.location` accurate** (`{ type:'Point', coordinates:[lng,lat] }`) — distance
   filtering depends on it. `isActive` and `isVerified` matter: the order engine only routes to
   stores that are `isActive && isVerified`.
2. **Maintain its inventory list** via:
   - `POST /api/medicines/bulk-update-stores` `{ medicineIds: string[], storeId }` — add medicines to a store.
   - `POST /api/medicines/:id/toggle` — toggle a medicine's availability.
3. **Operating hours / rating / verified badge** are read from the `Store` document.

### ⚠️ Required data change: per-store stock & price
Today `Medicine.stock` and `Medicine.price` are **global** (one value across all stores), and a
medicine simply has a `stores: ObjectId[]` membership list. For real multi-store inventory the
store app needs **per-store stock and price**. Recommended model — a join collection:

```ts
// models/StoreInventory.ts (to add)
{
  storeId: ObjectId,      // ref Store
  medicineId: ObjectId,   // ref Medicine
  stock: number,          // per-store stock
  price: number,          // per-store price (optional; falls back to Medicine.price)
  isAvailable: boolean,
  updatedAt: Date
}
// unique index { storeId, medicineId }
```

When this lands, update: `getNearbyMedicines` / `getMedicinesByStore` to read stock+price from
`StoreInventory`, and `orderController.createOrder`'s availability checks (currently
`Medicine.stock >= 1`) to check the per-store row and **decrement stock** on order (it does not
decrement today).

### Order routing (already implemented — for context)
`POST /api/orders` `{ longitude, latitude, deliveryAddress, paymentMethod, maxDistance, verificationId? }`
- Phase 1: one nearby store has **all** items → single order (`data` = order).
- Phase 2: split across **two** stores → `data = { orders:[o1,o2], store1, store2 }`.
- Else → `404 { error: 'No nearby store has all items' }`. (Carts spanning >2 stores are blocked in the app.)

---

## 2. Doctor verification side (Rx → call → e-signed prescription)

When an order needs a prescription (an Rx medicine, or an uploaded prescription), the consumer app
creates a **verification request** and waits on a "doctor will call you" screen. A doctor calls the
customer, then records the decision; on approval a signed e-prescription is created and the order is
placed automatically with `isPrescriptionVerified = true`.

### Lifecycle
```
pending_call ──(doctor approves)──▶ approved  → e-prescription signed → order placed
             └─(doctor rejects)───▶ rejected  → user returned to cart
```

### Endpoints
| Method | Path | Auth | Who calls it |
|---|---|---|---|
| `POST` | `/api/verifications` | user JWT | consumer app — creates the request |
| `GET`  | `/api/verifications/:id` | user JWT | consumer app — polls status (every 4s) |
| `PUT`  | `/api/verifications/:id/decision` | **doctor app** | the doctor/telephony service |
| `POST` | `/api/verifications/:id/simulate` | user JWT | **dev only** — auto-approves for demo |

**`POST /api/verifications`** body:
```json
{ "items": [{ "medicineId": "...", "name": "Azithromycin 500" }],
  "prescriptionId": "<optional, from /api/prescriptions/extract>",
  "type": "rx_medicine | rx_upload",
  "phone": "<optional, defaults to user phone>" }
```
Response `data`: `{ _id, status:'pending_call', doctorName, phone, items }`.

**`PUT /api/verifications/:id/decision`** — *the contract your doctor/telephony app implements.*
After the verification call, POST the outcome here:
```json
{ "decision": "approved" | "rejected", "doctorName": "Dr. Meera Rao", "notes": "Verified by phone" }
```
On `approved` the backend creates a signed `Prescription` (status `approved`,
`notes: "E-signed by Dr X …"`) and links it as `verification.signedPrescriptionId`.
**Secure this endpoint for doctors** (add doctor auth/role) before production — it is currently open.

### Integration options for the doctor app
- **Polling** (simplest): your dashboard lists `pending_call` verifications and posts the decision.
- **Webhook/push** (better): emit an event on `POST /api/verifications` so the doctor app rings the
  customer immediately, then it calls `/decision`. (Socket.io is already wired for chat and can be
  reused to notify a `doctor:` room.)

### Removing the demo shortcut
`POST /api/verifications/:id/simulate` and the in-app "Simulate doctor approval" button are gated by
`NODE_ENV !== 'production'`. They exist only so the flow is demoable before the doctor app is ready;
no change needed for production beyond setting `NODE_ENV=production`.

---

## 3. AI prescription reader (already implemented)
`POST /api/prescriptions/extract` `{ imageBase64, mediaType }` → uses Claude vision
(`claude-haiku-4-5`, swappable to `claude-sonnet-4-6`) to extract medicines, matches them to the
catalogue, returns `{ prescriptionId, matched, unmatched, raw }`. Needs `ANTHROPIC_API_KEY` in
`.env` (see `.env.example`).
