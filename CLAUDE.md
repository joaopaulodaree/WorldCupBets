@AGENTS.md

## Deploy Configuration (configured by /setup-deploy)
- Platform: Vercel (Hobby)
- Production URL: https://worldcupbets-app.vercel.app
- Deploy workflow: auto-deploy on push to main via `vercel --prod`
- Project: joaopaulodarees-projects/worldcupbets-app
- Merge method: squash
- Project type: Next.js web app
- Post-deploy health check: https://worldcupbets-app.vercel.app

### Custom deploy hooks
- Pre-merge: `npm run build` (type check + build verification)
- Deploy trigger: `vercel --prod` (or automatic via git push if connected)
- Deploy status: `vercel ls --prod`
- Health check: `curl -sf -L https://worldcupbets-app.vercel.app -o /dev/null -w "%{http_code}"`

### Cron sync (results every 5min)
- Handled by GitHub Actions: `.github/workflows/sync-results.yml`
- Endpoint: `/api/cron/sync-results` with `Authorization: Bearer $CRON_SECRET`
- Required GitHub secrets: `CRON_SECRET`, `APP_URL=https://worldcupbets-app.vercel.app`
