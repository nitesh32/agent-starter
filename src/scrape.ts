import sharp from "sharp";
import { config } from "./config.js";
import { runActor } from "./apify.js";

export interface IgPost {
  caption: string;
  hashtags: string[];
  type: string;
  likes: number;
  timestamp: string;
  location: string;
  imageUrl: string;
}
export interface IgProfile {
  username: string;
  fullName: string;
  bio: string;
  followers: number;
  following: number;
  postsCount: number;
  profilePic: string;
  isPrivate: boolean;
  externalUrl: string;
  latestPosts: IgPost[];
}
export interface LinkedInProfile {
  name: string;
  headline: string;
  location: string;
  about: string;
  experience: { title: string; company: string; dates: string; description: string }[];
  education: { school: string; degree: string; dates: string }[];
  skills: string[];
  languages: string[];
  volunteering: string[];
  certifications: string[];
  profilePic: string;
}
export type Progress = Record<"linkedin" | "instagram", "running" | "done" | "failed">;

const txt = (v: any): string => {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return txt(v.text ?? v.name ?? v.linkedinText ?? v.url ?? "");
};
const list = (v: any): any[] => (Array.isArray(v) ? v : []);
const names = (v: any) => list(v).map(txt).filter(Boolean);

export function normalizeIgUsername(input: string): string {
  let s = input.trim().replace(/^@/, "");
  if (/instagram\.com/i.test(s)) {
    s = new URL(/^https?:/i.test(s) ? s : `https://${s}`).pathname.split("/").filter(Boolean)[0] ?? "";
  }
  s = s.split(/[/?#]/)[0].replace(/^@/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(s)) throw new Error("Enter an Instagram @handle or profile link, like @username or instagram.com/username.");
  return s.toLowerCase();
}

export function normalizeLinkedInUrl(input: string): string {
  const s = input.trim();
  const m = s.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  if (!m || m[1].length < 3) {
    throw new Error("Paste the full LinkedIn profile link, like linkedin.com/in/username.");
  }
  return `https://www.linkedin.com/in/${m[1]}`;
}

function normIg(r: any): IgProfile {
  return {
    username: txt(r.username),
    fullName: txt(r.fullName),
    bio: txt(r.biography),
    followers: Number(r.followersCount ?? 0),
    following: Number(r.followsCount ?? 0),
    postsCount: Number(r.postsCount ?? 0),
    profilePic: txt(r.profilePicUrlHD || r.profilePicUrl),
    isPrivate: Boolean(r.private ?? r.isPrivate),
    externalUrl: txt(r.externalUrl ?? list(r.externalUrls)[0]),
    latestPosts: list(r.latestPosts)
      .slice(0, 12)
      .map((p) => ({
        caption: txt(p.caption),
        hashtags: names(p.hashtags),
        type: txt(p.type),
        likes: Number(p.likesCount ?? 0),
        timestamp: txt(p.timestamp),
        location: txt(p.locationName),
        imageUrl: txt(p.displayUrl),
      })),
  };
}

function normLinkedIn(r: any): LinkedInProfile {
  const range = (o: any) =>
    txt(o.duration) || [txt(o.startDate), txt(o.endDate)].filter(Boolean).join(" – ") || txt(o.period);
  return {
    name: [txt(r.firstName), txt(r.lastName)].filter(Boolean).join(" ") || txt(r.fullName ?? r.name),
    headline: txt(r.headline),
    location: txt(r.location),
    about: txt(r.about ?? r.summary),
    experience: list(r.experience).map((e) => ({
      title: txt(e.position ?? e.title),
      company: txt(e.companyName ?? e.company),
      dates: range(e),
      description: txt(e.description),
    })),
    education: list(r.education).map((e) => ({
      school: txt(e.schoolName ?? e.school),
      degree: [txt(e.degree), txt(e.fieldOfStudy)].filter(Boolean).join(", "),
      dates: range(e),
    })),
    skills: names(r.skills),
    languages: names(r.languages),
    volunteering: list(r.volunteering).map((v) => [txt(v.role ?? v.title), txt(v.organizationName ?? v.company)].filter(Boolean).join(" @ ")).filter(Boolean),
    certifications: list(r.certifications).map((c) => txt(c.title ?? c.name ?? c)).filter(Boolean),
    profilePic: txt(r.photo ?? r.profilePicture ?? r.profilePic),
  };
}

export interface Scraped {
  linkedin: { raw: unknown; norm: LinkedInProfile };
  instagram: { raw: unknown; norm: IgProfile };
}

export async function scrapePerson(
  linkedinUrl: string,
  igUsername: string,
  onProgress: (p: Progress) => void,
): Promise<Scraped> {
  const progress: Progress = { linkedin: "running", instagram: "running" };
  const set = (k: keyof Progress, v: Progress[keyof Progress]) => {
    progress[k] = v;
    onProgress({ ...progress });
  };
  onProgress({ ...progress });

  const fail = (k: keyof Progress, message: string): never => {
    set(k, "failed");
    throw new Error(message);
  };

  const li = (async () => {
    let items: unknown[];
    try {
      items = await runActor(config.linkedinActor, { urls: [linkedinUrl], profileScraperMode: "Profile details no email ($4 per 1k)" });
    } catch (e) {
      return fail("linkedin", `We couldn't reach LinkedIn right now (${(e as Error).message}). Try again in a minute.`);
    }
    const raw: any = items[0];
    const norm = raw && !raw.error ? normLinkedIn(raw) : null;
    if (!norm || (!norm.name && !norm.headline)) {
      return fail("linkedin", "We couldn't find that LinkedIn profile. Check the link and make sure the profile is public.");
    }
    set("linkedin", "done");
    return { raw, norm };
  })();

  const ig = (async () => {
    let items: unknown[];
    try {
      items = await runActor(config.igActor, { usernames: [igUsername] });
    } catch (e) {
      return fail("instagram", `We couldn't reach Instagram right now (${(e as Error).message}). Try again in a minute.`);
    }
    const raw: any = items[0];
    if (!raw?.username) return fail("instagram", `We couldn't find the Instagram profile @${igUsername}. Check the handle.`);
    const norm = normIg(raw);
    if (norm.isPrivate) return fail("instagram", `@${igUsername} is a private Instagram account. Only public profiles can be used.`);
    set("instagram", "done");
    return { raw, norm };
  })();

  const [l, i] = await Promise.allSettled([li, ig]);
  if (l.status === "rejected" || i.status === "rejected") {
    throw new Error([l, i].filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => r.reason.message).join(" "));
  }
  return { linkedin: l.value, instagram: i.value };
}

const PHOTO_PX = 256; // 2x the largest avatar we render (96px xl) for retina screens

/** Downscale to a small square WebP: typically 5-15KB instead of hundreds of KB. */
export async function optimizePhoto(input: Buffer): Promise<{ data: Buffer; type: string }> {
  const data = await sharp(input).rotate().resize(PHOTO_PX, PHOTO_PX, { fit: "cover", position: "attention" }).webp({ quality: 80 }).toBuffer();
  return { data, type: "image/webp" };
}

export async function fetchPhoto(url: string): Promise<{ data: Buffer; type: string } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    return await optimizePhoto(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}
