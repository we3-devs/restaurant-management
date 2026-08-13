import { config } from './config.js';
import { request } from './http.js';

// ============================================================
// AUTHENTICATION
// ============================================================

export function login() {
  const route = config.routes.login;
  const payload = {
    email: config.email,
    password: config.password,
  };

  const response = request(route.method, route.path, payload, {}, 'login');

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `Login failed: ${response.status} ${response.body}`
    );
  }

  try {
    const body = JSON.parse(response.body);
    const token = body.accessToken;
    if (!token) {
      throw new Error('No accessToken in login response');
    }
    return token;
  } catch (e) {
    throw new Error(`Failed to parse login response: ${e.message}`);
  }
}

export function getProfile(token) {
  const route = config.routes.profile;
  const response = request(
    route.method,
    route.path,
    null,
    { Authorization: `Bearer ${token}` },
    'profile'
  );

  if (response.status !== 200) {
    throw new Error(
      `Profile fetch failed: ${response.status} ${response.body}`
    );
  }

  try {
    return JSON.parse(response.body);
  } catch (e) {
    throw new Error(`Failed to parse profile response: ${e.message}`);
  }
}
