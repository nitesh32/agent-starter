# AgentDate

Agents date so you don't have to. Give it a LinkedIn and a public Instagram for each person. An AI agent reads each person, goes on first dates with other people's agents in a multi-agent simulation, and every person gets a ranking of who fits them best.

The only two sources for any person are their **LinkedIn** and their **public Instagram**. Nothing else is searched.

## How it works

```
 LinkedIn + Instagram (per person)
            │  Apify actors, in parallel
            ▼
   normalize + store (Postgres)
            │
            ▼
   persona agent ──► profile page (needs, hobbies, interests, values, voice, evidence quotes)
            │
            ▼
   pre-score pairs (tags / values / lifestyle) ──► pick each person's closest matches
            │
            ▼
   ┌────────────── date harness (per pair) ──────────────┐
   │ private intent ─► setting ─► turn-by-turn date ─►   │
   │ private debrief (LLM-as-judge) ─► match score       │
   └──────────────────────────┬──────────────────────────┘
                              ▼
                  rankings ◄── live feed (SSE) / replay
```

### 1. Ingest
`POST /api/people` takes a LinkedIn URL and an Instagram handle or URL. Input is validated up front (a bare word is rejected), then both profiles are scraped in parallel. Private Instagram accounts and missing profiles fail with a clear message, and a failed person can fix their links and try again. Raw and normalized data are stored in Postgres.

### 2. Persona agent
`src/analyze.ts` sends the profile text plus up to four recent post images to Claude Sonnet 4.5 and asks for a structured object: needs (each with *why* and quoted evidence), hobbies, interests, values, personality sliders, lifestyle, career, communication style, what they are looking for, dealbreakers, green flags, a voice profile (tone, vocabulary, emoji use, sample lines), confidence and data gaps, plus lowercase tags for cheap matching. Output is validated with Zod and retried once on a bad response. Every claim has to quote its source, and the agent is told never to invent facts.

### 3. Date harness
`src/dating.ts` runs one date per pair:
1. **Pre-score** every pair with no model call: overlap of tags and values plus lifestyle similarity. Each person dates their closest `DATES_PER_PERSON` matches (pairs are de-duplicated).
2. **Private intent**: each agent sees only the other person's public card and writes what it wants to find out, three questions and its dealbreakers.
3. **Setting**: a concrete first date picked from shared interests.
4. **The date**: `DATE_TURNS` alternating turns, one model call each. Each agent gets its person's profile, voice, private intent, the setting and the transcript so far. `src/turns.ts` makes the chat feel real: every turn gets a different length target (a quick reaction up to a fuller reply), scene actions are allowed only occasionally and stripped otherwise, the opening is low-key, the last turns wind down, and a line cut off by the token cap is trimmed to a whole sentence. Turns are saved as they happen and streamed live.
5. **Private debrief**: each agent returns six dimension scores (values, lifestyle, interests, communication, life goals, chemistry), an overall score, whether it wants a second date, a best moment quote, concerns and a two-sentence "why".
6. **Match score** (0 to 100) = 0.5 · geometric mean of both overall scores · 10 + 0.3 · average dimension score · 10 + 0.2 · pre-score · 100, plus 5 if both want a second date (a **mutual match**), capped at 100.

Fit labels: **75 and above** is a strong fit, **55 to 74** a possible fit, below 55 a weak fit.

A pair that has already been dated is skipped on later rounds. `POST /api/dates/run?force=1` re-runs everything.

### 4. Rankings
For each person, the dates they have been on are sorted by match score, with their own agent's "why". `/rankings` also shows the top pairs overall.

## Pages
| Page | What it shows |
|---|---|
| `/` | Paste links, people with their results, and the Dates panel (what is waiting and the button to start it) |
| `/person/:id` | Profile (overview, evidence, dates and fit). While processing, live progress steps and skeletons |
| `/date/:id` | Chat transcript with avatars, Replay with typing indicators, private intents, six score bars per agent, final score and fit meter |
| `/live` | Dates in progress streaming in |
| `/rankings` | Top pairs overall and each person's best dates |
| `/about` | Flow diagram, step by step, guardrails, models and scoring |

## API
| Method and path | Purpose |
|---|---|
| `POST /api/people` | `{linkedin_url, instagram_url}` create a person and start processing |
| `GET /api/people`, `GET /api/people/:id` | list and read people |
| `GET /api/people/:id/ranking` | a person's dates ranked by score |
| `POST /api/people/:id/links` | fix the links of a failed person and retry |
| `POST /api/people/:id/retry` | retry a failed person |
| `POST /api/dates/run` | schedule every pair that has not been dated (`?force=1` re-runs all) |
| `GET /api/dates/:id` | one date with its transcript |
| `GET /api/stream` | Server-Sent Events: status changes, date started, turn added, date finished |
| `POST /api/seed` | process `data/people.csv` |
| `GET /health` | health check |

## Stack
- **Backend**: Node 20, TypeScript (ESM), Fastify, Postgres (Neon) via `pg`, `zod`, `p-limit`
- **Scraping**: Apify via `apify-client`, with `apify/instagram-profile-scraper` (public profiles only) and `harvestapi/linkedin-profile-scraper`
- **Models** via OpenRouter (OpenAI SDK): `anthropic/claude-sonnet-4.5` for analysis, `google/gemini-2.5-flash` for dates, `openai/gpt-4.1-mini` as the fallback after three retries
- **UI**: server-rendered HTML with Basecoat UI and the Tailwind browser build from CDNs, Geist font, Lucide icons (inlined). Small vanilla JS for live updates and replay. No build step for the front end
- **Images**: profile photos are resized with `sharp` at ingest and kept in Postgres, since Instagram image links expire

## Data model
`people` (links, raw and normalized sources, analysis, tags, status, photo), `dates` (pair, setting, intents, verdicts, score, mutual), `date_turns` (transcript). Tables are created on boot. Live events are in memory only, and the database is the source of truth.

## Run locally
```
cp .env.example .env     # fill APIFY_TOKEN, DATABASE_URL, OPENROUTER_API_KEY
npm install
npm run dev              # http://localhost:3000
npm run seed             # process data/people.csv, then run a dating round
npm run check -- <ig_username> <linkedin_url>   # connection checks
npm run build && npm start
```

### Environment
| Variable | Default | Purpose |
|---|---|---|
| `APIFY_TOKEN`, `DATABASE_URL`, `OPENROUTER_API_KEY` | none | required |
| `APIFY_IG_ACTOR`, `APIFY_LINKEDIN_ACTOR` | the actors above | scrapers |
| `OPENROUTER_MODEL_ANALYSIS`, `_DATE`, `_FALLBACK` | see Stack | models |
| `DATES_PER_PERSON` | 5 | how many closest matches each person dates |
| `DATE_TURNS` | 8 | turns per date |
| `CONCURRENCY` | 4 | parallel model calls and jobs |
| `PORT` | 3000 | server port |

## Deploy (Render)
Create a Blueprint from `render.yaml`, then set `APIFY_TOKEN`, `DATABASE_URL` and `OPENROUTER_API_KEY`. The health check is `/health`. All state is in Postgres, and interrupted people and dates are resumed on boot. Because seeding writes to the same database, run `npm run seed` locally first and the deployed site shows the finished example. The free tier sleeps when idle, so open the site once before using it.

## Assumptions and limitations
- Only the two profiles are used, and Instagram must be public.
- Matching is orientation-agnostic, because the sources do not reliably state it.
- Scores are model opinions from a simulation, not facts about compatibility.
- Each person's ranking only covers the people they have dated (their closest `DATES_PER_PERSON`). Raise it for fuller rankings, at the cost of more model calls.
- **There is no rate limiting or spending cap.** Anyone who can open the site can add profiles and start dating rounds, which spend Apify and OpenRouter credit. Set a credit limit on the OpenRouter key and keep the URL private if that matters.
- Jobs run inside the web process. A restart resumes them, but a call or two may repeat.
- The Tailwind browser build compiles styles in the browser, so there is a brief unstyled flash on first load.

## Next steps
Rate limits and auth, consent flow for the people being scraped, a real job queue, human feedback on matches, richer pre-scoring.
