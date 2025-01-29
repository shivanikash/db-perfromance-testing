# db-perfromance-testing
Performance testing for databases (MySQL, PostgreSQL, MSSQL) 

# postgresql setup
cd psql-app/
docker-compose up --build

# mysql setup
cd mysql-app/
docker-compose up --build

# mssql setup
cd mssql-perf/
docker-compose up --build

# if starting the docker setup again then cleanup first using the below from the same directory
./cleanup
