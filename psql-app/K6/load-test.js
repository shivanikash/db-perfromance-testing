import http from 'k6/http';
import { check, sleep } from 'k6';
//import { randomIntBetween } from 'k6/crypto';

export const options = {
  scenarios: {
    movie_matrix: {

// Stress testing
//      executor: 'ramping-vus',
//      startVUs: 0,
//      stages: [
//         { duration: '2m', target: 8 },
//         { duration: '5m', target: 8 },
//        { duration: '2m', target: 0 }
//      ],
//      exec: 'movieMatrixApp'

// Load testing
      executor: 'constant-vus',
      vus: 1000,
      duration: '10m',
      exec: 'movieMatrixApp'

    }
  },
  thresholds: {
    http_req_duration: ['p(95)<8000']  // 8s for 95th percentile
  }
};

const BASE_URLS = {
  MOVIE_MATRIX: __ENV.MOVIE_MATRIX_URL || 'http://movie-matrix:4000'
};

export default function () {
  const url = `${BASE_URLS.MOVIE_MATRIX}/health`;  // dynamic base URL
  const response = http.get(url);

  check(response, {
    'status is 200': (r) => r.status === 200,
  });
}

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
        console.error(`Error during request to ${endpoint.path}: ${err.message}`);
        sleep(2); // Sleep on error
  }
}

// Movie-Matrix endpoints
export function movieMatrixApp() {
  const endpoints = [
    { path: '/actors/top_by_film_count', method: 'GET' },
     { path: '/customers/top_spenders', method: 'GET' },
     { path: '/store-rental-income', method: 'GET' }
//      { path: '/add-customer-rental', method: 'POST' },
//     { path: '/update-inventory/:film_id', method: 'PUT' },
//     { path: '/add-payment', method: 'POST' }
  ];
//  makeRequest(BASE_URLS.MOVIE_MATRIX, endpoints[Math.floor(Math.random() * endpoints.length)]);

  const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  // Make the request to the randomly selected endpoint
  makeRequest(BASE_URLS.MOVIE_MATRIX, randomEndpoint);
}

// function to simulate `randomIntBetween` if needed
function randomIntBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}