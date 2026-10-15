import "./styles.css";
import type { Format, PromptEntry, Variable } from "./types.ts";

const modules = import.meta.glob<PromptEntry>("../prompts/*.json", { eager: true, import: "default" });
const ENTRIES = Object.values(modules).sort(
  (a, b) => Number(!!b.example) - Number(!!a.example) || a.title.localeCompare(b.title, "ru"),
);

const FORMAT_LABEL: Record<Format, string> = { svg: "SVG", html: "HTML", webgl: "WebGL" };
const SIZE_LABEL = { figure: "Figure", hero: "Hero" } as const;
const THUMB_W = 900;
const THUMB_H = 562;

const app = document.getElementById("app")!;

// ─── утилиты ────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function store(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {}
  return null;
}

function currentTheme(): "dark" | "light" {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function exampleUrl(e: PromptEntry): string | null {
  if (!e.example) return null;
  const path = currentTheme() === "light" && e.example.light ? e.example.light : e.example.dark;
  return import.meta.env.BASE_URL + path;
}

function fill(e: PromptEntry, values: Record<string, string>): string {
  return e.prompt.replace(/\{([a-zA-Z0-9]+)\}/g, (m, name: string) => {
    const v = values[name]?.trim();
    if (v) return v;
    return e.variables.find((x) => x.name === name)?.default ?? m;
  });
}

function defaults(e: PromptEntry): Record<string, string> {
  return Object.fromEntries(e.variables.map((v) => [v.name, v.default]));
}

async function copy(text: string, btn: HTMLElement) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  const label = btn.querySelector("span") ?? btn;
  const was = label.textContent;
  label.textContent = "Скопировано";
  btn.classList.add("done");
  setTimeout(() => {
    label.textContent = was;
    btn.classList.remove("done");
  }, 1400);
}

const COPY_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;

function badges(e: PromptEntry): string {
  return `<span class="badge fmt-${e.format}">${FORMAT_LABEL[e.format]}</span><span class="badge">${SIZE_LABEL[e.size]}</span>${e.animated ? `<span class="badge">анимация</span>` : ""}`;
}

function placeholder(e: PromptEntry): string {
  return `<div class="ph"><svg viewBox="0 0 120 80" aria-hidden="true"><path d="M60 14 98 34 60 54 22 34z" class="ph-top"/><path d="M22 34v14l38 20V54z" class="ph-l"/><path d="M98 34v14L60 68V54z" class="ph-r"/></svg><span>Примера пока нет — сгенерируйте его через <code>/visual-prompt add ${esc(e.id)}</code></span></div>`;
}

// ─── превью в карточках: ленивые iframe, масштаб под ширину ─────

const thumbs = new IntersectionObserver(
  (items) => {
    for (const it of items) {
      const frame = it.target.querySelector("iframe")!;
      const src = (it.target as HTMLElement).dataset.src!;
      if (it.isIntersecting) {
        if (frame.getAttribute("src") !== src) frame.setAttribute("src", src);
      } else if (frame.getAttribute("src")) {
        frame.removeAttribute("src"); // выгружаем тяжёлые сцены вне экрана
      }
    }
  },
  { rootMargin: "200px" },
);

const resizer = new ResizeObserver((items) => {
  for (const it of items) {
    (it.target as HTMLElement).style.setProperty("--scale", String(it.contentRect.width / THUMB_W));
  }
});

// ─── список ─────────────────────────────────────────────

interface Filters {
  q: string;
  format: Format | "all";
  category: string;
  tag: string;
  withExample: boolean;
}

const filters: Filters = { q: "", format: "all", category: "", tag: "", withExample: false };

function matches(e: PromptEntry, f: Filters): boolean {
  if (f.format !== "all" && e.format !== f.format) return false;
  if (f.category && e.category !== f.category) return false;
  if (f.tag && !e.tags.includes(f.tag)) return false;
  if (f.withExample && !e.example) return false;
  if (f.q) {
    const hay = [e.title, e.summary, e.category, e.prompt, ...e.tags].join(" ").toLowerCase();
    return f.q
      .toLowerCase()
      .split(/\s+/)
      .every((w) => hay.includes(w));
  }
  return true;
}

function renderList() {
  document.title = "Anatomy Prompts";
  const categories = [...new Set(ENTRIES.map((e) => e.category))].sort((a, b) => a.localeCompare(b, "ru"));
  const tags = [...new Set(ENTRIES.flatMap((e) => e.tags))].sort((a, b) => a.localeCompare(b, "ru"));
  const count = (f: Format | "all") => ENTRIES.filter((e) => f === "all" || e.format === f).length;

  app.innerHTML = `
    <section class="hero">
      <h1>Промты для <code>/anatomy</code></h1>
      <p>Готовые задания для Claude: фигура, которая объясняет идею как настоящий механизм — изометрический SVG, интерактивный HTML или сцена с WebGL. Выберите промт, подставьте свои числа, скопируйте и вставьте в Claude Code.</p>
    </section>
    <section class="toolbar" aria-label="Фильтры">
      <input class="search" type="search" placeholder="Поиск: кэш, вода, очередь…" value="${esc(filters.q)}" aria-label="Поиск" />
      <div class="seg" role="radiogroup" aria-label="Формат">
        ${(["all", "svg", "html", "webgl"] as const)
          .map(
            (f) =>
              `<button type="button" role="radio" data-format="${f}" aria-checked="${filters.format === f}">${f === "all" ? "Все" : FORMAT_LABEL[f]} <small>${count(f)}</small></button>`,
          )
          .join("")}
      </div>
      <select class="select" aria-label="Категория">
        <option value="">Все категории</option>
        ${categories.map((c) => `<option ${c === filters.category ? "selected" : ""}>${esc(c)}</option>`).join("")}
      </select>
      <label class="check"><input type="checkbox" ${filters.withExample ? "checked" : ""} /> с примером</label>
    </section>
    <div class="tags" aria-label="Теги">
      ${tags.map((t) => `<button type="button" class="tag ${t === filters.tag ? "on" : ""}" data-tag="${esc(t)}">#${esc(t)}</button>`).join("")}
    </div>
    <p class="count" aria-live="polite"></p>
    <section class="grid"></section>
  `;

  const grid = app.querySelector<HTMLElement>(".grid")!;
  const countEl = app.querySelector<HTMLElement>(".count")!;

  const draw = () => {
    thumbs.disconnect();
    resizer.disconnect();
    const list = ENTRIES.filter((e) => matches(e, filters));
    countEl.textContent = `${list.length} из ${ENTRIES.length}`;
    grid.innerHTML = list.length
      ? list.map(cardHtml).join("")
      : `<p class="empty">Ничего не нашлось. Сбросьте фильтры или опишите идею скиллу <code>/visual-prompt</code> — он напишет новый промт.</p>`;
    grid.querySelectorAll<HTMLElement>(".thumb[data-src]").forEach((el) => {
      thumbs.observe(el);
      resizer.observe(el);
    });
    grid.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((btn) =>
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const e = ENTRIES.find((x) => x.id === btn.dataset.copy)!;
        copy(fill(e, defaults(e)), btn);
      }),
    );
  };

  app.querySelector<HTMLInputElement>(".search")!.addEventListener("input", (ev) => {
    filters.q = (ev.target as HTMLInputElement).value.trim();
    draw();
  });
  app.querySelectorAll<HTMLButtonElement>("[data-format]").forEach((b) =>
    b.addEventListener("click", () => {
      filters.format = b.dataset.format as Filters["format"];
      app.querySelectorAll("[data-format]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      draw();
    }),
  );
  app.querySelector<HTMLSelectElement>(".select")!.addEventListener("change", (ev) => {
    filters.category = (ev.target as HTMLSelectElement).value;
    draw();
  });
  app.querySelector<HTMLInputElement>(".check input")!.addEventListener("change", (ev) => {
    filters.withExample = (ev.target as HTMLInputElement).checked;
    draw();
  });
  app.querySelectorAll<HTMLButtonElement>("[data-tag]").forEach((b) =>
    b.addEventListener("click", () => {
      filters.tag = filters.tag === b.dataset.tag ? "" : b.dataset.tag!;
      app.querySelectorAll("[data-tag]").forEach((x) => x.classList.toggle("on", (x as HTMLElement).dataset.tag === filters.tag));
      draw();
    }),
  );

  draw();
}

function cardHtml(e: PromptEntry): string {
  const src = exampleUrl(e);
  const preview = src
    ? `<div class="thumb" data-src="${esc(src)}"><iframe title="${esc(e.title)}" sandbox="allow-scripts" tabindex="-1" width="${THUMB_W}" height="${THUMB_H}"></iframe></div>`
    : `<div class="thumb">${placeholder(e)}</div>`;
  return `
    <article class="card">
      <a class="card-link" href="#/p/${esc(e.id)}" aria-label="${esc(e.title)}"></a>
      ${preview}
      <div class="card-body">
        <div class="badges">${badges(e)}<span class="cat">${esc(e.category)}</span></div>
        <h2>${esc(e.title)}</h2>
        <p>${esc(e.summary)}</p>
      </div>
      <div class="card-foot">
        <button type="button" class="btn ghost" data-copy="${esc(e.id)}">${COPY_ICON}<span>Копировать промт</span></button>
      </div>
    </article>`;
}

// ─── страница промта ────────────────────────────────────

function fieldHtml(v: Variable): string {
  const control = v.options
    ? `<select data-var="${v.name}">${v.options.map((o) => `<option ${o === v.default ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`
    : `<input data-var="${v.name}" type="text" value="${esc(v.default)}" />`;
  return `<label class="field"><span>${esc(v.label)}</span>${control}${v.hint ? `<small>${esc(v.hint)}</small>` : ""}</label>`;
}

function renderDetail(id: string) {
  const e = ENTRIES.find((x) => x.id === id);
  if (!e) {
    app.innerHTML = `<p class="empty">Промт «${esc(id)}» не найден. <a href="#/">К списку</a></p>`;
    return;
  }
  document.title = `${e.title} · Anatomy Prompts`;
  const src = exampleUrl(e);
  const values = defaults(e);

  app.innerHTML = `
    <a class="back" href="#/">← Все промты</a>
    <section class="detail">
      <div class="detail-main">
        <div class="badges">${badges(e)}<span class="cat">${esc(e.category)}</span></div>
        <h1>${esc(e.title)}</h1>
        <p class="lead">${esc(e.summary)}</p>
        <div class="stage">
          ${
            src
              ? `<iframe title="${esc(e.title)} — пример" sandbox="allow-scripts" src="${esc(src)}"></iframe>`
              : placeholder(e)
          }
        </div>
        ${src ? `<p class="stage-note"><a href="${esc(src)}" target="_blank" rel="noopener">Открыть пример на весь экран ↗</a>${e.source ? ` · пример из <code>${esc(e.source)}</code>` : ""}</p>` : ""}
      </div>
      <aside class="detail-side">
        ${e.variables.length ? `<form class="vars" autocomplete="off"><h2>Параметры</h2>${e.variables.map(fieldHtml).join("")}</form>` : ""}
        <div class="prompt-box">
          <div class="prompt-head">
            <h2>Готовый промт</h2>
            <button type="button" class="btn primary" data-copy-final>${COPY_ICON}<span>Копировать</span></button>
          </div>
          <pre class="prompt" tabindex="0"></pre>
        </div>
        <div class="checklist">
          <h2>Проверить в результате</h2>
          <ul>${e.qualityChecklist.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
        </div>
        <div class="tags">${e.tags.map((t) => `<span class="tag static">#${esc(t)}</span>`).join("")}</div>
      </aside>
    </section>
  `;

  const pre = app.querySelector<HTMLElement>(".prompt")!;
  const update = () => (pre.textContent = fill(e, values));
  app.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-var]").forEach((el) =>
    el.addEventListener("input", () => {
      values[el.dataset.var!] = el.value;
      update();
    }),
  );
  app.querySelector<HTMLButtonElement>("[data-copy-final]")!.addEventListener("click", (ev) =>
    copy(fill(e, values), ev.currentTarget as HTMLElement),
  );
  update();
}

// ─── роутинг и тема ─────────────────────────────────────

function route(scrollTop = true) {
  thumbs.disconnect();
  resizer.disconnect();
  const y = window.scrollY;
  const m = location.hash.match(/^#\/p\/([a-z0-9-]+)$/);
  if (m) renderDetail(m[1]);
  else renderList();
  window.scrollTo(0, scrollTop ? 0 : y);
}

// Смена темы перерисовывает страницу: превью грузятся в версии под новую тему
document.getElementById("theme-toggle")!.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  store("theme", next);
  route(false);
});
matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
  if (!document.documentElement.dataset.theme) route(false);
});

window.addEventListener("hashchange", () => route());
route();
