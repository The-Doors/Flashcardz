#!/usr/bin/env bash
set -euo pipefail
umask 022
cd "$(dirname "$0")"

# Official self-hosted/v0.8.4, pinned so app deployments cannot upgrade Postgres.
release=189adda99d1b56da55fc5a6ee3f849354aaea92a
if [[ ! -d upstream ]]; then
    git clone --filter=blob:none --no-checkout --depth 1 --branch self-hosted/v0.8.4 https://github.com/supabase/supabase.git upstream
    git -C upstream sparse-checkout init --cone
    git -C upstream sparse-checkout set docker
    git -C upstream checkout --detach "$release"
fi
if [[ "$(git -C upstream rev-parse HEAD)" != "$release" ]]; then
    echo 'Unexpected Supabase release; refusing to change an existing installation.' >&2
    exit 1
fi
if [[ -f .env ]]; then
    echo 'Existing Supabase .env retained; no secrets were regenerated.'
    exit 0
fi

umask 077
staging=$(mktemp -d "$PWD/.init.XXXXXX")
trap 'rm -rf "$staging"' EXIT
cp .env.example "$staging/.env"
cp upstream/docker/docker-compose.yml "$staging/docker-compose.yml"
(
    cd "$staging"
    sh ../upstream/docker/utils/generate-keys.sh --update-env > /dev/null
    sh ../upstream/docker/utils/add-new-auth-keys.sh --update-env > /dev/null
)
mv "$staging/.env" .env
echo 'Generated production secrets in supabase/production/.env (mode 600).'
echo 'Fill in SMTP_PASS before starting Supabase. Back up this file securely.'
