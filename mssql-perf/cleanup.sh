#!/bin/bash

docker-compose down -v

docker rm -f $(docker ps -a)
docker rmi -f $(docker images -qa)
