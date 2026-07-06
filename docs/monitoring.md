# ParkGrader Website Monitoring System

## Architecture

```
DigitalOcean Droplet ($12/mo)
├── Next.js App (ParkGrader + Monitoring Dashboard)
├── Cron (every 5 min) → POST /api/monitoring/run
└── PM2 process manager

Supabase PostgreSQL
├── parkgrader_audits (existing — audit history)
├── monitoring_websites (managed sites)
├── monitoring_checks (check history)
├── monitoring_incidents (outage tracking)
├── monitoring_notifications (alert queue)
└── monitoring_settings (per-site config)
```

## Setup

### 1. Local Development

```bash
npm install
npm run db:generate        # Generate Prisma client
npm run db:setup-monitoring # Create monitoring tables (first time)
npm run dev                 # Start dev server
```

### 2. Production Deployment

On the DigitalOcean droplet:

```bash
# Copy setup script and run:
scp scripts/setup-droplet.sh root@<IP>:/root/
ssh root@<IP> bash /root/setup-droplet.sh

# After setup, deploy updates:
ssh root@<IP> 'bash /opt/parkgrader/scripts/deploy.sh'
```

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_DB_URL` | Yes | Direct PostgreSQL connection |
| `MONITORING_SECRET` | Yes | Authenticates worker endpoint |
| `BYPASS_KEY` | Yes | Admin dashboard access key |
| `SES_AWS_REGION` | For email | AWS region for SES |
| `AWS_ACCESS_KEY_ID` | For email | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | For email | AWS secret key |
| `SES_FROM_EMAIL` | For email | Sender email address |

## API Endpoints

### Worker
- `POST /api/monitoring/run` — Run monitoring checks (auth: `x-monitoring-key` header)

### Admin (auth: `?admin_key=<BYPASS_KEY>`)
- `GET /api/admin/monitoring/dashboard` — Dashboard summary
- `GET /api/admin/monitoring/websites` — List websites
- `POST /api/admin/monitoring/websites` — Add website
- `GET /api/admin/monitoring/websites/[id]` — Website detail
- `PATCH /api/admin/monitoring/websites/[id]` — Update website
- `DELETE /api/admin/monitoring/websites/[id]` — Disable monitoring
- `GET /api/admin/monitoring/incidents` — List incidents
- `PATCH /api/admin/monitoring/incidents` — Resolve incident
- `GET /api/admin/monitoring/notifications` — List notifications
- `POST /api/admin/monitoring/notifications` — Approve/dismiss/snooze

### Customer (public)
- `GET /api/customer/monitoring/[websiteId]` — Public status page data

## Dashboard URLs

- Overview: `/monitoring?admin_key=<KEY>`
- Website Detail: `/monitoring/websites/[id]?admin_key=<KEY>`
- Incidents: `/monitoring/incidents?admin_key=<KEY>`
- Notifications: `/monitoring/notifications?admin_key=<KEY>`
- Customer Portal: `/monitoring/[websiteId]` (public, no key needed)

## Health Score

| Component | Condition | Points |
|---|---|---|
| Website Online | HTTP 200-299 | 30 |
| Booking Online | Booking page loads | 20 |
| SSL Valid | Certificate > 30 days | 20 |
| DNS OK | Domain resolves | 15 |
| Performance | Response < 2s | 15 |
| Open Incidents | Per incident | -10 |

**Thresholds:** >= 80 healthy, >= 50 warning, < 50 critical

## Failure Verification Flow

1. Check runs → failure detected
2. If `verifyFailuresBeforeAlert` is enabled:
   - Wait `verificationDelayMs` (default 30s)
   - Re-run check
3. If failure confirmed → create Incident
4. Queue Pending Notification (NOT auto-sent)
5. Admin reviews notification → Approve → SES email sent

## Monitoring Frequency

Configurable per website: 5, 15, 30, or 60 minutes (default: 60).

The DO droplet cron runs every 5 minutes and checks all websites whose
last check is older than their configured frequency.

## Adding a Website

```bash
curl -X POST "https://parkgrader.com/api/admin/monitoring/websites?admin_key=<KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Example Campground",
    "domain": "example.com",
    "homepageUrl": "https://example.com",
    "bookingUrl": "https://example.com/book",
    "monitoringFrequency": 30
  }'
```

## Logs

On the droplet:
```bash
# App logs
pm2 logs parkgrader

# Monitoring cron log
tail -f /var/log/parkgrader-monitor.log
```
