#!/bin/sh
set -eu

if [ ! -s /credentials/id_ed25519 ] || [ ! -s /credentials/known_hosts ]; then
  echo "Authorize the tunnel key and prepare known_hosts using README.md before starting." >&2
  exit 1
fi

# Windows bind mounts can expose permissions OpenSSH rejects for a private key.
umask 077
mkdir -p /tmp/ssh
cp /credentials/id_ed25519 /tmp/ssh/id_ed25519
chmod 600 /tmp/ssh/id_ed25519

exec ssh -NT \
  -i /tmp/ssh/id_ed25519 \
  -p "${SSH_PORT:-22}" \
  -o BatchMode=yes \
  -o PasswordAuthentication=no \
  -o KbdInteractiveAuthentication=no \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile=/credentials/known_hosts \
  -o GlobalKnownHostsFile=/dev/null \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=3 \
  -o ConnectTimeout=10 \
  -L 0.0.0.0:16379:127.0.0.1:16379 \
  "${SSH_USER:?Set SSH_USER}@${SSH_HOST:?Set SSH_HOST}"
