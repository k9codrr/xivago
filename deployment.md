# Xivago Production Deployment Guide

Complete end-to-end documentation for hosting **xivago** (`apps/web` + `apps/realtime`) on an Ubuntu 24.04 LTS VPS (`103.127.28.208`) behind Nginx with Let's Encrypt SSL at **`https://app.xivago.com`**.

---

## 1. Architecture Overview

| Component | Port / Path | Managed By |
| --- | --- | --- |
| Next.js web app (`@slotbook/web`) | `127.0.0.1:3000` | PM2 (`xivago-web`) |
| Socket.IO realtime server (`@slotbook/realtime`) | `127.0.0.1:3001` | PM2 (`xivago-realtime`) |
| Reverse proxy & SSL termination | `80`, `443` | Nginx + Certbot |
| Repository directory | `/var/www/xivago` | Git (`main` branch) |
| Database | Neon PostgreSQL (external) | Prisma (`packages/db`) |

---

## 2. Server Access

```bash
ssh root@103.127.28.208
```

Optional `~/.ssh/config` entry on your workstation:

```sshconfig
Host xivago-server
  HostName 103.127.28.208
  User root
  Port 22
```

---

## 3. Cloud & OS Firewall Setup

### 3.1 Cloud Provider Firewall (Utho Security Group)
In the Utho Console (`sg-xivago-server-*` → **Inbound Rules**), allow:

| Service | Protocol | Port | Source |
| --- | --- | --- | --- |
| SSH | TCP | `22` | `0.0.0.0/0` |
| HTTP | TCP | `80` | `0.0.0.0/0` |
| HTTPS | TCP | `443` | `0.0.0.0/0` |

### 3.2 Server Packages, UFW & Fail2ban

```bash
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git nginx certbot python3-certbot-nginx ufw fail2ban

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
systemctl enable --now fail2ban nginx
```

Verify firewall status:

```bash
ufw status verbose
```

---

## 4. Install Node.js 20, pnpm & PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pnpm@9.12.0 pm2 tsx
```

Verify versions:

```bash
node -v   # v20.20.2
pnpm -v   # 9.12.0
pm2 -v    # 7.1.2
```

---

## 5. Clone Repository & Configure Environment

```bash
mkdir -p /var/www
git clone -b main https://github.com/k9codrr/xivago.git /var/www/xivago
cd /var/www/xivago
```

Create `/var/www/xivago/.env` (with `chmod 600 /var/www/xivago/.env`) and symlink it into the workspace packages so every app/package loads the same environment:

```bash
ln -sf /var/www/xivago/.env /var/www/xivago/apps/web/.env
ln -sf /var/www/xivago/.env /var/www/xivago/packages/db/.env
ln -sf /var/www/xivago/.env /var/www/xivago/apps/realtime/.env
chmod 600 /var/www/xivago/.env
```

Ensure the domain-specific URLs in `.env` point to `https://app.xivago.com`:

```env
NEXTAUTH_URL="https://app.xivago.com"
NEXT_PUBLIC_APP_URL="https://app.xivago.com"
NEXT_PUBLIC_SOCKET_URL="https://app.xivago.com"
SOCKET_PORT=3001
```

---

## 6. Install Dependencies, Generate Prisma & Build

```bash
cd /var/www/xivago
pnpm install --frozen-lockfile
pnpm --filter @slotbook/db run generate
NODE_OPTIONS="--max-old-space-size=2048" pnpm --filter @slotbook/web build
pnpm --filter @slotbook/realtime build
```

---

## 7. Run Apps with PM2 & Auto-Start on Boot

Because `apps/realtime` imports workspace TypeScript sources (`@slotbook/push`), it is started with `tsx`:

```bash
cd /var/www/xivago
pm2 start "pnpm --filter @slotbook/web start" --name xivago-web --cwd /var/www/xivago
pm2 start "tsx --env-file=.env apps/realtime/src/index.ts" --name xivago-realtime --cwd /var/www/xivago
pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root | tail -n 1 | bash
```

Check process status & logs:

```bash
pm2 status
pm2 logs xivago-web --lines 50
pm2 logs xivago-realtime --lines 50
```

---

## 8. Configure Nginx Reverse Proxy & Security Headers

Create `/etc/nginx/sites-available/app.xivago.com`:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name app.xivago.com _;

    client_max_body_size 50M;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and reload Nginx:

```bash
ln -sf /etc/nginx/sites-available/app.xivago.com /etc/nginx/sites-enabled/app.xivago.com
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

---

## 9. DNS Configuration (Cloudflare)

In Cloudflare DNS for `xivago.com`:

| Type | Name | Content | Proxy Status | TTL |
| --- | --- | --- | --- | --- |
| `A` | `app` | `103.127.28.208` | **DNS only** (grey cloud during SSL issuance) | Auto |

Verify DNS propagation:

```bash
dig +short @1.1.1.1 app.xivago.com
# Expected: 103.127.28.208
```

*(Optional: After SSL is issued, you may switch Cloudflare Proxy to **Proxied** with SSL/TLS mode set to **Full (strict)**.)*

---

## 10. SSL / HTTPS Setup (Let's Encrypt)

Issue the certificate and configure automatic HTTP → HTTPS redirection:

```bash
certbot --nginx -d app.xivago.com --non-interactive --agree-tos --email kanishkk.bansal18@gmail.com --redirect
```

Verify auto-renewal and live HTTPS response:

```bash
certbot renew --dry-run
curl -sI https://app.xivago.com
```

---

## 11. Redeploying Future Updates

Whenever you push new changes to `main`, SSH into the server and run:

```bash
cd /var/www/xivago
git pull origin main
pnpm install --frozen-lockfile
pnpm --filter @slotbook/db run generate
NODE_OPTIONS="--max-old-space-size=2048" pnpm --filter @slotbook/web build
pm2 restart xivago-web xivago-realtime
```
