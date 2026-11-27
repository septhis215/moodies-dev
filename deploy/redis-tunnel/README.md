# Docker SSH tunnel to Dokploy staging Redis

Start **moodies-staging-redis** in Docker Desktop to connect a Windows backend
to Hostinger staging Redis at `127.0.0.1:16379`. This container runs SSH only;
Redis data stays on the VPS.

## One-time setup for each developer

Use **Git Bash** throughout, starting from the repository root. You need Docker
Desktop, an administrator SSH login with Docker access, and staging Redis
credentials. Each developer generates their own dedicated key. `.env`, keys, and
trusted host records are ignored by Git; do not share or commit them.

1. Prepare the files and generate a key if one does not already exist:

   ```bash
   cd deploy/redis-tunnel
   [ -f .env ] || cp .env.example .env
   mkdir -p .ssh
   if [ ! -f .ssh/id_ed25519 ]; then
     ssh-keygen -t ed25519 -f .ssh/id_ed25519 -C moodies-local-redis-tunnel
   fi
   ```

   Leave both passphrase prompts empty: the restricted key must work without an
   interactive prompt. Preserve existing keys. Edit `.env` with the VPS SSH
   hostname/IP, administrator username, and port. Its three example entries are
   also valid Git Bash assignments.

2. Verify the VPS host key through your administrator login:

   ```bash
   . ./.env
   ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST"
   ```

   Before accepting a new fingerprint, compare it against this command run in
   Hostinger's browser terminal:

   ```bash
   ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
   ```

   After logging in, run `exit` to return locally, then:

   ```bash
   cp "$HOME/.ssh/known_hosts" .ssh/known_hosts
   ```

   If an administrator already prepared this computer's dedicated key and
   `.ssh/known_hosts`, preserve those files instead.

3. Configure the private relay and authorize your key:

   ```bash
   . ./.env
   REDIS_INTERNAL_HOST='YOUR_DOKPLOY_REDIS_INTERNAL_HOST'
   PUBLIC_KEY=$(cut -d ' ' -f 1,2 .ssh/id_ed25519.pub)

   ssh -p "$SSH_PORT" -o UserKnownHostsFile=.ssh/known_hosts \
     "$SSH_USER@$SSH_HOST" \
     "PUBLIC_KEY='$PUBLIC_KEY' REDIS_INTERNAL_HOST='$REDIS_INTERNAL_HOST' sh -s" \
     < setup-vps.sh
   ```

   Replace the internal host with **Internal Host** from the intended staging
   Redis service in Dokploy. Enter the VPS SSH password when prompted. The
   current administrator login uses root. `dokploy-network` must be attachable.

   The script creates a persistent `moodies-redis-relay`, bound to VPS
   `127.0.0.1:16379` and connected to `dokploy-network`. It accepts a matching
   existing relay and refuses to replace one with different settings. For an old
   matching relay using `--rm`, follow its message to stop the relay and rerun.
   This briefly interrupts local tunnels; Redis itself keeps running.

   The key permits forwarding only to VPS `127.0.0.1:16379`. Shell commands, PTY,
   agent forwarding, and X11 forwarding are disabled. Other keys are preserved.
   PostgreSQL uses a separate dedicated key. No SSH daemon restart is needed.

4. Close any manual tunnel on local port 16379, then start Docker:

   ```bash
   docker compose up -d --build
   ```

   Leave Dokploy's public Redis external port disabled.

5. Set the local backend's `server/.env`, then restart the backend:

   ```dotenv
   REDIS_URL=""
   REDIS_HOST="127.0.0.1"
   REDIS_PORT="16379"
   REDIS_PASS="YOUR_DOKPLOY_REDIS_PASSWORD"
   ```

   RedisInsight uses the same host/port, username `default`, and Dokploy Redis
   password. The tunnel container does not need the Redis password.

## Daily use and verification

Keep Docker Desktop running. Start **moodies-staging-redis** under Containers;
stop it there when finished. No open SSH terminal or daily password entry is
needed. The restart policy reconnects after SSH failure and Docker restarts unless
you explicitly stopped the container. A running container alone does not prove
Redis is available: in RedisInsight run `PING` and expect `PONG`.

```bash
docker compose ps
docker compose logs --tail 30 redis-tunnel
```

The backend should log `Redis connection established.` when it first uses Redis.
These addresses apply to a backend running directly on Windows. Other containers
need their own networking configuration. The hosted API uses the internal Redis
hostname and port 6379. Local use shares staging cache and rate-limit data.
Keep both tunnels running if the API also needs staging PostgreSQL.

## Troubleshooting

- `Permission denied (publickey)`: repeat authorization with the administrator
  SSH login. The container does not fall back to passwords.
- `Host key verification failed`: verify the current VPS fingerprint and refresh
  the trusted host records. Keep host-key checking enabled.
- `Address already in use`: stop the manual tunnel or other listener on 16379.
- `administratively prohibited`: check this key's `permitopen` and the VPS SSH
  forwarding policy.
- `Connection refused`: check the Dokploy Redis status and, on the VPS,
  `docker logs --tail 30 moodies-redis-relay`.
- `WRONGPASS`: verify the separate Redis password from Dokploy.

See [SSH tunnel setup](../ssh-tunnels.md) for the two-service overview.
