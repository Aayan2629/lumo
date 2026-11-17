// Daily job: close stale matches and run the retention schedule. Run with
//   npm run jobs:daily
// or hit POST /api/cron/daily with the CRON_SECRET from a scheduler.
import { expireMatches, runRetention } from '../lib/jobs';

(async () => {
  console.log('expired matches:', await expireMatches());
  console.log('retention:', await runRetention());
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
