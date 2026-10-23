#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

container="flashcardz-tests-$$-$RANDOM"
test_pid=

cleanup() {
    if [[ -n "$test_pid" ]]; then
        kill -TERM "$test_pid" 2>/dev/null || true
        wait "$test_pid" 2>/dev/null || true
    fi
    docker rm --force --volumes "$container" >/dev/null 2>&1 || true
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

php artisan config:clear --ansi

docker run --detach --rm --name "$container" --label flashcardz.tests=true \
    --publish 127.0.0.1::5432 --tmpfs /var/lib/postgresql/data \
    --env POSTGRES_DB=testing --env POSTGRES_PASSWORD=testing \
    postgres:17-alpine >/dev/null

if ! docker exec "$container" sh -c '
    for attempt in $(seq 1 30); do
        pg_isready --quiet --host=127.0.0.1 --username=postgres --dbname=testing && exit 0
        sleep 1
    done
    exit 1
'; then
    docker logs "$container"
    exit 1
fi

address=$(docker port "$container" 5432/tcp)
export TEST_DB_HOST=127.0.0.1 TEST_DB_PORT="${address##*:}"

php artisan test "$@" &
test_pid=$!
status=0
wait "$test_pid" || status=$?
test_pid=
exit "$status"
