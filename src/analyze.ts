import { z } from "zod";
import { config } from "./config.js";
import { chatJSON, type ChatMessage } from "./llm.js";
import type { IgProfile, LinkedInProfile } from "./scrape.js";

const str = z.string().catch("");
const num = (d: number) => z.coerce.number().min(0).max(10).catch(d);
const strs = z.array(z.string()).catch([]);
const obj = <S extends z.ZodRawShape>(s: S) => z.preprocess((v) => v ?? {}, z.object(s));

const evidence = z
  .array(z.object({ source: z.enum(["linkedin", "instagram"]).catch("instagram"), quote: z.string() }))
  .catch([]);
const named = z.array(z.object({ name: z.string(), evidence })).catch([]);

export const analysisSchema = z.object({
  summary: z.string().min(10),
  headline_tagline: z.string().min(3),
  needs: z.array(z.object({ need: z.string(), why: str, evidence })).catch([]),
  hobbies: named,
  interests: named,
  values: strs,
  personality: obj({
    traits: strs,
    introvert_extrovert: num(5),
    adventurous: num(5),
    ambition: num(5),
    humor_style: str,
  }),
  lifestyle: obj({ pace: str, social_life: str, travel: str, fitness: str, city: str }),
  career: obj({ stage: str, field: str, ambition_notes: str }),
  communication_style: str,
  love_language_guess: str,
  looking_for: str,
  dealbreakers: strs,
  green_flags: strs,
  red_flags_for_others: strs,
  ideal_first_date: str,
  conversation_starters: strs,
  voice: obj({ tone: str, vocabulary: str, emoji_use: str, sample_lines: strs }),
  confidence: z.coerce.number().min(0).max(1).catch(0.5),
  data_gaps: strs,
  tags: strs,
});
export type Analysis = z.output<typeof analysisSchema>;

const SYSTEM = `You are a perceptive matchmaker. You only know what is in this person's LinkedIn and Instagram. Infer carefully, never invent. Every claim must cite evidence.

Return one JSON object with exactly these keys:
summary (3 sentences), headline_tagline (fun one-liner), needs[] ({need, why, evidence:[{source:"linkedin"|"instagram", quote}]}) covering emotional/relational needs,
hobbies[] ({name, evidence:[...]}), interests[] ({name, evidence:[...]}), values[] (strings),
personality {traits[], introvert_extrovert (0-10, 0=introvert), adventurous (0-10), ambition (0-10), humor_style},
lifestyle {pace, social_life, travel, fitness, city}, career {stage, field, ambition_notes},
communication_style, love_language_guess, looking_for (ideal partner, inferred), dealbreakers[], green_flags[], red_flags_for_others[],
ideal_first_date, conversation_starters[],
voice {tone, vocabulary, emoji_use, sample_lines[3]} (how this person talks, based on captions/about; sample_lines are short lines they could say),
confidence (0-1), data_gaps[] (what you could not tell),
tags[] (lowercase single/short keywords drawn from hobbies, interests, values and field, for cheap matching; 10-20 items).
Evidence quotes must be short, verbatim snippets from the provided data. Do not guess gender or sexual orientation.
Be concise: output is hard-capped at ~2500 tokens, so keep every string short (one sentence max), use at most 4 items per list (2 evidence quotes max each), and never exceed the cap or the JSON will be cut off.`;

function brief(li: LinkedInProfile, ig: IgProfile) {
  return JSON.stringify({
    linkedin: { ...li, experience: li.experience.slice(0, 8).map((e) => ({ ...e, description: e.description.slice(0, 400) })), about: li.about.slice(0, 2000), profilePic: undefined },
    instagram: {
      username: ig.username, fullName: ig.fullName, bio: ig.bio, followers: ig.followers, following: ig.following,
      postsCount: ig.postsCount, externalUrl: ig.externalUrl,
      posts: ig.latestPosts.map((p) => ({ caption: p.caption.slice(0, 400), hashtags: p.hashtags, type: p.type, likes: p.likes, timestamp: p.timestamp, location: p.location })),
    },
  });
}

export async function analyze(li: LinkedInProfile, ig: IgProfile): Promise<Analysis> {
  const text = `Here is everything known about this person:\n${brief(li, ig)}`;
  const images = ig.latestPosts.map((p) => p.imageUrl).filter(Boolean).slice(0, 4);
  const withImages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        { type: "text", text: text + "\n\nThe attached images are some of their recent Instagram posts." },
        ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
      ],
    },
  ];
  const textOnly: ChatMessage[] = [{ role: "system", content: SYSTEM }, { role: "user", content: text }];

  let result: Analysis;
  try {
    result = await chatJSON(config.models.analysis, images.length ? withImages : textOnly, analysisSchema, { label: "analyze", maxTokens: 2500, timeoutMs: 120_000 });
  } catch (e) {
    if (!images.length) throw e;
    console.warn(`[analyze] image input failed (${(e as Error).message}); retrying text-only`);
    result = await chatJSON(config.models.analysis, textOnly, analysisSchema, { label: "analyze-text", maxTokens: 2500, timeoutMs: 120_000 });
  }
  const tags = [...result.tags, ...result.hobbies.map((h) => h.name), ...result.interests.map((i) => i.name), ...result.values, result.career.field]
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length > 1);
  result.tags = [...new Set(tags)];
  return result;
}
