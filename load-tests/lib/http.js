import http from 'k6/http';
import { config } from './config.js';

// ============================================================
// HTTP WRAPPER - logs unexpected status codes with full context
// ============================================================

function logError(method, path, expectedStatus, actual, body) {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  const truncated = bodyStr.length > 300 ? bodyStr.substring(0, 300) + '...' : bodyStr;
  console.error(
    `[HTTP_ERROR] ${method} ${path} | Expected ${expectedStatus}, got ${actual} | Body: ${truncated}`
  );
}

export function request(method, path, payload = null, headers = {}, endpoint = '') {
  const url = config.baseUrl + path;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    timeout: config.timeout,
    tags: { endpoint },
  };

  let response;

  if (method === 'GET') {
    response = http.get(url, params);
  } else if (method === 'POST') {
    response = http.post(url, payload ? JSON.stringify(payload) : null, params);
  } else if (method === 'PATCH') {
    response = http.patch(url, payload ? JSON.stringify(payload) : null, params);
  } else if (method === 'DELETE') {
    response = http.delete(url, params);
  }

  // Log unexpected status codes
  if (response.status >= 400) {
    logError(method, path, '2xx', response.status, response.body);
  }

  return response;
}
