const newrelic = require('newrelic');
const express = require("express");
const sql = require("mssql"); // Use 'mssql' package

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
        const request = pool.request();
        await request.query('SELECT 1'); // Simple query to verify connection
        return true;
    } catch (err) {
        console.error(new Date().toISOString(), 'Database connection check failed:', err.message);
        return false;
    }
}

async function startHrPortalApp() {
    const pool = new sql.ConnectionPool({
        server: 'asdf',
        user: '',
        password: 'sdfsa',
        database: 'AdventureWorks2022',
        pool: {
            max: 100, // Adjust based on your needs and server capacity
            min: 0,
            idleTimeoutMillis: 120000,
            acquireTimeoutMillis: 120000
        },
        options: {
            encrypt: true, // Use this if you're on Windows Azure
            trustServerCertificate: true, // Change to true for local dev / self-signed certs
            connectionTimeout: 120000,
            requestTimeout: 300000
        }
    });

    await pool.connect();

    pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
        process.exit(-1);
    });

    const app = express();
    app.use(express.json());
    app.use(requestLogger('hr-portal'));

    app.get('/health', async (req, res) => {
        const dbHealthy = await checkDatabaseConnection(pool);
        if (dbHealthy) {
            res.json({ status: 'ok' });
        } else {
            res.status(500).json({ error: 'Database connection failed' });
        }
    });

    app.get('/combined', async (req, res) => {
        try {
            const request = pool.request();

            // Define all your queries
            const queries = [
                `SELECT TOP 10 ProductCategoryID, Name FROM Production.ProductCategory ORDER BY ProductCategoryID`,
                `SELECT TOP 10 ProductCategoryID, Name FROM Production.ProductCategory ORDER BY ProductCategoryID`,
                `SELECT TOP 10 BusinessEntityID, FirstName, LastName FROM Person.Person ORDER BY BusinessEntityID`,
                `SELECT TOP 10 SalesOrderID, OrderDate, TotalDue FROM Sales.SalesOrderHeader ORDER BY OrderDate DESC`,
                `SELECT TOP 10 ProductID, Name, ProductNumber FROM Production.Product WHERE ProductSubcategoryID = 5 ORDER BY ProductID`,
            ];

            // Execute all queries and collect results
            const results = await Promise.all(queries.map(query => request.query(query)));

            // Send all results back as a combined response
            res.json({ status: 'ok', data: results });
        } catch (err) {
            console.error(new Date().toISOString(), 'Query execution failed:', err.message);
            res.status(500).json({ error: `Database error: ${err.message}` });
        }
    });


    app.get('/combined1', async (req, res) => {
        try {
            const request = pool.request();

            const queries = [
                `SELECT TOP 10 SalesOrderID, OrderDate, TotalDue FROM Sales.SalesOrderHeader ORDER BY TotalDue DESC;`,
                `SELECT TOP 10 ProductID, Name, ListPrice FROM Production.Product ORDER BY ListPrice DESC;`,
                `SELECT TOP 10 e.BusinessEntityID, p.FirstName, p.LastName, e.HireDate FROM HumanResources.Employee e JOIN Person.Person p ON e.BusinessEntityID = p.BusinessEntityID ORDER BY e.HireDate DESC;`,
                `SELECT TOP 10 c.CustomerID, COUNT(soh.SalesOrderID) AS OrderCount FROM Sales.Customer c JOIN Sales.SalesOrderHeader soh ON c.CustomerID = soh.CustomerID GROUP BY c.CustomerID ORDER BY OrderCount DESC;`,
                `SELECT TOP 10 Name, CreditRating FROM Purchasing.Vendor ORDER BY CreditRating DESC, Name;`,
            ];

            const results = await Promise.all(queries.map(query => request.query(query)));
            res.json({ status: 'ok', data: results });
        } catch (err) {
            console.error(new Date().toISOString(), 'Query execution failed:', err.message);
            res.status(500).json({ error: `Database error: ${err.message}` });
        }
    });

    app.get('/combined2', async (req, res) => {
        try {
            const request = pool.request();

            const queries = [
                `SELECT TOP 10 ProductCategoryID, Name, ModifiedDate FROM Production.ProductCategory ORDER BY ModifiedDate DESC;`,
                `SELECT TOP 10 p.FirstName, p.LastName, d.Name AS DepartmentName, e.JobTitle FROM HumanResources.Employee e JOIN Person.Person p ON e.BusinessEntityID = p.BusinessEntityID JOIN HumanResources.EmployeeDepartmentHistory edh ON e.BusinessEntityID = edh.BusinessEntityID JOIN HumanResources.Department d ON edh.DepartmentID = d.DepartmentID ORDER BY d.Name, e.JobTitle;`,
                `SELECT TOP 10 a.AddressID, a.AddressLine1, COUNT(soh.SalesOrderID) AS OrdersShipped FROM Person.Address a JOIN Sales.SalesOrderHeader soh ON a.AddressID = soh.ShipToAddressID GROUP BY a.AddressID, a.AddressLine1 ORDER BY OrdersShipped DESC;`,
                `SELECT TOP 10 TerritoryID, SUM(TotalDue) AS SalesTotal FROM Sales.SalesOrderHeader GROUP BY TerritoryID ORDER BY SalesTotal DESC;`,
                `SELECT TOP 10 p.ProductID, p.Name, SUM(sod.OrderQty) AS TotalSold FROM Production.Product p JOIN Sales.SalesOrderDetail sod ON p.ProductID = sod.ProductID GROUP BY p.ProductID, p.Name ORDER BY TotalSold DESC;`
            ];

            const results = await Promise.all(queries.map(query => request.query(query)));
            res.json({ status: 'ok', data: results });
        } catch (err) {
            console.error(new Date().toISOString(), 'Query execution failed:', err.message);
            res.status(500).json({ error: `Database error: ${err.message}` });
        }
    });

    app.get('/combined3', async (req, res) => {
        try {
            const request = pool.request();

            // Define all your queries
            const queries = [
                `SELECT TOP 10 SalesOrderID, OrderDate, Status FROM Sales.SalesOrderHeader WHERE Status = 1 ORDER BY SalesOrderID`,
                `SELECT TOP 10 AddressID, AddressLine1, City, StateProvinceID FROM Person.Address WHERE StateProvinceID = 32 ORDER BY AddressID`,
                `SELECT TOP 10 Name, CreditRating FROM Purchasing.Vendor WHERE CreditRating = 2 ORDER BY Name`,
                `SELECT TOP 10 SalesOrderID, OrderDate, SubTotal FROM Sales.SalesOrderHeader WHERE TerritoryID = 5 ORDER BY SalesOrderID`,
                `SELECT TOP 10 CustomerID, PersonID, TerritoryID FROM Sales.Customer WHERE StoreID = 453 ORDER BY CustomerID`,
                `SELECT TOP 10 e.BusinessEntityID, p.FirstName, p.LastName, e.HireDate FROM HumanResources.Employee e JOIN Person.Person p ON e.BusinessEntityID = p.BusinessEntityID ORDER BY e.HireDate DESC`
            ];

            // Execute all queries and collect results
            const results = await Promise.all(queries.map(query => request.query(query)));

            // Send all results back as a combined response
            res.json({ status: 'ok', data: results });
        } catch (err) {
            console.error(new Date().toISOString(), 'Query execution failed:', err.message);
            res.status(500).json({ error: `Database error: ${err.message}` });
        }
    });

    app.get('/combined4', async (req, res) => {
        try {
            const request = pool.request();

            const queries = [
                `SELECT TOP 10 BusinessEntityID, NationalIDNumber, BirthDate FROM HumanResources.Employee ORDER BY BirthDate DESC`,
                `SELECT TOP 10 ProductID, Name, StandardCost FROM Production.Product WHERE SafetyStockLevel < 500 ORDER BY StandardCost DESC`,
                `SELECT TOP 10 Name, ProductLine, Class, Style FROM Production.Product WHERE Class IS NOT NULL ORDER BY Name`,
                `SELECT TOP 10 SpecialOfferID, Description, DiscountPct FROM Sales.SpecialOffer ORDER BY DiscountPct DESC`,
                `SELECT TOP 10 CustomerID, TerritoryID, AccountNumber FROM Sales.Customer WHERE TerritoryID IS NOT NULL ORDER BY AccountNumber`
            ];

            const results = await Promise.all(queries.map(query => request.query(query)));

            res.json({ status: 'ok', data: results });
        } catch (err) {
            console.error(new Date().toISOString(), 'Query execution failed:', err.message);
            res.status(500).json({ error: `Database error: ${err.message}` });
        }
    });

    app.get('/combined5', async (req, res) => {
        try {
            const request = pool.request();

            const queries = [
                `SELECT TOP 10 SalesOrderID, DueDate, ShipDate FROM Sales.SalesOrderHeader WHERE ShipDate IS NOT NULL ORDER BY DueDate`,
                `SELECT TOP 10 TerritoryID, Name, CountryRegionCode FROM Sales.SalesTerritory ORDER BY TerritoryID`,
                `SELECT TOP 10 ProductModelID, Name FROM Production.ProductModel ORDER BY Name`
            ];

            const results = await Promise.all(queries.map(query => request.query(query)));

            res.json({ status: 'ok', data: results });
        } catch (err) {
            console.error(new Date().toISOString(), 'Query execution failed:', err.message);
            res.status(500).json({ error: `Database error: ${err.message}` });
        }
    });

    app.get('/combined6', async (req, res) => {
        try {
            const request = pool.request();

            const queries = [
                `SELECT TOP 10 ContactTypeID FROM Person.ContactType ORDER BY ContactTypeID`,
                `SELECT TOP 10 BusinessEntityID, JobTitle, HireDate FROM HumanResources.Employee WHERE JobTitle LIKE '%Manager%' ORDER BY HireDate DESC`,
                `SELECT TOP 10 CountryRegionCode, ModifiedDate FROM Person.CountryRegion ORDER BY ModifiedDate DESC`,
                `SELECT TOP 10 StateProvinceID, StateProvinceCode, CountryRegionCode FROM Person.StateProvince WHERE CountryRegionCode = 'US' ORDER BY StateProvinceID`,
                `SELECT TOP 10 ProductSubcategoryID, ProductCategoryID FROM Production.ProductSubcategory WHERE ProductCategoryID = 1 ORDER BY ProductSubcategoryID`
            ];

            const results = await Promise.all(queries.map(query => request.query(query)));

            res.json({ status: 'ok', data: results });
        } catch (err) {
            console.error(new Date().toISOString(), 'Query execution failed:', err.message);
            res.status(500).json({ error: `Database error: ${err.message}` });
        }
    });

    app.get('/combined7', async (req, res) => {
        try {
            const request = pool.request();

            const queries = [
                `SELECT TOP 10 CurrencyCode, ModifiedDate FROM Sales.Currency ORDER BY CurrencyCode`,
                `SELECT TOP 10 ShiftID, StartTime, EndTime FROM HumanResources.Shift ORDER BY StartTime`,
                `SELECT TOP 10 BusinessEntityID, NationalIDNumber, BirthDate FROM HumanResources.Employee ORDER BY BirthDate DESC`,
                `SELECT ProductID FROM Production.Product WHERE ListPrice > 100 ORDER BY Name`,
                `SELECT AddressID, AddressLine1, City FROM Person.Address WHERE StateProvinceID = 1 ORDER BY AddressID`,
            ];

            const results = await Promise.all(queries.map(query => request.query(query)));

            res.json({ status: 'ok', data: results });
        } catch (err) {
            console.error(new Date().toISOString(), 'Query execution failed:', err.message);
            res.status(500).json({ error: `Database error: ${err.message}` });
        }
    });


    app.get('/combined8', async (req, res) => {
        try {
            const request = pool.request();

            const queries = [
                `SELECT TOP 10 CurrencyCode, Name FROM Sales.Currency ORDER BY Name`,
                `SELECT ShiftID, Name, StartTime FROM HumanResources.Shift ORDER BY StartTime`,
                `SELECT SalesOrderID, OrderDate FROM Sales.SalesOrderHeader WHERE OrderDate >= '2022-01-01' ORDER BY SalesOrderID`,
                `SELECT ProductModelID, Name FROM Production.ProductModel ORDER BY ProductModelID`,
                `SELECT TOP 10 CountryRegionCode, Name FROM Person.CountryRegion ORDER BY CountryRegionCode`,
                `SELECT ContactTypeID, Name FROM Person.ContactType ORDER BY ContactTypeID`,
            ];

            const results = await Promise.all(queries.map(async query => {
                const command = query.trim().split(' ')[0].toUpperCase();
                return command === 'SELECT' ? request.query(query) : request.execute(query);
            }));

            res.json({ status: 'ok', data: results });
        } catch (err) {
            console.error(new Date().toISOString(), 'Query execution failed:', err.message);
            res.status(500).json({ error: `Database error: ${err.message}` });
        }
    });

    app.get('/combined9', async (req, res) => {
        try {
            const request = pool.request();

            const queries = [
                `SELECT TOP 10 BusinessEntityID, LoginID FROM HumanResources.Employee ORDER BY LoginID`,
                `SELECT CustomerID, AccountNumber FROM Sales.Customer WHERE StoreID IS NULL ORDER BY CustomerID`,
                `SELECT TOP 10 ProductID, Name FROM Production.Product WHERE MakeFlag = 1 ORDER BY Name`,
                `SELECT TOP 10 Name, ListPrice FROM Production.Product ORDER BY ListPrice DESC`,
                `SELECT DISTINCT HireDate FROM HumanResources.Employee ORDER BY HireDate DESC`,
                `SELECT TOP 10 Name, ListPrice FROM Production.Product WHERE DaysToManufacture = 0 ORDER BY ListPrice`,
            ];

            const results = await Promise.all(queries.map(async query => {
                const command = query.trim().split(' ')[0].toUpperCase();
                return command === 'SELECT' ? request.query(query) : request.execute(query);
            }));

            res.json({ status: 'ok', data: results });
        } catch (err) {
            console.error(new Date().toISOString(), 'Query execution failed:', err.message);
            res.status(500).json({ error: `Database error: ${err.message}` });
        }
    });

// `/combined13`
    app.get('/combined10', async (req, res) => {
        try {
            const request = pool.request();

            const queries = [
                `SELECT CustomerID, AccountNumber FROM Sales.Customer WHERE AccountNumber LIKE 'AW%' ORDER BY CustomerID`,
                `SELECT TOP 10 Name, ModifiedDate FROM Production.ProductCategory ORDER BY ModifiedDate DESC`,
                `SELECT TOP 10 ProductModelID, Name FROM Production.ProductModel ORDER BY ProductModelID`,
                `SELECT AddressLine1, City FROM Person.Address WHERE StateProvinceID = 1 ORDER BY City`,
                `SELECT BusinessEntityID, EmailAddress FROM Person.EmailAddress ORDER BY BusinessEntityID`,
                `SELECT Name FROM Purchasing.Vendor WHERE CreditRating = 1 ORDER BY Name`,
            ];

            const results = await Promise.all(queries.map(async query => {
                const command = query.trim().split(' ')[0].toUpperCase();
                if (command === 'SELECT') {
                    return request.query(query);
                } else {
                    throw new Error("Non-SELECT operations are not allowed");
                }
            }));

            res.json({ status: 'ok', data: results.map(r => r.recordset) });
        } catch (err) {
            console.error(new Date().toISOString(), 'Query execution failed:', err.message);
            res.status(500).json({ error: `Database error: ${err.message}` });
        }
    });

    app.get('/combined11', async (req, res) => {
        try {
            const request = pool.request();

            const queries = [
                `SELECT ProductID, Color FROM Production.Product WHERE Color IS NOT NULL ORDER BY ProductID`,
                `SELECT AddressID, AddressLine1 FROM Person.Address WHERE PostalCode LIKE '98%' ORDER BY AddressID`,
                `SELECT PhoneNumber FROM Person.PersonPhone ORDER BY PhoneNumber`,
                `SELECT ProductNumber FROM Production.Product WHERE SellStartDate > '2022-01-01' ORDER BY ProductNumber`,
                `SELECT BusinessEntityID, FirstName, LastName FROM Person.Person WHERE EmailPromotion = 1 ORDER BY BusinessEntityID`,
                `SELECT TransactionID, Quantity FROM Production.TransactionHistory WHERE Quantity > 100 ORDER BY TransactionID DESC`,
            ];

            const results = await Promise.all(queries.map(query => request.query(query)));

            res.json({ status: 'ok', data: results.map(r => r.recordset) });
        } catch (err) {
            console.error(new Date().toISOString(), 'Query execution failed:', err.message);
            res.status(500).json({ error: `Database error: ${err.message}` });
        }
    });


    app.get('/combined12', async (req, res) => {
        try {
            const request = pool.request();

            const queries = [
                `SELECT ProductModelID FROM Production.ProductModel WHERE Instructions IS NOT NULL ORDER BY ProductModelID`,
                `SELECT CreditCardID, CardType FROM Sales.CreditCard WHERE ExpYear > 2023 ORDER BY ExpYear`,
                `SELECT SalesYTD FROM Sales.SalesPerson WHERE SalesYTD > 1000000 ORDER BY SalesYTD DESC`,
                `SELECT ProductID, Color FROM Production.Product WHERE Color IS NOT NULL ORDER BY ProductID`,
                `SELECT AddressID, AddressLine1 FROM Person.Address WHERE PostalCode LIKE '98%' ORDER BY AddressID`,
                `SELECT PhoneNumber FROM Person.PersonPhone ORDER BY PhoneNumber`,
            ];

            const results = await Promise.all(queries.map(query => request.query(query)));

            res.json({ status: 'ok', data: results.map(r => r.recordset) });
        } catch (err) {
            console.error(new Date().toISOString(), 'Query execution failed:', err.message);
            res.status(500).json({ error: `Database error: ${err.message}` });
        }
    });

    app.get('/combined13', async (req, res) => {
        try {
            const request = pool.request();

            const queries = [
                `SELECT TOP 10 TerritoryID, Name, CountryRegionCode FROM Sales.SalesTerritory ORDER BY SalesYTD DESC`,
                `SELECT ProductID, Name FROM Production.Product WHERE SafetyStockLevel < 500 ORDER BY Name`,
                `SELECT Name, CreditRating FROM Purchasing.Vendor WHERE CreditRating > 3 ORDER BY Name`,
                `SELECT SalesOrderID, OrderDate, TotalDue FROM Sales.SalesOrderHeader WHERE TotalDue > 1000 ORDER BY OrderDate DESC`,
                `SELECT JobTitle, HireDate FROM HumanResources.Employee WHERE JobTitle LIKE '%Manager%' ORDER BY HireDate`
            ];

            const results = await Promise.all(queries.map(query => request.query(query)));

            res.json({ status: 'ok', data: results.map(r => r.recordset) });
        } catch (err) {
            console.error(new Date().toISOString(), 'Query execution failed:', err.message);
            res.status(500).json({ error: `Database operation failed`, message: err.message });
        }
    });

    app.get('/combined14', async (req, res) => {
        try {
            const request = pool.request();

            const queries = [
                `SELECT TOP 10 BusinessEntityID, FirstName, LastName FROM Person.Person ORDER BY LastName`,
                `SELECT ProductID, Name, StandardCost FROM Production.Product WHERE StandardCost > 500 ORDER BY StandardCost DESC`,
                `SELECT AddressID, AddressLine1, City FROM Person.Address WHERE City LIKE 'A%' ORDER BY AddressID`,
                `SELECT SalesOrderID, OrderDate FROM Sales.SalesOrderHeader WHERE OrderDate > '2023-01-01' ORDER BY OrderDate`,
                `SELECT DepartmentID, Name FROM HumanResources.Department ORDER BY Name`,
                `SELECT ContactTypeID, Name FROM Person.ContactType ORDER BY Name`
            ];

            const results = await Promise.all(queries.map(query => request.query(query)));

            res.json({ status: 'ok', data: results.map(r => r.recordset) });
        } catch (err) {
            console.error(new Date().toISOString(), 'Query execution failed:', err.message);
            res.status(500).json({ error: `Database operation failed`, message: err.message });
        }
    });


    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`hr app listening on port ${port}`);
    });

    // Graceful shutdown setup
    async function gracefulShutdown() {
        try {
            await pool.close();
            console.log('Connection pool closed gracefully');
        } catch (err) {
            console.error('Error closing the connection pool', err);
        }
        process.exit(0);
    }

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

}

startHrPortalApp().catch(err => {
    console.error(new Date().toISOString(), 'Failed to start application:', err.message);
    process.exit(1);
});

//e7b940c1721734ea579a3ba1ec58ecf0FFFFNRAL
//739cc4d2cbdca96be716b5797940f39eFFFFNRAL
