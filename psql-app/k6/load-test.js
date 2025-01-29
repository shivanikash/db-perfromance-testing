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

      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
//            { duration: '1m', target: 10 },  // Stay at 10 VUs for 10 minutes
//                { duration: '5m', target: 110 }, // Ramp-up from 10 to 110 VUs in 10 minutes
//                { duration: '5m', target: 110 }, // Stay at 110 VUs for 10 minutes
                { duration: '10m', target: 310 }, // Ramp-up from 110 to 210 VUs in 10 minutes
                { duration: '10m', target: 310 }, // Stay at 210 VUs for 10 minutes
                { duration: '15m', target: 550 }, // Ramp-up from 210 to 310 VUs in 10 minutes
                { duration: '15m', target: 550 }, // Stay at 310 VUs for 10 minutes
                { duration: '20m', target: 1000 }, // Ramp-up from 310 to 410 VUs in 10 minutes
                { duration: '20m', target: 1000 }, // Stay at 410 VUs for 10 minutes
                { duration: '30m', target: 2000 }, // Ramp-up from 410 to 510 VUs in 10 minutes
                { duration: '30m', target: 2000 }, // Stay at 510 VUs for 10 minutes
                { duration: '5m', target: 0 },   // Ramp-down to 0 VUs
          ],
          exec: 'movieMatrixApp'

// Load testing
//      executor: 'constant-vus',
//      vus: 500,
//      duration: '30m',
//      exec: 'movieMatrixApp'
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<8000']  // 8s for 95th    percentile
  }
};

const BASE_URLS = {
  MOVIE_MATRIX: __ENV.MOVIE_MATRIX_URL || 'http://movie-matrix:5000'
};

//export default function () {
//  const url = `${BASE_URLS.MOVIE_MATRIX}/health`;  // dynamic base URL
//  const response = http.get(url);
//
//  check(response, {
//    'status is 200': (r) => r.status === 200,
//  });
//}

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
     { path: '/store-rental-income', method: 'GET' },
     { path: '/all-customers', method: 'GET'},
     { path: '/customer-names', method: 'GET'},
     { path: '/customer-lname', method: 'GET'},
     { path: '/customer-email', method: 'GET'},
     { path: '/customer-count', method: 'GET'},
     { path: '/customer-dis-name', method: 'GET'},
     { path: '/customers-order-date', method: 'GET'},
     { path: '/customers-limit-5', method: 'GET'},
     { path: '/customers-null-phone', method: 'GET'},
     { path: '/order-items', method: 'GET'},
     { path: '/all-products', method: 'GET'},
     { path: '/product-price', method: 'GET'},
     { path: '/product-price-50', method: 'GET'},
     { path: '/avg-product-price', method: 'GET'},
     { path: '/product-category', method: 'GET'},
     { path: '/product-stock-0', method: 'GET'},
     { path: '/product-clothing-stock', method: 'GET'},
     { path: '/product-order-price', method: 'GET'},
     { path: '/product-distinct', method: 'GET'},
     { path: '/product-new', method: 'GET'},
     { path: '/all-orders', method: 'GET'},
     { path: '/order-id' , method: 'GET'},
     { path: '/order-shipped', method: 'GET'},
     { path: '/order-amount' , method: 'GET'},
     { path: '/order-march' , method: 'GET'},
     { path: '/orders-pending', method: 'GET'},
     { path: '/avg-amount-customer' , method: 'GET'},
     { path: '/orders-old-date' , method: 'GET'},
     { path: '/order-amount-100', method: 'GET'},
     { path: '/order-join-customer' , method: 'GET'},
     { path: '/all-order-items', method: 'GET'},
     { path: '/all-employees-details', method: 'GET'},
     { path: '/all-suppliers' , method: 'GET'},
     { path: '/all-payments' , method: 'GET'},
     { path: '/all-categories', method: 'GET'},
     { path: '/all-reviews' , method: 'GET'},
     { path: '/all-shipping', method: 'GET'}
  ];

  const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  // Make the request to the randomly selected endpoint
  makeRequest(BASE_URLS.MOVIE_MATRIX, randomEndpoint);
}

// function to simulate `randomIntBetween` if needed
function randomIntBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}