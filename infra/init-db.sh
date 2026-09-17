#!/bin/bash
set -e
# Postgres is shared by two services locally (auth-service, order-service),
# each gets its own logical database to keep ownership boundaries clean -
# in EKS each instead gets its own StatefulSet, so this script is dev-only.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
  CREATE DATABASE authdb;
  CREATE DATABASE orderdb;
EOSQL
