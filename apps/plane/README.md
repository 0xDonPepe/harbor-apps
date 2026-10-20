# Plane

Plane is open-source project management: work items, cycles (sprints), modules, pages (docs), intake and
analytics, with Kanban, list, calendar, spreadsheet and Gantt views. This is Plane Community Edition.

- Website: https://plane.so/
- Source code: https://github.com/makeplane/plane
- Help: https://docs.plane.so/ and https://github.com/makeplane/plane/issues

## First start

The first start takes a few minutes: Plane runs its database migrations before it answers. Then open Plane,
choose **Get started** and set up the instance in **God mode** (`/god-mode/`): the first account you create there is
the instance administrator. Sign in and create your first workspace. Email (SMTP), sign-in methods and other
instance settings are in God mode as well.

## Use its main address

Plane sends you back to its main address after signing in, builds the links in its emails from it and accepts its
sign-in cookies only there. Open it at the address Harbor shows as its main one; if you change the main address
(publishing it on Tailscale or a domain and making that the main address), Harbor hands Plane the new one when it
restarts the app.

## What runs

Thirteen services from Plane's own self-host setup: the proxy (Plane's Caddy), the web app, Spaces (public boards),
the God mode admin, the live (real-time) server, the API, a worker and a scheduler, PostgreSQL, Valkey (a cache, not
kept across restarts), RabbitMQ (background tasks) and MinIO (uploaded files). Harbor generates every password and
key. Plane's one-shot migrator runs as the first step of the API instead of as a service of its own.

Uploads are limited to 5 MB per file (Plane's default).
