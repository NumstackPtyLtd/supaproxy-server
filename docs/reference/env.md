# Environment Variables

Environment variables used by SupaProxy. Most configuration (API credentials, bot tokens) is stored in the database via the Settings page, not in environment variables.

## Backend

| Variable | Required | Default | Description |
|---|---|---|---|
| PORT | no | 3001 | Backend server port |
| DB_HOST | no | 127.0.0.1 | Database host |
| DB_PORT | no | 3306 | Database port |
| DB_USER | no | root | Database user |
| DB_PASSWORD | yes (prod) | dev default | Database password. Must be changed in production |
| DB_NAME | no | reclaim | Database name |
| JWT_SECRET | yes (prod) | dev default | Secret for signing JWT session tokens. Must be changed in production |
| AI_PROVIDER_KEY | yes* | - | AI provider API key for the agent loop. Can also be set via Settings > Integrations in the dashboard |

\* `AI_PROVIDER_KEY` is only required when processing queries. The dashboard and workspace management work without it.

## Frontend

| Variable | Required | Default | Description |
|---|---|---|---|
| SUPAPROXY_API_URL | no | http://localhost:3001 | URL of the backend API |

## What is NOT in environment variables

These are stored in the database (org settings table) and managed via the Settings page:

- **Messaging bot token** -- Settings > Integrations > Messaging bot
- **Messaging app token** -- Settings > Integrations > Messaging bot
- **AI provider API key** -- Settings > Integrations > AI Provider

This means secrets are not in config files, can be rotated from the UI, and are scoped to the organisation.

## Configuration file locations

| File | Purpose | Committed? |
|---|---|---|
| Backend .env | Database connection, JWT secret | No (gitignored) |
| Frontend .env | API URL | No (gitignored) |

Never commit environment files containing secrets.
