#!/usr/bin/env bash
set -euo pipefail

sha=${1:?Missing commit SHA}
[[ $sha =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid commit SHA' >&2; exit 1; }

base=/home/ubuntu/cima-deploy
shared=$base/shared
current=$base/current
archive=/home/ubuntu/cima-release.tar.gz

test -s "$shared/.env"
test -d "$shared/data"
test -s "$archive"
mkdir -p "$base/releases"

release=$(mktemp -d "$base/releases/$sha.XXXXXX")
previous=$(readlink -f "$current")
activated=false
success=false

cleanup() {
    if [[ $activated == true && $success == false ]]; then
        echo 'Restoring previous release' >&2
        ln -s "$previous" "$base/current.next"
        mv -Tf "$base/current.next" "$current"
        sudo systemctl restart cima.service
    fi
    rm -f "$archive" /home/ubuntu/cima-deploy.sh
    if [[ $success == false ]]; then rm -rf "$release"; fi
}
trap cleanup EXIT

tar -xzf "$archive" -C "$release"
ln -s "$shared/.env" "$release/.env"
ln -s "$shared/data" "$release/data"

cd "$release"
npm ci --omit=dev --no-audit --no-fund
find index.js deploy-commands.js src -type f -name '*.js' -print0 | xargs -0 -n1 node --check
node deploy-commands.js

ln -s "$release" "$base/current.next"
mv -Tf "$base/current.next" "$current"
activated=true

sudo systemctl restart cima.service
for attempt in {1..20}; do
    if systemctl is-active --quiet cima.service; then
        pid=$(systemctl show cima.service -p MainPID --value)
        if journalctl -u cima.service _PID="$pid" --no-pager | grep 'Cima está lista' >/dev/null; then
            echo "Deployed $sha (PID $pid)"
            success=true
            exit 0
        fi
    fi
    sleep 2
done

echo 'New release did not become ready' >&2
exit 1
