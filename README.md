# Levi Video Editor Portfolio — Full Stack

A full-stack version of the Levi / Aditya Verma portfolio concept with the cinematic editor-style timeline UI, SQLite backend, private admin dashboard, media uploads, project CMS, pricing/services management, inquiry inbox, analytics events, and a basic client review portal.

## Stack
- Node.js + Express 5
- SQLite + better-sqlite3
- Cookie-based JWT admin auth
- Multer uploads
- Static frontend (keeps the existing design direction)

## Run locally
1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Change `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
4. Run `npm install`.
5. Run `npm start`.
6. Open `http://localhost:3000`.
7. Admin: `http://localhost:3000/admin`

## First admin login
The values in `.env` seed the first owner account on first database initialization.

## What is connected
- Public site loads projects/services/pricing/settings from `/api/site`.
- Project cards open CMS-backed project detail data.
- Contact form submits to the private inquiry inbox.
- Analytics events are stored without storing raw IP (a short hash is stored).
- Admin can create/edit/delete projects and publish them.
- Admin can edit services/pricing/settings.
- Admin can upload media assets.
- Client review links can be generated from the admin API.

## Uploads
Uploaded files live under `/uploads` in this local build. For production, move large video files to object storage/CDN (for example S3-compatible storage or a video CDN) and keep only secure URLs/metadata in the database.

## Production hardening
Before public deployment, use HTTPS, a strong secret, a production-grade reverse proxy, external object/video storage, rate limiting, email delivery, CSRF protection where needed for any cross-site mutation, monitoring, off-site backups, and a managed PostgreSQL database if the project grows.
