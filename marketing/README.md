# SIGNAL — CuePoint Marketing Agency

Intense, conversion-first content engine for CuePoint Planning.

**Launch:** August 1, 2026  
**Cadence:** 3 posts/day (AM / MID / PM)  
**Offer:** First 50 DJs @ $20/mo → then $50/mo · 30-day free trial  

## Quick start

```bash
# from repo root — open Marketing HQ in the browser
npx --yes serve marketing -p 4177
# then visit http://localhost:4177
```

Or open `marketing/index.html` after a static server is running (fetch needs http). A bundled `content.embedded.js` is also loaded as fallback.

## What's inside

| Path | What |
|---|---|
| `AGENCY.md` | Voice, pillars, conversion rules |
| `index.html` | Marketing HQ — pick a day, copy captions |
| `content.json` | Source of truth for all posts |
| `creatives/BRIEFS.md` | Visual / Reel / Stories specs |
| `emails/LAUNCH-SEQUENCE.md` | 6-email launch nurture |
| `POSTING-CHECKLIST.md` | Daily publish ritual |

## CTA switch

- **Before Aug 1:** Join the launch list → cuepointplanning.com  
- **Aug 1+:** Start free trial → cuepointplanning.com/app#signup  

## Edit workflow

1. Change copy in `content.json`  
2. Re-run: `node marketing/scripts/embed-content.js` (or the one-liner in that file)  
3. Refresh HQ  
