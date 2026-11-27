# Local SSH tunnels to Hostinger staging

Use these Docker-managed tunnels when running the Moodies backend directly on
Windows against Dokploy staging services. Docker Desktop must run. These local
containers hold no Redis or PostgreSQL data.

| Service | Docker Desktop application | Windows address | Hosted API address |
|---|---|---|---|
| Redis | `moodies-staging-redis` | `127.0.0.1:16379` | Dokploy Redis internal host, port 6379 |
| PostgreSQL | `moodies-staging-postgres` | `127.0.0.1:15432` | Dokploy PostgreSQL internal host, port 5432 |

## Set up each developer's computer

1. Follow the [Redis setup](redis-tunnel/README.md) from Git Bash.
2. Follow the [PostgreSQL setup](postgres-tunnel/README.md) from Git Bash.
3. Configure the local backend's Redis and database variables as those guides show.
4. Start both Docker applications and restart the backend.
5. Verify Redis with `PING` and PostgreSQL with a database-backed API request.

Both guides cover generating each developer's keys, verifying the VPS host key,
authorizing restricted forwarding, and creating persistent private VPS relays.
Each tunnel uses a separate key. Keys and credentials are ignored local files;
repository access alone does not grant VPS or database access.

## Daily use

Start **moodies-staging-redis** and **moodies-staging-postgres** in Docker Desktop.
No open SSH terminal is needed. Stop them there when finished. Close older manual
tunnels listening on the same local ports before starting the containers.

Dokploy internal hostnames resolve inside `dokploy-network`, not on Windows.
The hosted API uses internal hostnames; Windows uses the localhost ports above.
The VPS relays and Windows listeners bind only to their respective localhost
interfaces. Do not enable public Dokploy database/cache ports for these tunnels.

## Data and access

A local backend using the tunnels writes to the real staging database and shares
staging Redis data. Use separate local databases when isolation is needed. Keep
Supabase Storage settings while avatars remain there: moving PostgreSQL does not
move those objects.

To revoke access, remove that developer's dedicated public-key entries from the
VPS user's `~/.ssh/authorized_keys` and close their active SSH sessions. Removing
an entry alone does not terminate existing connections. Preserve administrator
and other developers' entries.
