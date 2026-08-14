import { config } from './config.js';
import { request } from './http.js';

// ============================================================
// ORDER OPERATIONS
// ============================================================

export function listOrders(token) {
  const route = config.routes.listOrders;
  return request(
    route.method,
    route.path,
    null,
    { Authorization: `Bearer ${token}` },
    'list_orders'
  );
}

export function listFoods(token) {
  const route = config.routes.listFoods;
  return request(
    route.method,
    route.path,
    null,
    { Authorization: `Bearer ${token}` },
    'list_foods'
  );
}

export function createOrder(token, outletId = null, orderType = 'table') {
  const route = config.routes.createOrder;
  const payload = {
    outletId: outletId || config.outletId,
    orderType,
  };

  const response = request(
    route.method,
    route.path,
    payload,
    { Authorization: `Bearer ${token}` },
    'create_order'
  );

  if (response.status < 200 || response.status >= 300) {
    console.error(
      `[ORDER_ERROR] createOrder failed: ${response.status} ${response.body}`
    );
    return null;
  }

  try {
    const body = JSON.parse(response.body);
    return body.id;
  } catch (e) {
    console.error(`[PARSE_ERROR] createOrder response: ${e.message}`);
    return null;
  }
}

export function addItem(token, orderId, foodId = null, quantity = 1) {
  const route = config.routes.addItem;
  const path = route.path.replace(':id', orderId);
  const payload = {
    foodId: foodId || config.foodId,
    quantity,
  };

  return request(
    route.method,
    path,
    payload,
    { Authorization: `Bearer ${token}` },
    'add_item'
  );
}

export function setStatus(token, orderId, status) {
  const route = config.routes.updateStatus;
  const path = route.path.replace(':id', orderId);
  const payload = { status };

  return request(
    route.method,
    path,
    payload,
    { Authorization: `Bearer ${token}` },
    'set_status'
  );
}

export function completeOrder(token, orderId) {
  return setStatus(token, orderId, 'completed');
}

export function getOrder(token, orderId) {
  const route = config.routes.getOrder;
  const path = route.path.replace(':id', orderId);

  return request(
    route.method,
    path,
    null,
    { Authorization: `Bearer ${token}` },
    'get_order'
  );
}
