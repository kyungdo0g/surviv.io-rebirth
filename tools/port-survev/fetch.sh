#!/bin/sh
# Fetches the port inputs: the survev reference clone (.survev, pinned commit) and the original client defs
# (research-cache/live/defs.json). Run from anywhere: sh tools/port-survev/fetch.sh
set -eu

COMMIT=c6185e31fe25a4a07def77a2bb25b1710bda90ac
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"

if [ ! -d .survev/.git ]; then
    git clone https://github.com/survev/survev .survev
    git -C .survev checkout --quiet "$COMMIT"
fi

HEAD=$(git -C .survev rev-parse HEAD)
if [ "$HEAD" != "$COMMIT" ]; then
    echo "error: .survev is at $HEAD, expected $COMMIT" >&2
    echo "       run: git -C .survev fetch && git -C .survev checkout $COMMIT" >&2
    exit 1
fi
echo ".survev at $COMMIT"

if [ ! -f research-cache/live/defs.json ]; then
    NODE_USE_ENV_PROXY=1 node tools/research/extract-live-defs.ts
fi
echo "research-cache/live/defs.json present"
