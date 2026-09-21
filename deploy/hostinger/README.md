# Hostinger VPS deployment

This directory contains production templates for the NestJS API in `server/`.
The VPS should expose only the reverse proxy; Node listens on localhost.

## Recommended layout

```text
/var/www/moodies             # application checkout
/etc/moodies/server.env      # production secrets, mode 600
/etc/systemd/system/moodies-api.service
/etc/nginx/sites-available/moodies-api.conf
```

Use Ubuntu with Node.js 20 or newer. Managed PostgreSQL and Redis are recommended;
install them on the VPS only if you will also own backups and monitoring.

## First deployment

```bash
sudo mkdir -p /var/www/moodies /etc/moodies
sudo useradd --system --home /var/www/moodies --shell /usr/sbin/nologin moodies || true
sudo chown -R "$USER":"$USER" /var/www/moodies
cd /var/www/moodies
git clone <repository-url> .
cp server/.env.example /etc/moodies/server.env
chmod 600 /etc/moodies/server.env
nano /etc/moodies/server.env
npm ci
npm run build --workspace server
npm run migrate:deploy --workspace server
sudo cp deploy/hostinger/moodies-api.service /etc/systemd/system/
sudo chown -R moodies:moodies /var/www/moodies
sudo systemctl daemon-reload
sudo systemctl enable --now moodies-api
```

Replace the service `User`, `WorkingDirectory`, and `EnvironmentFile` values if
your VPS uses another Linux user or path.

## Nginx and TLS

```bash
sudo cp deploy/hostinger/nginx/moodies-api.conf.example /etc/nginx/sites-available/moodies-api.conf
sudo nano /etc/nginx/sites-available/moodies-api.conf
sudo ln -s /etc/nginx/sites-available/moodies-api.conf /etc/nginx/sites-enabled/moodies-api.conf
sudo nginx -t
sudo systemctl reload nginx
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.example.com
```

Set the final HTTPS frontend origin in `CLIENT_URL` and `CORS_ORIGINS`; never use
`*` with credentialed cookies.

## Operations

```bash
systemctl status moodies-api
journalctl -u moodies-api -f
curl -fsS https://api.example.com/api/health
```

For releases: `git pull --ff-only`, `npm ci`, build, run `migrate:deploy`, then
`sudo systemctl restart moodies-api`. Never commit `/etc/moodies/server.env`.
