const OUT="/private/tmp/claude-501/-Users-niteshsharma-git-personal-agent-starter/84341b60-6b87-4654-8028-4a8f82c3b4c3/scratchpad";
export default async function run(page){
  const res=[];
  for (const w of [1440,375]) {
    await page.setViewportSize({width:w,height:900});
    await page.goto(process.env.U||"http://localhost:3100/date/1",{waitUntil:"networkidle"});
    await page.waitForTimeout(500);
    res.push({w, overflowX: await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),
      clipped: await page.evaluate(()=>[...document.querySelectorAll(".card, .card *")].filter(e=>e.scrollWidth>e.clientWidth+1 && getComputedStyle(e).overflow!=="auto").length)});
    await (await page.$("h2:has-text('Private debriefs')")).scrollIntoViewIfNeeded();
    await page.screenshot({path:OUT+"/deb"+w+".png"});
  }
  return res;
}
