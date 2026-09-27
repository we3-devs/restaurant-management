// Times the POS order-to-payment flow against a live backend, step by step:
// the same requests the staff app makes to take a grab-and-go order, send it
// to the kitchen, take payment and complete the sale.
//
// Creates real orders and payments, so point it at a test tenant.
//
//   API_URL=https://restra-backend.onrender.com/api \
//   TENANT_SLUG=test LOAD_TEST_EMAIL=... LOAD_TEST_PASSWORD=... \
//   LOAD_TEST_OUTLET_ID=27 ROUNDS=3 node load-tests/pos-speed.mjs

const required = ["API_URL", "TENANT_SLUG", "LOAD_TEST_EMAIL", "LOAD_TEST_PASSWORD", "LOAD_TEST_OUTLET_ID"]
const missing = required.filter((name) => !process.env[name]?.trim())
if (missing.length > 0) {
  console.error(`Not set: ${missing.join(", ")}`)
  process.exit(1)
}

const API_URL = process.env.API_URL.replace(/\/+$/, "")
const OUTLET_ID = Number(process.env.LOAD_TEST_OUTLET_ID)
const ROUNDS = Number(process.env.ROUNDS || 3)
const timings = new Map()

async function call(step, method, path, { token, body } = {}) {
  const started = performance.now()
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Slug": process.env.TENANT_SLUG,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  const ms = performance.now() - started
  if (!timings.has(step)) timings.set(step, [])
  timings.get(step).push(ms)
  if (!response.ok) throw new Error(`${step}: ${response.status} ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const { accessToken: token, refreshToken } = await call("login", "POST", "/auth/login", {
  body: { email: process.env.LOAD_TEST_EMAIL, password: process.env.LOAD_TEST_PASSWORD },
})
const menu = await call("load menu", "GET", `/menu/bootstrap?outletId=${OUTLET_ID}`, { token })
const item = menu.foodVariants.find((variant) => Number(variant.price) > 0)
if (!item) throw new Error("No priced food item on this outlet's menu")

for (let round = 1; round <= ROUNDS; round += 1) {
  const started = performance.now()
  await call("auth/me", "GET", "/auth/me", { token })
  const order = await call("create order", "POST", "/orders", {
    token,
    body: { outletId: OUTLET_ID, orderType: "grab_and_go", note: "pos-speed test" },
  })
  const items = await call("add items", "POST", `/orders/${order.id}/items/batch`, {
    token,
    body: { items: [{ foodId: item.foodId, foodVariantId: item.id, quantity: 2 }] },
  })
  await call("send to kitchen", "POST", `/orders/${order.id}/send-to-kitchen`, {
    token,
    body: { itemIds: items.map((created) => created.id) },
  })
  const priced = await call("load order", "GET", `/orders/${order.id}`, { token })
  await call("take payment", "POST", `/orders/${order.id}/payments`, {
    token,
    body: { type: "payment", method: "cash", amount: Number(priced.dueAmount) },
  })
  await call("load payments", "GET", `/order-payments?orderId=${order.id}&limit=100`, { token })
  await call("complete sale", "PATCH", `/orders/${order.id}/status`, {
    token,
    body: { status: "completed", autoServe: true },
  })
  console.log(`round ${round}: order ${order.id} done in ${Math.round(performance.now() - started)} ms`)
}

await call("logout", "POST", "/auth/logout", { body: { refreshToken } })

console.log("\nstep               median     min     max   (ms)")
for (const [step, values] of timings) {
  const row = [median(values), Math.min(...values), Math.max(...values)].map((v) => String(Math.round(v)).padStart(7))
  console.log(`${step.padEnd(16)} ${row.join(" ")}`)
}
