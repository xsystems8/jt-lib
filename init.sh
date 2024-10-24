#!/bin/sh

read -p "Enter install directory: " dir_name;
read -p "Enter App public port: " app_port;
git clone https://github.com/xsystems8/jt-lib.git $dir_name;
cd $dir_name;
touch storage.db;
touch .env;
echo "APP_PORT=$app_port" > .env;

touch storage.db;
mkdir history-bars;
mkdir artifacts;

docker compose pull;

echo "Success install! Next step 'cd $dir_name' and run.sh or daemon mode run_daemon.sh"