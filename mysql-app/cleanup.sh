docker-compose down -v
docker rm $(docker ps -a)
docker rmi $(docker images -qa)

