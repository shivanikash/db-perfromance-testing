import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomIntBetween } from 'k6/crypto';

function generateRampingStages(start, end, increment, duration) {
  const stages = [];
  // Ramp up
  for (let i = start; i <= end; i += increment) {
    stages.push({ duration: duration, target: i });
  }
  // Ramp down
  for (let i = end - increment; i >= start; i -= increment) {
    stages.push({ duration: duration, target: i });
  }
  return stages;
}

// Generate stages to ramp up from 1 to 500 and back down to 1, with 3-minute increments of 2 VUs
const stages = generateRampingStages(1, 200, 2, '3m');

export const options = {
  scenarios: {
    test_app: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: stages,
      exec: 'testApp'
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<8000']  // 8s for 95th percentile
  }
};

const BASE_URLS = {
  HR_PORTAL: __ENV.HR_PORTAL_URL || 'http://hr-portal:3000'
};

const endpoints = [
  { path: '/load1', method: 'GET' },
  { path: '/load2', method: 'GET' },
  { path: '/load3', method: 'GET' },
  { path: '/load4', method: 'GET' },
  { path: '/load5', method: 'GET' },
  { path: '/load6', method: 'GET' },
  { path: '/load7', method: 'GET' },
  { path: '/load8', method: 'GET' },
  { path: '/load9', method: 'GET' },
  { path: '/load10', method: 'GET' },
];


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

// Test App endpoints
export function testApp() {
  for (let i = 0; i < endpoints.length; i++) {
    makeRequest(BASE_URLS.HR_PORTAL, endpoints[i]);
    sleep(0.5);
  }
}