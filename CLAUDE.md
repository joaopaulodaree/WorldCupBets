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

### Cron sync (via cron-job.org — every 5min)
All cron endpoints use GET with `Authorization: Bearer $CRON_SECRET` header.
Register the following 3 jobs in cron-job.org (every 5 min):

1. `https://worldcupbets-app.vercel.app/api/cron/sync-results`
   - Syncs group match scores + upserts knockout_matches from worldcup26.ir API

2. `https://worldcupbets-app.vercel.app/api/cron/sync-group-points`
   - Calculates group position points (runs after all group matches finish)

3. `https://worldcupbets-app.vercel.app/api/cron/sync-bracket-points`
   - Scores bracket picks when knockout_matches.winner_team_id is set

Required env var: `CRON_SECRET` (set in Vercel project settings)
