#!/bin/sh
set -eu

# Run over an administrator's SSH login, never with the restricted tunnel key.
: "${PUBLIC_KEY:?Supply the dedicated public key from README.md}"
: "${REDIS_INTERNAL_HOST:?Supply the Dokploy Redis internal host}"
case "$PUBLIC_KEY" in
  'ssh-ed25519 '*) KEY_BLOB=${PUBLIC_KEY#ssh-ed25519 } ;;
  *) echo "Expected an ED25519 public key without its comment." >&2; exit 1 ;;
esac
case "$KEY_BLOB" in
  ''|*[!A-Za-z0-9+/=]*) echo "Invalid public key." >&2; exit 1 ;;
esac
case "$REDIS_INTERNAL_HOST" in
  ''|*[!A-Za-z0-9.-]*) echo "Invalid Redis internal hostname." >&2; exit 1 ;;
esac

[ "$(docker network inspect dokploy-network --format '{{.Attachable}}')" = true ] || {
  echo "dokploy-network must be attachable." >&2; exit 1;
}

RELAY=moodies-redis-relay
if docker container inspect "$RELAY" >/dev/null 2>&1; then
  BINDING=$(docker inspect --format '{{range (index .HostConfig.PortBindings "6379/tcp")}}{{.HostIp}}:{{.HostPort}}{{end}}' "$RELAY")
  IMAGE=$(docker inspect --format '{{.Config.Image}}' "$RELAY")
  COMMAND=$(docker inspect --format '{{json .Config.Cmd}}' "$RELAY")
  if [ "$BINDING" != '127.0.0.1:16379' ] || [ "$IMAGE" != alpine/socat ] ||
     [ "$COMMAND" != "[\"TCP-LISTEN:6379,fork,reuseaddr\",\"TCP:$REDIS_INTERNAL_HOST:6379\"]" ]; then
    echo "Existing relay has different settings; nothing was replaced. Inspect it before proceeding." >&2
    exit 1
  fi
  if [ "$(docker inspect --format '{{.HostConfig.AutoRemove}}' "$RELAY")" = true ]; then
    echo "The existing relay uses --rm. Run docker stop $RELAY, then rerun setup to create a persistent relay." >&2
    exit 1
  fi
  docker update --restart unless-stopped "$RELAY" >/dev/null
  docker start "$RELAY" >/dev/null
else
  docker run -d --name "$RELAY" --restart unless-stopped --network bridge \
    -p 127.0.0.1:16379:6379 alpine/socat \
    TCP-LISTEN:6379,fork,reuseaddr "TCP:$REDIS_INTERNAL_HOST:6379" >/dev/null
fi
if [ "$(docker inspect --format '{{if index .NetworkSettings.Networks "dokploy-network"}}yes{{end}}' "$RELAY")" != yes ]; then
  docker network connect dokploy-network "$RELAY"
fi

umask 077
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
touch "$HOME/.ssh/authorized_keys"
LINE="restrict,port-forwarding,permitopen=\"127.0.0.1:16379\",command=\"/bin/false\" $PUBLIC_KEY moodies-local-redis-tunnel"
if ! grep -Fxq "$LINE" "$HOME/.ssh/authorized_keys"; then
  if grep -Fq "$KEY_BLOB" "$HOME/.ssh/authorized_keys"; then
    echo "This key already has different SSH restrictions; review it manually." >&2
    exit 1
  fi
  printf '%s\n' "$LINE" >> "$HOME/.ssh/authorized_keys"
fi
chmod 600 "$HOME/.ssh/authorized_keys"
echo "Redis relay and restricted tunnel key configured."
