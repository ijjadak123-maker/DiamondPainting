# Prism Patch Backend Deployment

The production API URL is:

```text
https://api.prismpatch.app/api
```

The same hosted service also serves the required public legal pages:

```text
https://api.prismpatch.app/legal/privacy.html
https://api.prismpatch.app/legal/support.html
https://api.prismpatch.app/legal/terms.html
https://api.prismpatch.app/legal/community-guidelines.html
```

## What Is Ready

- The backend listens on `PORT`, which hosting providers set automatically.
- `GET /api/health` is available for health checks.
- Production refuses to start unless `PRISM_PATCH_SECRET` is set.
- CORS allows the iOS Capacitor app origin and `https://api.prismpatch.app`.
- A fresh hosted server creates the starting JSON database if `data/db.json` is missing.
- `render.yaml` is included for a Render web service with a persistent disk mounted at `data/`.
- `Dockerfile` is included for providers that prefer Docker.

## Render Deployment

1. Push this project to GitHub.
2. In Render, create a new Blueprint or Web Service from the repository.
3. Use these settings if creating the service manually:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/api/health`
   - Environment variable: `NODE_ENV=production`
   - Environment variable: `PRISM_PATCH_SECRET=<long random secret>`
   - Environment variable: `ALLOWED_ORIGINS=capacitor://localhost,ionic://localhost,https://api.prismpatch.app`
   - Persistent disk mount path: `/opt/render/project/src/data`
4. Add the custom domain `api.prismpatch.app` to the Render service.
5. In your domain DNS settings, create the DNS record Render gives you for `api.prismpatch.app`.
6. Wait for Render to issue the HTTPS certificate.
7. Confirm these open:

```text
https://api.prismpatch.app/api/health
https://api.prismpatch.app/legal/privacy.html
https://api.prismpatch.app/legal/support.html
```

Expected response:

```json
{"ok":true,"app":"Prism Patch"}
```

## App Store Note

The iOS app is already configured to call `https://api.prismpatch.app/api`. Until the domain is live, the app will use device-local accounts and storage so it remains usable for testing.
