(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const page = document.body.dataset.page;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em class="act">$1</em>');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const api = async (url, opts = {}) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  };

  // ---- shared pieces ----
  function avatar(id, cls = "sm") {
    const p = (window.PEOPLE || {})[id] || { name: "?", photo: false };
    if (p.photo) return `<img class="avatar ${cls}" src="/photo/${id}" alt="" referrerpolicy="no-referrer">`;
    const hue = (id * 47) % 360;
    const ini = p.name.replace(/^@/, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    return `<span class="avatar ${cls}" style="background:hsl(${hue} 70% 88%);color:hsl(${hue} 50% 35%)">${esc(ini)}</span>`;
  }
  function bubble(speakerId, text, side) {
    const p = (window.PEOPLE || {})[speakerId] || { name: "?" };
    const el = document.createElement("div");
    el.className = `msg ${side}`;
    el.dataset.sid = speakerId;
    el.innerHTML = `${avatar(speakerId)}<div class="bubble"><div class="who">${esc(p.name)}</div>${fmt(text)}</div>`;
    return el;
  }
  function typing(speakerId, side) {
    const el = bubble(speakerId, "", side);
    el.querySelector(".bubble").innerHTML += '<div class="typing"><i></i><i></i><i></i></div>';
    return el;
  }
  function stream(onEvent) {
    const es = new EventSource("/api/stream");
    es.onmessage = (m) => onEvent(JSON.parse(m.data));
    return es;
  }
  function wireRunButton() {
    const btn = $("#run-round");
    if (!btn) return;
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        const { scheduled } = await api("/api/dates/run");
        btn.textContent = scheduled ? `Started ${scheduled} dates…` : "No new dates to run";
        if (scheduled && page !== "live") setTimeout(() => (location.href = "/live"), 900);
      } finally {
        setTimeout(() => { btn.disabled = false; btn.textContent = "♥ Run dating round"; }, 2500);
      }
    };
  }

  // ---- pages ----
  const pages = {
    home() {
      const form = $("#add");
      const msg = $("#formmsg");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button");
        btn.disabled = true;
        msg.className = "msgline";
        msg.textContent = "Creating agent…";
        try {
          const { id } = await api("/api/people", { body: JSON.stringify(Object.fromEntries(new FormData(form))) });
          location.href = `/person/${id}`;
        } catch (err) {
          msg.className = "msgline err";
          msg.textContent = err.message;
          btn.disabled = false;
        }
      };
      let t;
      stream((e) => {
        if (e.type !== "person") return;
        const card = $(`[data-person="${e.id}"]`);
        if (!card) return location.reload();
        const b = $("[data-status]", card);
        if (b) { b.className = `badge b-${e.status}`; b.textContent = e.status[0].toUpperCase() + e.status.slice(1); }
        if (e.status === "ready" || e.status === "failed") { clearTimeout(t); t = setTimeout(() => location.reload(), 500); }
      });
    },

    person() {
      const { id, status } = document.body.dataset;
      const retry = $("#retry");
      if (retry) retry.onclick = async () => { await api(`/api/people/${id}/retry`); location.reload(); };
      let t;
      stream((e) => {
        const mine = (e.type === "person" && String(e.id) === id) || e.type === "date_finished";
        if (!mine) return;
        clearTimeout(t);
        t = setTimeout(() => location.reload(), 600);
      });
    },

    date() {
      const { id, status } = document.body.dataset;
      const chat = $("#chat");
      const a = chat.dataset.a;
      const side = (sid) => (String(sid) === a ? "l" : "r");

      $("#replay").onclick = async (ev) => {
        const btn = ev.currentTarget;
        btn.disabled = true;
        const saved = [...chat.children];
        chat.innerHTML = "";
        for (const el of saved) {
          const t = typing(Number(el.dataset.sid), el.classList.contains("l") ? "l" : "r");
          chat.appendChild(t);
          t.scrollIntoView({ block: "center", behavior: "smooth" });
          await sleep(900 + Math.min(1500, el.textContent.length * 12));
          t.replaceWith(el);
          el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
        }
        btn.disabled = false;
      };

      if (status === "done" || status === "failed") return;
      stream((e) => {
        if (e.dateId !== Number(id)) return;
        if (e.type === "turn") {
          chat.appendChild(bubble(e.speakerId, e.text, side(e.speakerId)));
          $("#replay").disabled = false;
        } else if (e.type === "date_finished") setTimeout(() => location.reload(), 600);
      });
    },

    live() {
      const floor = $("#floor");
      const empty = $("#floor-empty");
      stream(async (e) => {
        if (e.type === "date_started") {
          if ($(`[data-date="${e.dateId}"]`)) return;
          const names = (id) => (window.PEOPLE[id] || { name: "…" }).name;
          if (!window.PEOPLE[e.aId] || !window.PEOPLE[e.bId]) {
            const people = await Promise.all([e.aId, e.bId].map((i) => fetch(`/api/people/${i}`).then((r) => r.json())));
            people.forEach((p) => (window.PEOPLE[p.id] = { name: p.name, photo: p.has_photo }));
          }
          const card = document.createElement("div");
          card.className = "card livecard";
          card.dataset.date = e.dateId;
          card.dataset.a = e.aId;
          card.innerHTML = `<div class="row spread" style="margin-bottom:10px"><div class="row">${avatar(e.aId)}<span class="grad">♥</span>${avatar(e.bId)}</div><span class="badge b-dating" data-status>On a date</span></div>
            <a href="/date/${e.dateId}"><b>${esc(names(e.aId))} &amp; ${esc(names(e.bId))}</b></a><div class="chat" style="margin-top:8px"></div>`;
          floor.prepend(card);
          empty.hidden = true;
        } else if (e.type === "turn") {
          const card = $(`[data-date="${e.dateId}"]`);
          if (!card) return;
          const chat = $(".chat", card);
          chat.appendChild(bubble(e.speakerId, e.text, String(e.speakerId) === card.dataset.a ? "l" : "r"));
          chat.scrollTop = chat.scrollHeight;
        } else if (e.type === "date_finished") {
          const card = $(`[data-date="${e.dateId}"]`);
          if (!card) return;
          const b = $("[data-status]", card);
          b.className = `badge ${e.failed ? "b-failed" : "b-done"}`;
          b.textContent = e.failed ? "Failed" : `Match ${Math.round(e.matchScore)}${e.mutual ? " ♥" : ""}`;
        }
      });
    },
  };

  wireRunButton();
  (pages[page] || (() => {}))();
})();
