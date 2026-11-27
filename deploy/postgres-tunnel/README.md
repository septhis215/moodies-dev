# Docker SSH tunnel to Dokploy staging PostgreSQL

Start **moodies-staging-postgres** in Docker Desktop to connect a Windows backend
to the Hostinger VPS database at local address `127.0.0.1:15432`. This container
runs SSH only; PostgreSQL data stays on the VPS.

## One-time setup for each developer

Use **Git Bash** throughout, starting from the repository root. You need Docker
Desktop, an administrator SSH login with Docker access, and staging database
credentials. Each developer generates their own dedicated key. `.env`, keys, and
trusted host records are ignored by Git; do not share or commit them.

1. Prepare the files and generate a key if one does not already exist:

   ```bash
   cd deploy/postgres-tunnel
   [ -f .env ] || cp .env.example .env
   mkdir -p .ssh
   if [ ! -f .ssh/id_ed25519 ]; then
     ssh-keygen -t ed25519 -f .ssh/id_ed25519 -C moodies-local-postgres-tunnel
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
   POSTGRES_INTERNAL_HOST='YOUR_DOKPLOY_POSTGRES_INTERNAL_HOST'
   PUBLIC_KEY=$(cut -d ' ' -f 1,2 .ssh/id_ed25519.pub)

   ssh -p "$SSH_PORT" -o UserKnownHostsFile=.ssh/known_hosts \
     "$SSH_USER@$SSH_HOST" \
     "PUBLIC_KEY='$PUBLIC_KEY' POSTGRES_INTERNAL_HOST='$POSTGRES_INTERNAL_HOST' sh -s" \
     < setup-vps.sh
   ```

   Replace the internal host with **Internal Host** from the staging database in
   Dokploy. Enter the VPS SSH password when prompted. The current administrator
   login uses root. `dokploy-network` must be attachable.

   The script creates a persistent `moodies-postgres-relay`, bound to VPS
   `127.0.0.1:15432` and connected to `dokploy-network`. It accepts a matching
   existing relay and refuses to replace one with different settings. For an old
   matching relay using `--rm`, follow its message to stop the relay and rerun.
   The service hostname follows database container replacements.

   The key permits forwarding only to VPS `127.0.0.1:15432`. Shell commands, PTY,
   agent forwarding, and X11 forwarding are disabled. Other keys are preserved.
   Redis uses a separate dedicated key. No SSH daemon restart is needed.

4. Close any manual tunnel on local port 15432, then start Docker:

   ```bash
   docker compose up -d --build
   ```

   Leave Dokploy's public PostgreSQL external port disabled.

5. Set the local backend's `server/.env`, then restart the backend:

   ```dotenv
   DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_ENCODED_DB_PASSWORD@127.0.0.1:15432/YOUR_DB_NAME?schema=public&connection_limit=2"
   DIRECT_URL="postgresql://YOUR_DB_USER:YOUR_ENCODED_DB_PASSWORD@127.0.0.1:15432/YOUR_DB_NAME?schema=public&connection_limit=2"
   ```

   Use the PostgreSQL credentials from Dokploy and URL encode password special
   characters. The password stays in the backend environment; SSH does not need it.

## Daily use and verification

Keep Docker Desktop running. Start **moodies-staging-postgres** under Containers;
stop it there when finished. No open SSH terminal or daily password entry is
needed. The restart policy reconnects after SSH failure and Docker restarts unless
you explicitly stopped the container. A running container alone does not prove
the database is available: verify a database-backed API request.

```bash
docker compose ps
docker compose logs --tail 30 postgres-tunnel
```

These addresses apply to a backend running directly on Windows. Other containers
need their own networking configuration. The hosted API in `dokploy-network` uses
the internal database hostname and port 5432. Local writes here affect staging.
Keep both tunnels running if the API also needs staging Redis.

## Troubleshooting

- `Permission denied (publickey)`: repeat authorization with the administrator
  SSH login. The container does not fall back to passwords.
- `Host key verification failed`: verify the current VPS fingerprint and refresh
  the trusted host records. Keep host-key checking enabled.
- `Address already in use`: stop the manual tunnel or other listener on 15432.
- `administratively prohibited`: check this key's `permitopen` and the VPS SSH
  forwarding policy. Redis key authorization does not authorize PostgreSQL.
- `Connection refused`: check the Dokploy database status and, on the VPS,
  `docker logs --tail 30 moodies-postgres-relay`.
- Prisma authentication errors: verify the database password and URL encoding.

See [SSH tunnel setup](../ssh-tunnels.md) for the two-service overview.
