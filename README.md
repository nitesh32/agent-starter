# AgentDate

Agents date so you don't have to. Paste a LinkedIn URL and a public Instagram profile: an AI agent reads the person, goes on first dates with other people's agents on their behalf, and returns a ranking of best fits.

## Architecture

```
LinkedIn + Instagram ──► scrape (Apify) ──► analysis agent ──► profile (Postgres)
                                                                   │
        pre-score (tags/values/lifestyle) ◄────────────────────────┘
              │
              ▼
   pre-date intent ─► setting ─► turn-by-turn date ─► private debriefs ─► match score ─► ranking
                                      │
                                      └─► SSE (/api/stream) ─► live floor + replay
```

Layers: `routes/` (HTTP) → `repo.ts` / `pipeline.ts` / `dating.ts` (logic and data) → `llm.ts`, `scrape.ts`, `db.ts` (integrations). `views/` render HTML from plain data and never touch the DB.

## Pipeline
1. `POST /api/people` normalizes the URLs and queues the person (`queued → scraping → analyzing → ready | failed`).
2. LinkedIn and Instagram actors run in parallel. Private Instagram profiles and empty results fail with a clear message.
3. The analysis model produces a zod-validated profile: needs with quoted evidence, hobbies, values, personality, voice, tags.
4. A ready person is paired with existing ready people and the dates run.

## Agent harness
Each agent speaks as its person, in their voice, but is tasked with honestly testing fit.
1. **Candidate selection**: pre-score every pair (Jaccard on tags and values + lifestyle similarity), no LLM. Each person dates their top `DATES_PER_PERSON`; pairs are deduped.
2. **Pre-date intent**: each agent sees only the other's public card and writes what to find out, 3 questions and dealbreakers.
3. **Setting**: a concrete first date based on shared interests.
4. **The date**: `DATE_TURNS` alternating turns, one LLM call each; saved and streamed as they happen.
5. **Private debrief**: six dimension scores, overall, second-date yes/no, best moment, concerns, why.
6. **Score** = 0.5 · geometric mean(overall A, B) · 10 + 0.3 · avg dimension scores · 10 + 0.2 · pre-score · 100, +5 if both want a second date (mutual match), capped at 100.
7. **Ranking**: each person's dated partners sorted by score with their own agent's "why".

Finished dates are skipped on later rounds; pass `?force=1` to re-run.

## Scraping
Apify: `apify/instagram-profile-scraper` and `harvestapi/linkedin-profile-scraper`. These two profiles are the only data sources.

## Models (OpenRouter)
- Analysis: `anthropic/claude-sonnet-4.5` (quality matters, ~1 call per person)
- Dates: `google/gemini-2.5-flash` (cheap, fast, many calls)
- Fallback: `openai/gpt-4.1-mini` after 3 retries on 429/5xx
- Output caps: 2500 tokens analysis, 200 per date turn, 600 per debrief.

## Data model
`people` (raw + normalized sources, analysis, tags, status), `dates` (pair, setting, intents, verdicts, score), `date_turns` (transcript). Tables auto-migrate on boot. Live events are in-memory only.

## Run locally
```
cp .env.example .env   # fill APIFY_TOKEN, DATABASE_URL, OPENROUTER_API_KEY
npm install
npm run dev            # http://localhost:3000
npm run seed           # optional: process data/people.csv, then run a dating round
npm run check -- <ig_username> <linkedin_url>   # connection checks
```

## Deploy (Render)
Push the repo, create a Blueprint from `render.yaml`, and set `APIFY_TOKEN`, `DATABASE_URL` (Neon) and `OPENROUTER_API_KEY`. Health check is `/health`. State lives in Postgres; on boot, interrupted people and dates are resumed. The free tier sleeps when idle, so open the site once before recording.

## Assumptions and limitations
- Only the two profiles are used; Instagram must be public.
- Matching is orientation-agnostic because the sources don't reliably state it.
- Scores are agent opinions, not ground truth.
- Photos are copied into Postgres at scrape time, since Instagram CDN links expire.
- Jobs run in-process (no queue service); a restart resumes them but can repeat a call or two.

## Next steps
Auth and per-user privacy controls, opt-in consent flow, human feedback on matches, a real job queue, richer pre-scoring.
