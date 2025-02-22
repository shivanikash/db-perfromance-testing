const newrelic = require("newrelic");
console.log("New Relic agent status:", newrelic.agent.config.agent_enabled);
const express = require("express");
const { Pool } = require('pg');

// Basic logging middleware
const requestLogger = (serviceName) => (req, res, next) => {
  const startTime = Date.now();

  // Override res.json to capture the response
  const originalJson = res.json;

  res.json = function (data) {
    const duration = Date.now() - startTime;
    console.log(`${new Date().toISOString()} - ${serviceName} | ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Duration: ${duration}ms${data.error ? ` | Error: ${data.error}` : ''}`);
    return originalJson.apply(this, arguments);
  };
  next();
};

// Enhanced health check with console error logging
async function checkDatabaseConnection(pool) {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1'); // Simple query to verify connection
    client.release();
    return true;
  } catch (err) {
    console.error(new Date().toISOString(), 'Database connection check failed:', err.message);
    return false;
  }
}

async function startMovieMatrixApp() {
  const pool = new Pool({
    host: process.env.PSQL_HOST || 'localhost',
    user: process.env.PSQL_USER || 'postgres',
    password: process.env.PSQL_PASSWORD || '',
    database: process.env.PSQL_DATABASE || 'pagila',
    max: 20,
    idleTimeoutMillis: 120000
  });

  pool.on('connect', async (client) => {
    try {
      await client.query('SET search_path TO pagila, public');
    } catch (err) {
      client.release();
      throw err;
    }
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  const app = express();
  app.use(express.json());
  app.use(requestLogger('Movie-Matrix'));

  app.get('/health', async (req, res) => {
      const dbHealthy = await checkDatabaseConnection(pool);
      if (dbHealthy) {
        res.json({ status: 'ok' });
      } else {
        res.status(500).json({ error: 'Database connection failed' });
      }
    });

  // 1. Search by hire_date (missing index)
    app.get('/actors/top_by_film_count', async (req, res) => {
     newrelic.setTransactionName('fetch-top-actors-by-film-count');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows } = await client.query(`
          SELECT a.actor_id, a.first_name, a.last_name, COUNT(f.title) AS film_count
          FROM actor a
          JOIN film_actor fa ON a.actor_id = fa.actor_id
          JOIN film f ON fa.film_id = f.film_id
          GROUP BY a.actor_id, a.first_name, a.last_name
          ORDER BY film_count DESC
          LIMIT 5
        `);
        await client.query('COMMIT');
        res.json({ status: 'ok', data: rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error(`/actors/top_by_film_count | Error: ${err.message}`, err);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // 2. Search by name or department (inefficient OR + LIKE)
    app.get('/customers/top_spenders', async (req, res) => {
     newrelic.setTransactionName('fetch-top-spenders-customer');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows } = await client.query(`
          SELECT cu.customer_id, cu.first_name, cu.last_name, COUNT(r.rental_id) AS total_rentals, SUM(p.amount) AS total_amount_spent
          FROM customer cu
          JOIN rental r ON cu.customer_id = r.customer_id
          JOIN payment p ON r.rental_id = p.rental_id GROUP BY cu.customer_id, cu.first_name, cu.last_name
          HAVING COUNT(r.rental_id) > 30 ORDER BY total_rentals DESC, total_amount_spent DESC
        `);
        await client.query('COMMIT');
        res.json({ status: 'ok', data: rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        res.status(500).json({ error: err.message });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/store-rental-income', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT s.store_id, SUM(p.amount) AS total_income
          FROM payment p
          JOIN rental r ON p.rental_id = r.rental_id
          JOIN inventory i ON r.inventory_id = i.inventory_id
          JOIN store s ON i.store_id = s.store_id
          GROUP BY s.store_id
          ORDER BY total_income DESC
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-store-rental-income | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/all-customers', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Customers
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/customer-names', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT first_name, last_name FROM Customers
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-store-rental-income | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/customer-lname', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Customers WHERE last_name = 'Smith'
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-store-rental-income | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/customer-email', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT email FROM Customers WHERE registration_date >= '2023-01-01'
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-store-rental-income | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/customer-count', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT COUNT(*) FROM Customers
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
//        newrelic.noticeError(err);
        console.error('fetch-store-rental-income | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/customer-dis-name', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT DISTINCT last_name FROM Customers
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-store-rental-income | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/customers-order-date', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Customers ORDER BY registration_date DESC
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-store-rental-income | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/customers-limit-5', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Customers LIMIT 5
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/customers-null-phone', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT customer_id, first_name, last_name FROM Customers WHERE phone_number IS NULL
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/order-items', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT order_id, SUM(quantity) FROM OrderItems GROUP BY order_id
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/all-products', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Products
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/product-price', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT product_name, price FROM Products
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/product-price-50', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Products WHERE price < 50.00
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/avg-product-price', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT AVG(price) FROM Products
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/product-category', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Products WHERE category = 'Electronics'
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/product-stock-0', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT product_name FROM Products WHERE stock_quantity = 0;
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/product-clothing-stock', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT SUM(stock_quantity) FROM Products WHERE category = 'Clothing'
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/product-order-price', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Products ORDER BY price DESC
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/product-distinct', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT DISTINCT category FROM Products
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/product-new', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT product_id, product_name FROM Products WHERE description LIKE '%new%'
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/all-orders', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Orders
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-orders | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/order-id', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT order_id, order_date FROM Orders WHERE customer_id = 1
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/order-shipped', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Orders WHERE status = 'Shipped'
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/order-amount', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT MAX(total_amount) FROM Orders
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/order-march', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT order_id FROM Orders WHERE order_date BETWEEN '2023-03-01' AND '2023-03-31'
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/orders-pending', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT COUNT(*) FROM Orders WHERE status = 'Pending'
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/avg-amount-customer', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT customer_id, AVG(total_amount) FROM Orders GROUP BY customer_id
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/orders-old-date', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Orders ORDER BY order_date
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/order-amount-100', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT order_id, total_amount FROM Orders WHERE total_amount > 100.00
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get all order items
    app.get('/all-order-items', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result1 = await client.query(`
          SELECT * FROM OrderItems WHERE product_id = 5
        `);
        const result2 = await client.query(`
          SELECT AVG(price_per_unit) FROM OrderItems
        `);
        const result3 = await client.query(`
          SELECT oi.order_item_id, p.product_name, oi.quantity FROM OrderItems oi JOIN Products p ON oi.product_id = p.product_id
        `);
        const result4 = await client.query(`
          SELECT order_id FROM OrderItems WHERE quantity > 10
        `);
        const result5 = await client.query(`
          SELECT COUNT(DISTINCT order_id) FROM OrderItems
        `);
        const result6 = await client.query(`
          SELECT * FROM OrderItems ORDER BY price_per_unit * quantity DESC
        `);
        const result7 = await client.query(`
          SELECT product_id, SUM(quantity * price_per_unit) FROM OrderItems GROUP BY product_id
        `);
        const result8 = await client.query(`
          SELECT order_item_id, order_id FROM OrderItems WHERE price_per_unit < 10.00
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok',
        data: {
                orderItemsWithProductId5: result1.rows,
                averagePricePerUnit: result2.rows[0], // Assuming there's one row in the average query
                orderItemsWithProductNames: result3.rows,
                ordersWithQuantityGreaterThan10: result4.rows,
                distinctOrdersCount: result5.rows[0], // Return the count as a single object
                orderedItemsByValue: result6.rows,
                totalSalesByProduct: result7.rows,
                itemsWithPriceBelow10: result8.rows
        }});
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-order-items | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get all employees
    app.get('/all-employees-details', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result1 = await client.query(`
          SELECT * FROM Employees
        `);
        const result2 = await client.query(`
          SELECT first_name, last_name, job_title FROM Employees
        `);
        const result3 = await client.query(`
         SELECT * FROM Employees WHERE department = 'Sales'
        `);
        const result4 = await client.query(`
          SELECT AVG(salary) FROM Employees
        `);
        const result5 = await client.query(`
          SELECT employee_id, first_name, last_name FROM Employees WHERE salary > 60000.00
        `);
        const result6 = await client.query(`
          SELECT COUNT(*) FROM Employees WHERE job_title LIKE '%Engineer%'
        `);
        const result7 = await client.query(`
          SELECT * FROM Employees ORDER BY hire_date DESC
        `);
        const result8 = await client.query(`
          SELECT department, SUM(salary) FROM Employees GROUP BY department
        `);
        const result9 = await client.query(`
          SELECT first_name, last_name FROM Employees WHERE hire_date BETWEEN '2023-01-01' AND '2023-12-31'
        `);
        const result10 = await client.query(`
          SELECT e.first_name, e.last_name, e.job_title, d.department AS department_name FROM Employees e LEFT JOIN (SELECT DISTINCT department FROM Employees) d ON e.department = d.department
        `);
        await client.query('COMMIT');
        res.json({ status: 'ok',
        data: {
            allEmployees: result1.rows,
            employeeNamesAndTitles: result2.rows,
            salesDepartmentEmployees: result3.rows,
            averageSalary: result4.rows[0], // Assuming one row returned for average
            highSalaryEmployees: result5.rows,
            engineerCount: result6.rows[0], // Assuming there's one row with the count
            recentHires: result7.rows,
            departmentSalaries: result8.rows,
            hiresIn2023: result9.rows,
            joinedDepartmentData: result10.rows
        }});
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-employees | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get all suppliers
    app.get('/all-suppliers', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result1 = await client.query(`
          SELECT * FROM Suppliers
        `);
        const result2 = await client.query(`
          SELECT supplier_name, contact_email FROM Suppliers
        `);
        const result3 = await client.query(`
         SELECT * FROM Suppliers WHERE supplier_name LIKE 'A%'
        `);
        const result4 = await client.query(`
          SELECT contact_name FROM Suppliers WHERE contact_email IS NULL
        `);
        const result5 = await client.query(`
          SELECT COUNT(*) FROM Suppliers
        `);
        const result6 = await client.query(`
          SELECT * FROM Suppliers ORDER BY supplier_name DESC
        `);
        const result7 = await client.query(`
          SELECT supplier_id, contact_name FROM Suppliers WHERE contact_phone LIKE '%555%'
        `);
        const result8 = await client.query(`
          SELECT supplier_name FROM Suppliers WHERE contact_name = 'Wile E. Coyote'
        `);
        const result9 = await client.query(`
          SELECT supplier_id, supplier_name FROM Suppliers WHERE contact_email LIKE '%@initech.com'
        `);
        const result10 = await client.query(`
          SELECT supplier_name, contact_phone FROM Suppliers LIMIT 3
        `);
        await client.query('COMMIT');
        res.json({ status: 'ok',
        data: {
            allSuppliers: result1.rows,
            supplierNamesAndEmails: result2.rows,
            suppliersStartingWithA: result3.rows,
            contactsWithoutEmail: result4.rows,
            totalSupplierCount: result5.rows[0], // Assuming one row returned for count
            suppliersOrderedByNameDesc: result6.rows,
            suppliersWithSpecificPhone: result7.rows,
            specificContactSuppliers: result8.rows,
            suppliersWithInitechEmail: result9.rows,
            firstThreeSuppliers: result10.rows
        }});
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-suppliers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get all payments
    app.get('/all-payments', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result1 = await client.query(`
          SELECT * FROM Payments
        `);
        const result2 = await client.query(`
          SELECT payment_id, payment_date FROM Payments WHERE order_id = 3
        `);
        const result3 = await client.query(`
         SELECT * FROM Payments WHERE payment_method = 'Credit Card'
        `);
        const result4 = await client.query(`
          SELECT AVG(amount) FROM Payments
        `);
        const result5 = await client.query(`
          SELECT order_id, SUM(amount) FROM Payments GROUP BY order_id
        `);
        const result6 = await client.query(`
          SELECT * FROM Payments WHERE payment_date BETWEEN '2023-04-01' AND '2023-04-30'
        `);
        const result7 = await client.query(`
          SELECT payment_method, COUNT(*) FROM Payments GROUP BY payment_method
        `);
        const result8 = await client.query(`
          SELECT * FROM Payments ORDER BY amount DESC
        `);
        const result9 = await client.query(`
          SELECT payment_id, amount FROM Payments WHERE amount > 100.00
        `);
        const result10 = await client.query(`
          SELECT p.payment_id, o.order_date, p.amount FROM Payments p JOIN Orders o ON p.order_id = o.order_id
        `);
        await client.query('COMMIT');
        res.json({ status: 'ok',
        data: {
            allPayments: result1.rows,
            paymentsForOrder3: result2.rows,
            creditCardPayments: result3.rows,
            averagePaymentAmount: result4.rows[0], // Assuming one row returned for average
            totalAmountByOrder: result5.rows,
            paymentsInApril: result6.rows,
            paymentMethodCounts: result7.rows,
            paymentsOrderedByAmountDesc: result8.rows,
            largePayments: result9.rows,
            paymentsWithOrderDates: result10.rows
        }});
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-payments | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get all categories
    app.get('/all-categories', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result1 = await client.query(`
          SELECT * FROM Categories
        `);
        const result2 = await client.query(`
          SELECT category_name FROM Categories
        `);
        const result3 = await client.query(`
          SELECT * FROM Categories WHERE category_name LIKE '%s'
        `);
        const result4 = await client.query(`
          SELECT description FROM Categories WHERE category_id = 2
        `);
        const result5 = await client.query(`
          SELECT COUNT(*) FROM Categories
        `);
        const result6 = await client.query(`
          SELECT * FROM Categories ORDER BY category_name
        `);
        const result7 = await client.query(`
          SELECT category_id, category_name FROM Categories WHERE description LIKE '%and%'
        `);
        const result8 = await client.query(`
          SELECT category_name FROM Categories WHERE category_id IN (1, 3, 5)
        `);
        const result9 = await client.query(`
          SELECT category_id, category_name FROM Categories LIMIT 3
        `);
        const result10 = await client.query(`
          SELECT c.category_name, p.product_name FROM Categories c LEFT JOIN Products p ON c.category_name = p.category
        `);
        await client.query('COMMIT');
        res.json({ status: 'ok',
        data: {
            allCategories: result1.rows,
            categoryNames: result2.rows,
            categoriesWithNameEndingS: result3.rows,
            descriptionForCategory2: result4.rows,
            totalCategories: result5.rows[0], // Assuming one row returned for count
            categoriesOrderedByName: result6.rows,
            categoriesWithDescriptionAnd: result7.rows,
            specificCategoryNames: result8.rows,
            firstThreeCategories: result9.rows,
            categoryProductJoin: result10.rows
        }});
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-categories | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get all reviews
    app.get('/all-reviews', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result1 = await client.query(`
          SELECT * FROM Reviews
        `);
        const result2 = await client.query(`
          SELECT rating, review_text FROM Reviews WHERE product_id = 1
        `);
        const result3 = await client.query(`
         SELECT AVG(rating) FROM Reviews WHERE product_id = 1
        `);
        const result4 = await client.query(`
          SELECT * FROM Reviews WHERE customer_id = 1
        `);
        const result5 = await client.query(`
          SELECT COUNT(*) FROM Reviews WHERE rating = 5
        `);
        const result6 = await client.query(`
          SELECT r.review_id, p.product_name, c.first_name, c.last_name, r.rating FROM Reviews r JOIN Products p ON r.product_id = p.product_id JOIN Customers c ON r.customer_id = c.customer_id
        `);
        const result7 = await client.query(`
          SELECT * FROM Reviews WHERE review_date >= '2023-04-01'
        `);
        const result8 = await client.query(`
          SELECT review_text FROM Reviews WHERE rating < 3
        `);
        const result9 = await client.query(`
          SELECT product_id, AVG(rating) as avg_rating FROM Reviews GROUP BY product_id ORDER BY avg_rating DESC
        `);
        const result10 = await client.query(`
           SELECT review_id, review_text FROM Reviews WHERE review_text LIKE '%great%'
        `);
        await client.query('COMMIT');
        res.json({ status: 'ok',
        data: {
            allReviews: result1.rows,
            specificProductReviews: result2.rows,
            averageProductRating: result3.rows[0],  // Assuming one row returned for average
            customerReviews: result4.rows,
            fiveStarReviewCount: result5.rows[0],  // Assuming there's one row with the count
            reviewDetailsWithNames: result6.rows,
            recentReviews: result7.rows,
            lowRatingReviews: result8.rows,
            productRatings: result9.rows,
            reviewsContainingGreat: result10.rows
        }});
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-reviews | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get all shipping
    app.get('/all-shipping', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result1 = await client.query(`
          SELECT * FROM Shipping
        `);
        const result2 = await client.query(`
          SELECT order_id, shipping_date, carrier FROM Shipping
        `);
        const result3 = await client.query(`
           SELECT * FROM Shipping WHERE carrier = 'FedEx'
        `);
        const result4 = await client.query(`
          SELECT AVG(delivery_date - shipping_date) FROM Shipping
        `);
        const result5 = await client.query(`
          SELECT order_id FROM Shipping WHERE shipping_date BETWEEN '2023-03-01' AND '2023-03-31'
        `);
        const result6 = await client.query(`
           SELECT COUNT(*) FROM Shipping WHERE delivery_date IS NULL
        `);
        const result7 = await client.query(`
          SELECT s.shipping_id, o.order_date, s.shipping_date, s.delivery_date FROM Shipping s JOIN Orders o ON s.order_id = o.order_id
        `);
        const result8 = await client.query(`
          SELECT * FROM Shipping ORDER BY shipping_date DESC
        `);
        const result9 = await client.query(`
          SELECT shipping_address FROM Shipping WHERE order_id = 3
        `);
        const result10 = await client.query(`
           SELECT carrier, COUNT(*) FROM Shipping GROUP BY carrier
        `);
        await client.query('COMMIT');
        res.json({ status: 'ok',
        data: {
            allShipping: result1.rows,
            shippingOverview: result2.rows,
            fedExShipments: result3.rows,
            averageDeliveryTime: result4.rows[0], // Assuming one row returned for average
            marchShipments: result5.rows,
            undeliveredCount: result6.rows[0], // Assuming there's one row with the count
            shippingWithOrderData: result7.rows,
            orderedRecentShipments: result8.rows,
            orderId3Address: result9.rows,
            carrierCounts: result10.rows
        }});
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-shipping | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

const port = process.env.PORT || 5000;
  app.listen(port, '0.0.0.0', () => console.log(`${new Date().toISOString()} - Movie Matrix App is running on port ${port}`));
}

startMovieMatrixApp().catch((err) => {
  console.error(new Date().toISOString(), 'Failed to start application:', err.message);
  process.exit(1);
});