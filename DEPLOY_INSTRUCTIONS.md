# Deployment Instructions

## Database Setup
This application uses Prisma with a PostgreSQL database.
When deploying to Render or any other platform, you MUST ensure the database schema is synchronized.

### Environment Variables
Ensure the following environment variables are set in your Render Dashboard:
- `DATABASE_URL`: The connection string to your PostgreSQL database.
- `SESSION_SECRET`: A secret key for session management.
- `REDIS_URL` or `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: Connection details for Redis.

### Build Command
The build command in `package.json` is configured to automatically push the database schema:
```bash
npm install && npx prisma generate && npx prisma db push
```
(Note: `package.json` defines "build" as `npx prisma generate && npx prisma db push`. Render usually runs `npm install` before the build command).

**Important:** `npx prisma db push` requires a valid `DATABASE_URL`. If the database password or host is incorrect, the build will fail.

## Troubleshooting
If the deployment fails:
1. Check the Render logs.
2. If you see an error related to `prisma db push`, verify your `DATABASE_URL`.
3. If you see "Authentication failed", check your database password.
