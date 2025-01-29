# db-perfromance-testing
Performance testing for databases (MySQL, PostgreSQL, MSSQL) 

# postgresql setup
cd psql-app/
docker-compose up --build

# if starting again then cleanup first using below from the same directory
./cleanup

# mysql setup
cd mysql-app/
docker-compose up --build

# if starting again then cleanup first using below from the same directory
./cleanup

# mssql setup
cd mssql-perf/
docker-compose up --build

# if starting again then cleanup first using below from the same directory
./cleanup
