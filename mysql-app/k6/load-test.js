import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomIntBetween } from 'k6/crypto';

export const options = {
  scenarios: {
    test_app: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // { duration: '2m', target: 8 },
        // { duration: '5m', target: 8 },
        { duration: '10m', target: 7000 }
      ],
      exec: 'testApp'
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<8000']  // 8s for 95th percentile
  }
};

const BASE_URLS = {
  TEST_APP: __ENV.TEST_APP_URL || 'http://test-app:4000'
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
export function testApp() {
  const endpoints = [
    { path: '/hr/employees/search', method: 'GET' },
     { path: '/admin/employees/search', method: 'GET' },
    //  { path: '/admin/departments/details', method: 'GET' },
    // // { path: '/hr/employees/transfer', method: 'POST' },
    //  { path: '/admin/employees/details', method: 'GET' },
    //  { path: '/admin/employees/update_multiple', method: 'GET' },
    //  { path: '/admin/reports/salary_audit', method: 'GET' },
    //  { path: '/admin/reports/transfer_audit', method: 'GET' },
    //  { path: '/admin/employees/bulk_title_update', method: 'PUT' },
    //  { path: '/admin/employees/data_export', method: 'GET' }
  ];
  makeRequest(BASE_URLS.TEST_APP, endpoints[Math.floor(Math.random() * endpoints.length)]);
}
