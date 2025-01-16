import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomIntBetween } from 'k6/crypto';

export const options = {
  scenarios: {
    hr_portal: {
      executor: 'constant-vus',
      vus: 2000,
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
    sleep(randomIntBetween(1, 3));

  } catch (err) {
    sleep(2); // Sleep on error
  }
}

// HR Portal endpoints
export function hrPortal() {
  const endpoints = [
    { path: '/hr/employees/search', method: 'GET' },
    { path: '/health', method: 'GET' },
    { path: '/hr/total-quantity-ordered', method: 'GET' },
    { path: '/hr/average-price', method: 'GET' },
    { path: '/hr/product-category-cross', method: 'GET' },
    { path: '/hr/orders-large', method: 'GET' },
    { path: '/hr/sales-orders', method: 'GET' },
    { path: '/hr/update-product-price', method: 'PUT' }
  ];
  makeRequest(BASE_URLS.HR_PORTAL, endpoints[Math.floor(Math.random() * endpoints.length)]);
}