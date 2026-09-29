// Times the POS order-to-payment flow against a live backend, step by step:
// the same requests the staff app makes to take a grab-and-go order, send it
// to the kitchen, take payment and complete the sale. CONCURRENT orders are
// placed at the same time in each round, to see how it holds up in a rush.
//
// Creates real orders and payments (and uses up stock for tracked items), so
// point it at a test tenant.
//
//   API_URL=https://restra-backend.onrender.com/api \
//   TENANT_SLUG=test LOAD_TEST_EMAIL=... LOAD_TEST_PASSWORD=... \
//   LOAD_TEST_OUTLET_ID=27 ROUNDS=3 CONCURRENT=5 node load-tests/pos-speed.mjs

const required = ["API_URL", "TENANT_SLUG", "LOAD_TEST_EMAIL", "LOAD_TEST_PASSWORD", "LOAD_TEST_OUTLET_ID"]
const missing = required.filter((name) => !process.env[name]?.trim())
if (missing.length > 0) {
  console.error(`Not set: ${missing.join(", ")}`)
  process.exit(1)
}

const API_URL = process.env.API_URL.replace(/\/+$/, "")
const OUTLET_ID = Number(process.env.LOAD_TEST_OUTLET_ID)
const ROUNDS = Number(process.env.ROUNDS || 3)
const CONCURRENT = Number(process.env.CONCURRENT || 1)
const timings = new Map()
let token = null

async function call(step, method, path, body) {
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
  if (!response.ok) throw new Error(`${step}: ${response.status} ${text.slice(0, 200)}`)
  // Only successful calls are timed, so a retried step doesn't skew the numbers.
  if (!timings.has(step)) timings.set(step, [])
  timings.get(step).push(performance.now() - started)
  return text ? JSON.parse(text) : null
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const ms = (value) => String(Math.round(value)).padStart(7)

// Menu items to order, untracked ones first so the run doesn't drain stock;
// if an item runs out anyway (a recipe's ingredients), the next one is used.
let candidates = []
let candidateIndex = 0

async function addItems(orderId) {
  for (;;) {
    const item = candidates[candidateIndex]
    if (!item) throw new Error("No menu item on this outlet has stock left to order")
    try {
      return await call("add items", "POST", `/orders/${orderId}/items/batch`, {
        items: [{ foodId: item.foodId, foodVariantId: item.id, quantity: 1 }],
      })
    } catch (error) {
      if (!/insufficient available stock/i.test(error.message)) throw error
      if (candidates[candidateIndex] === item) candidateIndex += 1
    }
  }
}

async function placeOrder() {
  const started = performance.now()
  const order = await call("create order", "POST", "/orders", {
    outletId: OUTLET_ID,
    orderType: "grab_and_go",
    note: "pos-speed test",
  })
  try {
    const items = await addItems(order.id)
    await call("send to kitchen", "POST", `/orders/${order.id}/send-to-kitchen`, {
      itemIds: items.map((created) => created.id),
    })
    const priced = await call("load order", "GET", `/orders/${order.id}`)
    await call("take payment", "POST", `/orders/${order.id}/payments`, {
      type: "payment",
      method: "cash",
      amount: Number(priced.dueAmount),
    })
    await call("load payments", "GET", `/order-payments?orderId=${order.id}&limit=100`)
    await call("complete sale", "PATCH", `/orders/${order.id}/status`, { status: "completed", autoServe: true })
    return { id: order.id, ms: performance.now() - started }
  } catch (error) {
    // Don't leave a half-finished test order open on the floor.
    await call("cancel (cleanup)", "PATCH", `/orders/${order.id}/status`, { status: "cancelled" }).catch(() =>
      console.error(`  order ${order.id} could not be cancelled — close it by hand`),
    )
    throw error
  }
}

let refreshToken = null
let failures = 0
try {
  const session = await call("login", "POST", "/auth/login", {
    email: process.env.LOAD_TEST_EMAIL,
    password: process.env.LOAD_TEST_PASSWORD,
  })
  token = session.accessToken
  refreshToken = session.refreshToken

  const menu = await call("load menu", "GET", `/menu/bootstrap?outletId=${OUTLET_ID}`)
  const activeFoods = new Set(menu.foods.filter((food) => food.isActive !== false).map((food) => food.id))
  candidates = menu.foodVariants
    .filter((variant) => variant.isActive !== false && Number(variant.price) > 0 && activeFoods.has(variant.foodId))
    .sort((a, b) => Number(a.inventoryIngredientId !== null) - Number(b.inventoryIngredientId !== null))
  if (candidates.length === 0) throw new Error("No priced, active food item on this outlet's menu")

  for (let round = 1; round <= ROUNDS; round += 1) {
    const started = performance.now()
    await call("auth/me", "GET", "/auth/me")
    const results = await Promise.allSettled(Array.from({ length: CONCURRENT }, () => placeOrder()))
    const done = results.filter((result) => result.status === "fulfilled").map((result) => result.value)
    for (const result of results) {
      if (result.status === "rejected") {
        failures += 1
        console.error(`  failed: ${result.reason.message}`)
      }
    }
    const slowest = done.length ? Math.max(...done.map((order) => order.ms)) : 0
    console.log(
      `round ${round}: ${done.length}/${CONCURRENT} orders at once, all done in ${Math.round(performance.now() - started)} ms` +
        (done.length ? ` (slowest ${Math.round(slowest)} ms; orders ${done.map((order) => order.id).join(", ")})` : ""),
    )
  }
} finally {
  if (refreshToken) await call("logout", "POST", "/auth/logout", { refreshToken }).catch(() => undefined)
}

console.log("\nstep               median     min     max  count   (ms)")
for (const [step, values] of timings) {
  console.log(`${step.padEnd(16)} ${ms(median(values))} ${ms(Math.min(...values))} ${ms(Math.max(...values))} ${String(values.length).padStart(6)}`)
}
if (failures > 0) {
  console.log(`\n${failures} order(s) failed`)
  process.exitCode = 1
}
