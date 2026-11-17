#!/usr/bin/env bash
# Drops and recreates the local dev database, then migrates and seeds it.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
psql "${DATABASE_URL%/*}/postgres" -c "drop database if exists ${DATABASE_URL##*/} with (force)" -c "create database ${DATABASE_URL##*/}"
npx tsx scripts/seed.ts
