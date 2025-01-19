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
    idleTimeoutMillis: 300000
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

//     Insert a new customer and rental in a transaction
//     app.post('/add-customer-rental', async (req, res) => {
//       newrelic.setTransactionName('add-customer-and-rental');
//       let client;
//       try {
//         client = await pool.connect();
//         await client.query('BEGIN');
//         const { store_id, first_name, last_name, email, address, rental_info } = req.body;
//
//         const addressResult = await client.query(
//           `INSERT INTO address (address, address2, district, city_id, postal_code, phone)
//            VALUES ($1, $2, $3, $4, $5, $6)
//            RETURNING address_id`,
//           [address.address, address.address2, address.district, address.city_id, address.postal_code, address.phone]
//         );
//
//         const address_id = addressResult.rows[0].address_id;
//
//         const customerResult = await client.query(
//           `INSERT INTO customer (store_id, first_name, last_name, email, address_id, activebool, create_date)
//            VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
//            RETURNING customer_id`,
//           [store_id, first_name, last_name, email, address_id]
//         );
//
//         const customer_id = customerResult.rows[0].customer_id;
//
//         await client.query(
//           `INSERT INTO rental (rental_date, inventory_id, customer_id, return_date, staff_id)
//            VALUES (NOW(), $1, $2, $3, $4)`,
//           [rental_info.inventory_id, customer_id, rental_info.return_date, rental_info.staff_id]
//         );
//
//         await client.query('COMMIT');
//         res.status(201).json({ message: 'Customer and rental added successfully' });
//       } catch (err) {
//         await client.query('ROLLBACK');
//         console.error(err);
//         res.status(500).json({ error: 'Transaction failed' });
//       } finally {
//         if (client) client.release();
//       }
//     });

// Update film inventory across multiple stores
//app.put('/update-inventory/:film_id', async (req, res) => {
//  newrelic.setTransactionName('update-inventory-across-stores');
//  let client;
//  try {
//    client = await pool.connect();
//    await client.query('BEGIN');
//
//    const { film_id } = req.params;
//    const { store_update } = req.body;
//
//    for (const { store_id, new_inventory_count } of store_update) {
//      await client.query(
//        `UPDATE inventory
//         SET film_id = $1
//         WHERE store_id = $2
//         LIMIT $3`,
//        [film_id, store_id, new_inventory_count]
//      );
//    }
//
//    await client.query('COMMIT');
//    res.json({ status: 'ok', message: 'Inventory updated successfully across stores' });
//  } catch (err) {
//    if (client) {
//      await client.query('ROLLBACK');
//    }
//    newrelic.noticeError(err);
//    res.status(500).json({ error: `Database error: ${err.message}` });
//  } finally {
//    if (client) client.release();
//  }
//});

//Insert a payment record only if the customer has an active rental
//app.post('/add-payment', async (req, res) => {
//  newrelic.setTransactionName('add-payment-if-active-rental');
//  let client;
//  try {
//    client = await pool.connect();
//    await client.query('BEGIN');
//
//    const { customer_id, amount, staff_id } = req.body;
//
//    const activeRental = await client.query(
//      `SELECT EXISTS(
//         SELECT 1 FROM rental
//         WHERE customer_id = $1 AND return_date IS NULL
//       ) AS active_rental`,
//      [customer_id]
//    );
//
//    if (activeRental.rows[0].active_rental) {
//      const paymentResult = await client.query(
//        `INSERT INTO payment (customer_id, staff_id, rental_id, amount, payment_date)
//         SELECT $1, $2, r.rental_id, $3, NOW()
//         FROM rental r
//         WHERE r.customer_id = $1 AND r.return_date IS NULL
//         ORDER BY r.rental_date DESC LIMIT 1
//         RETURNING payment_id`,
//        [customer_id, staff_id, amount]
//      );
//
//      await client.query('COMMIT');
//      res.status(201).json({
//        status: 'ok',
//        message: 'Payment added successfully',
//        payment_id: paymentResult.rows[0].payment_id
//      });
//    } else {
//      await client.query('ROLLBACK');
//      res.status(400).json({ error: 'No active rental found for this customer' });
//    }
//  } catch (err) {
//    if (client) {
//      await client.query('ROLLBACK');
//    }
//    newrelic.noticeError(err);
//    res.status(500).json({ error: `Database error: ${err.message}` });
//  } finally {
//    if (client) client.release();
//  }
//});

//const port = process.env.PORT || 4000;
//app.listen(port, () => console.log(`Movie Matrix App is running on port ${port}`));
//}

const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`${new Date().toISOString()} - Movie Matrix App is running on port ${port}`));
}

startMovieMatrixApp().catch((err) => {
  console.error(new Date().toISOString(), 'Failed to start application:', err.message);
  process.exit(1);
});