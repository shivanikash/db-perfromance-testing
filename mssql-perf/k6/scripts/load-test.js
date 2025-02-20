import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomIntBetween } from 'k6/crypto';

export const options = {
  scenarios: {
    hr_portal: {
      executor: 'constant-vus',
      vus: 1800,
      duration: '10m',
      exec: 'hrPortal'
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<8000']  // 8s for 95th percentile
  }
};

const BASE_URLS = {
  HR_PORTAL: __ENV.HR_PORTAL_URL || 'http://hr-portal:3000'
};

function makeRequest(baseUrl, endpoint) {
  const url = `${baseUrl}${endpoint.path}`;
  const params = {
    headers: { 'Content-Type': 'application/json' }
  };

  try {
    let response;
    switch (endpoint.method.toUpperCase()) {
      case 'GET':
        response = http.get(url, params);
        break;
      case 'POST':
        response = http.post(url, JSON.stringify(endpoint.body || {}), params);
        break;
      case 'PUT':
        response = http.put(url, JSON.stringify(endpoint.body || {}), params);
        break;
    }

    // Simple status check
    check(response, {
      'status was 200': (r) => r.status === 200
    });

    // Adaptive sleep
    sleep(randomIntBetween(3,3));

  } catch (err) {
    sleep(2); // Sleep on error
  }
}

// HR Portal endpoints
export function hrPortal() {
  const endpoints = [
    // { path: '/health', method: 'GET' },
    // { path: '/people', method: 'GET' },
    // { path: '/product-categories', method: 'GET' },
    // { path: '/department-employees', method: 'GET' },
    // { path: '/recent-sales-orders', method: 'GET' },
    // { path: '/subcategory-products', method: 'GET' },
    // { path: '/order-status', method: 'GET' },
    // { path: '/state-addresses', method: 'GET' },
    // { path: '/specific-credit-vendors', method: 'GET' },
    // { path: '/territory-sales-orders', method: 'GET' },
    // { path: '/store-customers', method: 'GET' },
    // { path: '/recently-hired-employees', method: 'GET' },
    { path: '/combined', method: 'GET' },
    { path: '/combined1', method: 'GET' },
    { path: '/combined2', method: 'GET' },
    { path: '/combined3', method: 'GET' },
    { path: '/combined4', method: 'GET' },
    { path: '/combined5', method: 'GET' },
    { path: '/combined6', method: 'GET' },
    { path: '/combined7', method: 'GET' },
    { path: '/combined8', method: 'GET' },
    { path: '/combined9', method: 'GET' },
    { path: '/combined10', method: 'GET' },
    { path: '/combined11', method: 'GET' },
    { path: '/combined12', method: 'GET' },
    { path: '/combined13', method: 'GET' },
    { path: '/combined14', method: 'GET' },

  ];
  makeRequest(BASE_URLS.HR_PORTAL, endpoints[Math.floor(Math.random() * endpoints.length)]);
}