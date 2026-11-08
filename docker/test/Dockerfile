# syntax=docker/dockerfile:1
#
# Derived OpenCode test image for the npx installer Docker gate. Pinned to
# opencode 2.0.18 (same CLI line as the host) by image digest.
#
# The official image is Alpine with a standalone `opencode` binary and no
# Node/npm/git/ssh. This layer adds the npx and GitHub toolchain, creates a
# non-root `tester` user matching the host UID/GID, and keeps the inherited
# entrypoint (`opencode`); tests must override it with `--entrypoint sh`.
# Nothing is copied from the build context: no repo files, credentials, or
# test artifacts ever enter the image.

ARG OPENCODE_IMAGE=ghcr.io/anomalyco/opencode@sha256:aa0e5ac93543f24c99dfcc72a6ea7df335faec131dafc16f7607a2c7d3173d28
FROM ${OPENCODE_IMAGE}

# gcompat supplies the glibc loader that duckdb's native binding needs on musl.
RUN apk add --no-cache nodejs npm git openssh-client gcompat

ARG UID=1000
ARG GID=1000

RUN addgroup -g "${GID}" tester \
 && adduser -D -u "${UID}" -G tester -h /home/tester -s /bin/sh tester \
 && mkdir -p /home/tester/.npm /home/tester/.config /work/project \
 && chown -R tester:tester /home/tester /work

WORKDIR /home/tester
USER tester

# Build-time smoke: fail if the toolchain or the gcompat loader is missing.
# duckdb is deliberately not installed here; if a later layer adds it, this
# run proves the glibc-linked binding can load. Otherwise the loader check is
# the harmless gcompat assertion required by the plan.
RUN set -eu; \
    export HOME=/tmp/dh-smoke \
      XDG_CONFIG_HOME=/tmp/dh-smoke/.config \
      XDG_DATA_HOME=/tmp/dh-smoke/.local/share \
      XDG_STATE_HOME=/tmp/dh-smoke/.local/state \
      XDG_CACHE_HOME=/tmp/dh-smoke/.cache; \
    mkdir -p "$HOME"; \
    test -x /usr/local/bin/opencode; \
    opencode --version; \
    node -v; \
    npm -v; \
    git --version; \
    ssh -V; \
    node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 20 || (major === 20 && minor < 11)) { throw new Error("Node >= 20.11 required, found " + process.versions.node); }'; \
    if node -e "require.resolve('duckdb')" >/dev/null 2>&1; then \
      node -e "require('duckdb')"; \
    else \
      test -x /lib/ld-linux-x86-64.so.2; \
      ldd --version >/dev/null 2>&1 || true; \
      echo "duckdb module absent; gcompat glibc loader present"; \
    fi; \
    rm -rf /tmp/dh-smoke
