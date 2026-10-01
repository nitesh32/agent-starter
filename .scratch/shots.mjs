const OUT = "/private/tmp/claude-501/-Users-niteshsharma-git-personal-agent-starter/84341b60-6b87-4654-8028-4a8f82c3b4c3/scratchpad";
export default async function run(page) {
  const pages = ["/", "/person/2", "/date/1", "/rankings", "/live", "/about", "/nope"];
  const report = [];
  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "no-preference" });
    for (const w of [375, 768, 1440]) {
      await page.setViewportSize({ width: w, height: 900 });
      for (const path of pages) {
        await page.goto("http://localhost:3100" + path, { waitUntil: "load" });
        await page.waitForTimeout(250);
        const m = await page.evaluate(() => ({
          overflowX: document.documentElement.scrollWidth > window.innerWidth,
          smallTargets: [...document.querySelectorAll("a,button,input,summary")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 44 - 0.5) && !e.closest(".listrow") && !e.classList.contains("skip"); }).map((e) => (e.textContent || e.name || "").trim().slice(0, 20) + ":" + Math.round(e.getBoundingClientRect().height)).slice(0, 6),
          imgNoAlt: document.querySelectorAll("img:not([alt])").length,
        }));
        report.push({ scheme, w, path, ...m });
        if ((w === 375 || w === 1440) && ["/", "/person/2", "/date/1", "/about"].includes(path) || (scheme === "dark" && w === 1440) || path === "/nope" && w === 375 && scheme === "light" || path === "/live" && w === 1440 && scheme === "light")
          await page.screenshot({ path: `${OUT}/${scheme}-${w}-${path.replace(/\W+/g, "_")}.png`, fullPage: false });
      }
    }
  }
  return report.filter((r) => r.overflowX || r.smallTargets.length || r.imgNoAlt);
}
