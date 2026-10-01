(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const page = document.body.dataset.page;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em class="act">$1</em>');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const api = async (url, opts = {}) => {
    const headers = opts.body ? { "Content-Type": "application/json" } : {};
    const res = await fetch(url, { method: "POST", headers, ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  };

  // ---- shared pieces ----
  // Mirrors avatar() in src/views/ui.ts (Basecoat avatar).
  function avatar(id, size = "md") {
    const p = (window.PEOPLE || {})[id] || { name: "?", photo: false };
    const ini = p.name.replace(/^@/, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    const img = p.photo ? `<img src="/photo/${id}" alt="" width="48" height="48" decoding="async" referrerpolicy="no-referrer">` : "";
    return `<span class="avatar" data-size="${size}">${img}<span>${esc(ini)}</span></span>`;
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
  const toast = (category, title, description, action) => {
    const t = document.getElementById("toaster");
    if (t && t.toast) t.toast({ category, title, description, action, duration: action ? 6000 : undefined });
  };
  function setBusy(btn, busy, label) {
    btn.disabled = busy;
    btn.setAttribute("aria-busy", String(busy));
    if (label) btn.lastChild.textContent = label;
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
      const label = btn.lastChild.textContent;
      setBusy(btn, true, "Starting…");
      try {
        const { scheduled } = await api("/api/dates/run");
        btn.lastChild.textContent = scheduled ? `Started ${scheduled} dates` : "No new dates to run";
        toast(scheduled ? "success" : "info", scheduled ? `Started ${scheduled} dates` : "Nothing to run", scheduled ? "Opening the live floor." : "Every pairing has already been dated.");
        if (scheduled && page !== "live") setTimeout(() => (location.href = "/live"), 900);
      } catch (err) {
        btn.lastChild.textContent = "Couldn't start. Try again";
        toast("error", "Couldn't start the dating round", err.message);
      } finally {
        setTimeout(() => setBusy(btn, false, label), 2500);
      }
    };
  }

  // ---- pages ----
  const pages = {
    home() {
      const form = $("#add");
      const msg = $("#formmsg");

      // Re-fetch the parts of the page that change while agents work, and swap them in place.
      let timer;
      const refreshHome = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          try {
            const r = await fetch("/fragments/home");
            if (!r.ok) return;
            const d = await r.json();
            $("#people-block").innerHTML = d.block;
            $("#people-count").textContent = d.count;
            $("#dating-panel").innerHTML = d.panel;
            wireRunButton();
          } catch {}
        }, 300);
      };
      const highlight = (id) => {
        const card = $(`[data-person="${id}"]`);
        if (!card) return;
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.style.outline = "2px solid var(--primary)";
        setTimeout(() => (card.style.outline = ""), 2200);
      };

      form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button");
        form.querySelectorAll("input").forEach((i) => i.removeAttribute("aria-invalid"));
        msg.textContent = "";
        const empty = [...form.querySelectorAll("input")].find((i) => !i.value.trim());
        if (empty) {
          empty.setAttribute("aria-invalid", "true");
          empty.focus();
          msg.textContent = "Please fill in both fields.";
          return;
        }
        setBusy(btn, true, "Creating agent…");
        try {
          const { id, existing } = await api("/api/people", { body: JSON.stringify(Object.fromEntries(new FormData(form))) });
          form.reset();
          await (async () => {
            const r = await fetch("/fragments/home");
            if (r.ok) {
              const d = await r.json();
              $("#people-block").innerHTML = d.block;
              $("#people-count").textContent = d.count;
              $("#dating-panel").innerHTML = d.panel;
              wireRunButton();
            }
          })();
          highlight(id);
          const open = { label: "Open profile", href: `/person/${id}` };
          if (existing) toast("info", "Already added", "Highlighted in the list.", open);
          else toast("success", "Agent added", "Reading their profiles now.", open);
          setBusy(btn, false, "Create agent");
        } catch (err) {
          msg.textContent = err.message;
          toast("error", "Couldn't add the agent", err.message);
          setBusy(btn, false, "Create agent");
        }
      };

      stream((e) => {
        if (e.type === "person" || e.type === "date_finished") refreshHome();
      });
    },

    person() {
      const { id, status } = document.body.dataset;
      const relink = $("#relink");
      if (relink) {
        relink.onsubmit = async (e) => {
          e.preventDefault();
          const msg = $("#relink-msg");
          const btn = relink.querySelector("button");
          msg.textContent = "";
          setBusy(btn, true, "Checking…");
          try {
            await api(`/api/people/${id}/links`, { body: JSON.stringify(Object.fromEntries(new FormData(relink))) });
            toast("success", "Trying again", "Reading the corrected profiles now.");
            setTimeout(() => location.reload(), 600);
          } catch (err) {
            msg.textContent = err.message;
            setBusy(btn, false, "Fix and try again");
          }
        };
      }
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
        chat.setAttribute("aria-live", "off");
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
        chat.setAttribute("aria-live", "off");
      };

      if (status === "done" || status === "failed") return;
      stream((e) => {
        if (e.dateId !== Number(id)) return;
        if (e.type === "turn") {
          $("#chat-wait")?.remove();
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
          const card = document.createElement("li");
          card.className = "card";
          card.dataset.date = e.dateId;
          card.dataset.a = e.aId;
          card.innerHTML = `<section class="grid gap-2"><div class="flex items-center justify-between"><div class="flex items-center gap-2">${avatar(e.aId)}<span class="text-primary">${window.ICONS.heart}</span>${avatar(e.bId)}</div><span class="badge status s-dating" data-status>On a date</span></div>
            <a class="font-medium hover:underline" href="/date/${e.dateId}">${esc(names(e.aId))} and ${esc(names(e.bId))}</a><div class="chat" role="log" aria-live="polite"></div></section>`;
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
          b.className = `badge status ${e.failed ? "s-failed" : "s-done"}`;
          b.textContent = e.failed ? "Failed" : `Match ${Math.round(e.matchScore)}${e.mutual ? " · mutual" : ""}`;
        }
      });
    },
  };

  wireRunButton();
  (pages[page] || (() => {}))();
})();
