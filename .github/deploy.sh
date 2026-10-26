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
stopped=false
migration_needed=false
timer_setup_started=false
backup=
database_file="$shared/data/cima.sqlite"

cleanup() {
    if [[ $success == false ]]; then
        if [[ $migration_needed == true && $timer_setup_started == true ]]; then
            sudo systemctl disable --now cima-backup.timer || true
        fi
        if [[ $activated == true ]]; then
            echo 'Restoring previous release' >&2
            ln -s "$previous" "$base/current.next"
            mv -Tf "$base/current.next" "$current"
        fi
        if [[ $migration_needed == true && -f $backup ]]; then
            if [[ -f $database_file ]]; then
                mv "$database_file" "$base/backups/failed-$sha.sqlite"
            fi
            tar -xzf "$backup" -C "$shared"
        fi
        if [[ $stopped == true ]]; then sudo systemctl restart cima.service; fi
    fi
    rm -f "$archive" /home/ubuntu/cima-deploy.sh /home/ubuntu/cima-backup.service /home/ubuntu/cima-backup.timer
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

if [[ ! -e $database_file ]]; then
    mkdir -p "$base/backups"
    backup="$base/backups/pre-sqlite-$sha.tar.gz"
    sudo systemctl stop cima.service
    stopped=true
    tar -czf "$backup" -C "$shared" data
    chmod 600 "$backup"
    migration_needed=true
    node src/utils/migrateSqlite.js
fi

node -e "const db=require('./src/utils/database').database(); if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok') process.exit(1)"
node src/utils/backupSqlite.js "$base/backups/cima-$sha-$(date -u +%Y%m%dT%H%M%SZ).sqlite"

ln -s "$release" "$base/current.next"
mv -Tf "$base/current.next" "$current"
activated=true

sudo systemctl restart cima.service
for attempt in {1..20}; do
    if systemctl is-active --quiet cima.service; then
        pid=$(systemctl show cima.service -p MainPID --value)
        if journalctl -u cima.service _PID="$pid" --no-pager | grep 'Cima está lista' >/dev/null; then
            timer_setup_started=true
            sudo install -m 644 /home/ubuntu/cima-backup.service /etc/systemd/system/cima-backup.service
            sudo install -m 644 /home/ubuntu/cima-backup.timer /etc/systemd/system/cima-backup.timer
            sudo systemctl daemon-reload
            sudo systemctl enable --now cima-backup.timer
            echo "Deployed $sha (PID $pid)"
            success=true
            exit 0
        fi
    fi
    sleep 2
done

echo 'New release did not become ready' >&2
exit 1
