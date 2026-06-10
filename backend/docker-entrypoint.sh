#!/bin/sh
set -e

echo "=== docker-entrypoint.sh ==="
echo "Applying alembic migrations..."
python -m alembic upgrade head

echo "Seeding initial data..."
python -m db.init_db

echo "Starting service..."
exec "$@"
