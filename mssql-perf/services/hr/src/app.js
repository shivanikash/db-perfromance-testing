// import newrelic from 'newrelic';
import express from 'express';
import sql from 'mssql';
import DatabaseConnection from './db-connection.js';
// console.log('New Relic agent status:', newrelic.agent.config.agent_enabled);


const dbConfig = {
    user: '',
    password: '',
    server: ``,
    database: `AdventureWorks2022`,
    port: 1433,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        requestTimeout: 1200000
    },
    pool: {
        max: parseInt(10000),
        min: parseInt(100),
        idleTimeoutMillis: parseInt(120000)
    }
};

const app = express();
app.use(express.json());

const db = new DatabaseConnection(dbConfig);
db.connect().catch(err => {
    console.error('Failed to initialize database connection:', err);
    process.exit(1);
});

// Health check endpoint
app.get('/health', async (req, res) => {
    if (!db.isReady()) {
        console.log("DB is unhealthy...!")
        return res.status(503).json({ 
            status: 'unavailable', 
            dbConnected: false 
        });
    }
    try {
        await db.getPool().request().query('SELECT 1');
        console.log("DB is healthy...!")
        res.json({ 
            status: 'ok', 
            dbConnected: true,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(503).json({ 
            status: 'unavailable', 
            dbConnected: false 
        });
    }
});

// Employee search endpoint
app.get('/hr/employees/search', async (req, res) => {
    if (!db.isReady()) {
        return res.status(503).json({ error: 'Database not ready' });
    }
   
    // newrelic.setTransactionName('hr-employees-search');

    const { name, department, page = 1, pageSize = 20 } = req.query;
    
    try {
        const pool = db.getPool();
        const request = pool.request();
        
        let query = `
            SELECT 
                e.BusinessEntityID,
                p.FirstName,
                p.LastName,
                e.JobTitle,
                d.Name AS Department,
                COUNT(*) OVER() as TotalCount
            FROM HumanResources.Employee e
            JOIN Person.Person p ON e.BusinessEntityID = p.BusinessEntityID
            LEFT JOIN HumanResources.EmployeeDepartmentHistory edh 
                ON e.BusinessEntityID = edh.BusinessEntityID 
                AND edh.EndDate IS NULL
            LEFT JOIN HumanResources.Department d 
                ON edh.DepartmentID = d.DepartmentID
            WHERE 1=1
        `;

        if (name) {
            request.input('name', sql.NVarChar, `%${name}%`);
            query += ` AND (p.FirstName LIKE @name OR p.LastName LIKE @name)`;
        }

        if (department) {
            request.input('department', sql.NVarChar, `%${department}%`);
            query += ` AND d.Name LIKE @department`;
        }

        query += `
            ORDER BY p.LastName, p.FirstName
            OFFSET @offset ROWS
            FETCH NEXT @pageSize ROWS ONLY
        `;

        request.input('offset', sql.Int, (page - 1) * pageSize);
        request.input('pageSize', sql.Int, pageSize);

        const result = await request.query(query);

        const totalCount = result.recordset[0]?.TotalCount || 0;
        const totalPages = Math.ceil(totalCount / pageSize);

        res.json({
            employees: result.recordset,
            pagination: {
                currentPage: page,
                pageSize,
                totalPages,
                totalCount
            }
        });
    } catch (err) {
        // newrelic.noticeError(err);
        console.error('Database query error:', err);
        res.status(500).json({
            error: 'Database operation failed',
            message: err.message
        });
    }
});


app.get('/hr/total-quantity-ordered', async (req, res) => {
    try {
        const result = await db.getPool().request().query(`
      SELECT 
          p.ProductID, 
          p.Name, 
          SUM(sod.OrderQty) AS TotalQuantityOrdered
      FROM 
          Production.Product p
      JOIN 
          Sales.SalesOrderDetail sod ON p.ProductID = sod.ProductID
      GROUP BY 
          p.ProductID, p.Name
      ORDER BY 
          TotalQuantityOrdered DESC;
    `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: 'Database operation failed', message: err.message });
    }
});


app.get('/hr/average-price', async (req, res) => {
    try {
        const result = await db.getPool().request().query(`
      SELECT 
          p.ProductID, 
          p.Name, 
          (SELECT AVG(UnitPrice) 
           FROM Sales.SalesOrderDetail 
           WHERE ProductID = p.ProductID) AS AveragePrice
      FROM 
          Production.Product p
      WHERE 
          p.ListPrice > (SELECT AVG(ListPrice) FROM Production.Product);
    `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: 'Database operation failed', message: err.message });
    }
});

// Cross Join Producing a Large Result Set
app.get('/hr/product-category-cross', async (req, res) => {
    try {
        const result = await db.getPool().request().query(`
      SELECT 
          p.Name AS ProductName, 
          c.Name AS CategoryName
      FROM 
          Production.Product p
      CROSS JOIN 
          Production.ProductCategory c;
    `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: 'Database operation failed', message: err.message });
    }
});

// Query with Multiple Conditions and Table Scans
app.get('/hr/orders-large', async (req, res) => {
    try {
        const result = await db.getPool().request().query(`
      SELECT 
          c.CustomerID, 
          sod.SalesOrderID, 
          sod.LineTotal
      FROM 
          Sales.Customer c
      JOIN 
          Sales.SalesOrderHeader soh ON c.CustomerID = soh.CustomerID
      JOIN 
          Sales.SalesOrderDetail sod ON soh.SalesOrderID = sod.SalesOrderID
      WHERE 
          sod.OrderQty > 5 
          AND soh.SubTotal > 1000
          AND c.TerritoryID IN (2, 5, 6);
    `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: 'Database operation failed', message: err.message });
    }
});

// Sales Order Headers Overview
app.get('/hr/sales-orders', async (req, res) => {
    try {
        const result = await db.getPool().request().query(`
      SELECT soh.SalesOrderID FROM Sales.SalesOrderHeader soh;
    `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: 'Database operation failed', message: err.message });
    }
});

// Update with a Join
app.put('/hr/update-product-price', async (req, res) => {
    try {
        await db.getPool().request().query(`
      UPDATE p
      SET p.ListPrice = p.ListPrice * 0.9  -- Applying a 10% discount
      FROM Production.Product p
      INNER JOIN Production.ProductSubcategory ps ON p.ProductSubcategoryID = ps.ProductSubcategoryID
      INNER JOIN Production.ProductCategory pc ON ps.ProductCategoryID = pc.ProductCategoryID
      WHERE pc.Name = 'Bikes';
    `);
        res.send('Product prices updated successfully.');
    } catch (err) {
        res.status(500).json({ error: 'Database operation failed', message: err.message });
    }
});

// Insert new department
app.post('/hr/insert-department', async (req, res) => {
    try {
        await db.getPool().request().query(`
            INSERT INTO HumanResources.Department (Name, GroupName, ModifiedDate)
            VALUES ('New Department', 'Research and Development', GETDATE())
        `);
        res.status(201).send('New Department added successfully.');
    } catch (err) {
        res.status(500).json({ error: 'Database operation failed', message: err.message });
    }
});

// Insert new product
app.post('/hr/insert-product', async (req, res) => {
    try {
        await db.getPool().request().query(`
            INSERT INTO Production.Product (Name, ProductNumber, MakeFlag, FinishedGoodsFlag, Color, SafetyStockLevel, ReorderPoint, StandardCost, ListPrice, DaysToManufacture, SellStartDate)
            VALUES ('New Product', 'NP-001', 1, 1, 'Blue', 100, 50, 20.0, 50.0, 5, GETDATE())
        `);
        res.status(201).send('New Product added successfully.');
    } catch (err) {
        res.status(500).json({ error: 'Database operation failed', message: err.message });
    }
});



const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});