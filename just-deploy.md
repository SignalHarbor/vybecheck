# Just Deploy — Production Checklist

## 1. Fly.io Volume for SQLite
The DB file lives on disk. Without a volume, it's lost on every deploy.

```bash
fly volumes create vybecheck_data --region iad --size 1
```

Add to `fly.toml`:
```toml
[mounts]
  source = "vybecheck_data"
  destination = "/app/data"
```

Set the DB path:
```bash
fly secrets set DB_PATH=/app/data/vybecheck.db
```

## 2. Secrets
Do not bake secrets into the image. Set them via Fly:

```bash
fly secrets set \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_STARTER=price_... \
  STRIPE_PRICE_PRO=price_... \
  STRIPE_PRICE_ULTIMATE=price_... \
  OPENAI_API_KEY=sk-proj-... \
  JWT_SECRET=$(openssl rand -base64 32) \
  VITE_TWITTER_CLIENT_ID=VkdYOWF2... \
  DB_PATH=/app/data/vybecheck.db \
  APP_URL=https://vybecheck.fly.dev
```

## 3. Frontend Build-Time Env Vars (`VITE_*`)
`VITE_*` vars are baked into the frontend at build. Create `.env.production`:

```
VITE_WS_URL=wss://vybecheck.fly.dev
VITE_SERVER_URL=https://vybecheck.fly.dev
VITE_TWITTER_CLIENT_ID=VkdYOWF2TUtiaEVlZ2lvSE94NFI6MTpjaQ
VITE_TWITTER_REDIRECT_URI=https://vybecheck.fly.dev/auth/callback
VITE_DEFAULT_QUESTION_LIMIT=1
VITE_UPGRADED_QUESTION_LIMIT=3
```

Note: `wss://` not `ws://`. Fly terminates TLS.

## 4. `APP_URL`
Must match the production domain. Used for Stripe checkout redirect URLs.

```
APP_URL=https://vybecheck.fly.dev
```

## 5. Twitter Developer Portal
Add `https://vybecheck.fly.dev/auth/callback` as a callback URL in your Twitter app settings. Keep the localhost one for dev.

## 6. Stripe Webhook
Register `https://vybecheck.fly.dev/api/webhooks/stripe` in Stripe Dashboard → Webhooks. Use the **live** webhook signing secret (not the CLI `whsec_` from `stripe listen`).

## 7. Stripe Live Mode
Replace test keys with live keys:
- `sk_test_*` → `sk_live_*`
- Test price IDs → live price IDs

## 8. Fix `fly.toml` Internal Port
The `[http_service]` block says `internal_port = 80` but the server listens on `3000`. Fix it:

```toml
[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'suspend'
  auto_start_machines = true
  min_machines_running = 0
  processes = ['app']
```

## 9. Cold Start Behavior
With `min_machines_running = 0`, the first request after idle has a ~2-3s cold start. SQLite on the volume survives suspend/resume fine. Set to `1` if you want always-on.

---

## Nice-to-Have (Not Blocking)

- **Rate limiting** — Add `express-rate-limit` on `/api/auth/*` and `/api/checkout`
- **CORS** — Not needed while frontend/API share the same domain. Add if you split them
- **Logging** — Replace `console.log` with `pino` for structured JSON logs
- **Error tracking** — Add Sentry for production error monitoring
- **DB backups** — Fly volumes are not auto-backed up. Use `fly ssh console` + `sqlite3 .backup` or a scheduled job
