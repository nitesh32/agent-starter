import "dotenv/config";

const num = (key: string, fallback: number) => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const config = {
  port: num("PORT", 3000),
  igActor: process.env.APIFY_IG_ACTOR || "apify/instagram-profile-scraper",
  linkedinActor: process.env.APIFY_LINKEDIN_ACTOR || "harvestapi/linkedin-profile-scraper",
  models: {
    analysis: process.env.OPENROUTER_MODEL_ANALYSIS || "anthropic/claude-sonnet-4.5",
    date: process.env.OPENROUTER_MODEL_DATE || "google/gemini-2.5-flash",
    fallback: process.env.OPENROUTER_MODEL_FALLBACK || "openai/gpt-4.1-mini",
  },
  datesPerPerson: num("DATES_PER_PERSON", 5),
  dateTurns: num("DATE_TURNS", 8),
  concurrency: num("CONCURRENCY", 4),
  scrapeConcurrency: num("SCRAPE_CONCURRENCY", 2), // each person runs 2 scrapers at once
};
