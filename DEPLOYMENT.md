# Production deployment checklist

1. Use a managed server/container platform.
2. Set NODE_ENV=production and strong JWT_SECRET.
3. Put the app behind HTTPS.
4. Use persistent storage for SQLite only for small deployments; otherwise move to PostgreSQL.
5. Put video/image uploads on object storage or a video CDN.
6. Add rate limiting and email notifications.
7. Configure automated database/media backups.
8. Use a domain such as your preferred portfolio domain.
9. Keep `/admin` protected and use a unique admin password + 2FA at the infrastructure layer if supported.
