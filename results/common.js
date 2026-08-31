// Shared helpers. No framework and no build step: the site is a handful of
// static files plus the JSON publish.py writes, which is the whole reason Pages
// can serve it.

const NBSP = " ";

// The Vaadin reindeer, from Font Awesome's brand set (CC BY 4.0). Two subpaths:
// the antlers and the muzzle. It lives here rather than in each page's markup
// so there is one copy of it, and app.css does the drawing.
const REINDEER = "M224.5 140.7c1.5-17.6 4.9-52.7 49.8-52.7h98.6c20.7 0 32.1-7.8 32.1-21.6V54.1c0-12.2 9.3-22.1 21.5-22.1S448 41.9 448 54.1v36.5c0 42.9-21.5 62-66.8 62H280.7c-30.1 0-33 14.7-33 27.1 0 1.3-.1 2.5-.2 3.7-.7 12.3-10.9 22.2-23.4 22.2s-22.7-9.8-23.4-22.2c-.1-1.2-.2-2.4-.2-3.7 0-12.3-3-27.1-33-27.1H66.8c-45.3 0-66.8-19.1-66.8-62V54.1C0 41.9 9.4 32 21.6 32s21.5 9.9 21.5 22.1v12.3C43.1 80.2 54.5 88 75.2 88h98.6c44.8 0 48.3 35.1 49.8 52.7h.9zM224 456c11.5 0 21.4-7 25.7-16.3 1.1-1.8 97.1-169.6 98.2-171.4 11.9-19.6-3.2-44.3-27.2-44.3-13.9 0-23.3 6.4-29.8 20.3L224 362l-66.9-117.7c-6.4-13.9-15.9-20.3-29.8-20.3-24 0-39.1 24.6-27.2 44.3 1.1 1.9 97.1 169.6 98.2 171.4 4.3 9.3 14.2 16.3 25.7 16.3z";

function renderMark() {
    const slot = document.getElementById("mark");
    if (!slot) return;
    slot.innerHTML = `<svg class="mark" viewBox="0 0 448 512" role="img"
        aria-label="Vaadin"><path pathLength="1" d="${REINDEER}"/></svg>`;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[ch]);
}

// Pages serves everything with `max-age=600` and no way to override it, so a
// reader who saw an earlier publish gets that copy back from disk without the
// browser asking us anything -- the reason synthetic numbers outlived the run
// that replaced them. `no-cache` forces a revalidation on every load.
function fetchJson(path) {
    return fetch(path, { cache: "no-cache" }).then((response) => {
        if (!response.ok) {
            throw new Error(`${path}: ${response.status}`);
        }
        return response.json();
    });
}

// Which benchmark this page is showing. A benchmark is a folder under `data/`
// with its own index and trials, and `?benchmark=<slug>` is how every page says
// which one it is on. The default is the one the site opens on, and it is left
// out of the query string entirely -- so the URLs that existed before there was
// more than one benchmark still resolve to it.
const DEFAULT_BENCHMARK = "default";
const benchmark = new URLSearchParams(location.search).get("benchmark")
    || DEFAULT_BENCHMARK;

function dataUrl(path) {
    return `data/${encodeURIComponent(benchmark)}/${path}`;
}

// Every internal link has to carry the benchmark, or one click lands back in the
// default with the same model and configuration -- which would look like data
// changing under the reader rather than a different benchmark.
function pageUrl(page, params = {}) {
    const query = new URLSearchParams(params);
    if (benchmark !== DEFAULT_BENCHMARK) query.set("benchmark", benchmark);
    const search = query.toString();
    return search ? `${page}?${search}` : page;
}

// A model id is `provider/name`; the provider is noise in a table where every
// row carries one, and the dated Haiku suffix is noise everywhere.
function shortModel(model) {
    const name = String(model ?? "unknown").split("/").pop();
    return name.replace(/-\d{8}$/, "");
}

// `claude-opus-5` and `claude-sonnet-5` share a prefix that says nothing about
// which is which. On a chart where each label competes for room, the shared part
// is dropped -- but only at a `-` boundary, and only if every model has it.
function trimCommonPrefix(names) {
    const parts = names.map((name) => shortModel(name).split("-"));
    let shared = 0;
    while (parts[0] && shared < parts[0].length - 1
        && parts.every((p) => p.length > shared + 1 && p[shared] === parts[0][shared])) {
        shared += 1;
    }
    return new Map(names.map((name, i) => [name, parts[i].slice(shared).join("-")]));
}

function shortTask(task) {
    return String(task ?? "").split("/").pop();
}

// Surefire names a suite by its fully qualified class, and the package is the
// same for every suite VaadinBench grades. The full name stays in a tooltip.
function shortSuite(name) {
    return String(name ?? "").split(".").pop();
}

// A job directory is named `<configuration>-<date>-<time>`. The timestamp makes
// each run unique; the prefix is the thing being compared -- which skills and
// tools the agent was given. The leaderboard groups by that prefix, so two runs
// of one configuration on different days land in the same row.
function configOf(job) {
    return String(job ?? "").replace(/-\d{8}-\d{6}$/, "") || "unknown";
}

// Round to whole seconds first, then split. Rounding the remainder instead let
// 719.6s print as `11m 60s`: the minutes were floored off the unrounded value
// and the seconds rounded up to a full minute on their own.
function duration(seconds) {
    if (seconds === null || seconds === undefined) return "—";
    const total = Math.round(seconds);
    if (total < 60) return `${total}s`;
    const minutes = Math.floor(total / 60);
    return `${minutes}m${NBSP}${String(total % 60).padStart(2, "0")}s`;
}

function tokens(count) {
    if (count === null || count === undefined) return "—";
    if (count < 1000) return String(count);
    return `${(count / 1000).toFixed(1)}k`;
}

function money(amount) {
    return amount === null || amount === undefined ? "—" : `$${amount.toFixed(2)}`;
}

function percent(rate) {
    return rate === null || rate === undefined ? "—" : `${Math.round(rate * 100)}%`;
}

// The verifier decides the result. An error in the agent loop is worth flagging
// beside that verdict but never in place of it: a run can lose its API
// connection on the last step and still leave behind a project that grades
// clean, and calling that `error` both hides a real pass and disagrees with the
// leaderboard, which counts the reward. The error stands alone only when there
// is no grade to report.
function outcome(trial) {
    if (trial.reward === null || trial.reward === undefined) {
        return trial.error
            ? `<span class="badge fail">error</span>`
            : `<span class="badge tag">no reward</span>`;
    }
    const badge = trial.reward >= 1
        ? `<span class="badge pass">pass</span>`
        : `<span class="badge fail">fail</span>`;
    if (!trial.error) return badge;
    return `${badge} <span class="note" title="${escapeHtml(trial.error)}">error</span>`;
}

// The job rides along so the trial page can check that the file it loaded is
// the run that was clicked. Ids used to omit the job, which let three trials
// share one, and the page had no way to notice it was showing another run.
function trialUrl(id, job) {
    return pageUrl("trial.html", job ? { id, job } : { id });
}

function runUrl(model, config) {
    return pageUrl("run.html", { model, config });
}

function leaderboardUrl() {
    return pageUrl("index.html");
}

// One hue per model, from Aura's palette, so a row's bar and its dot in the
// chart are the same colour. Assigned by position in the sorted model list
// rather than by name, so a new model picks up the next hue on its own.
// Yellow is out for the same reason it is out of CONFIG_HUES: its text variant
// is the one in the palette that cannot be read at chip size, and a sixth model
// -- which is what a second agent brings -- is what first reaches that far.
const HUES = ["blue", "purple", "orange", "green", "red", "teal"];

function hueMap(models) {
    const sorted = [...new Set(models)].sort();
    return new Map(sorted.map((model, i) => [model, HUES[i % HUES.length]]));
}

// The saturated palette colour for anything filled, its `-text` variant for
// anything set as type: Aura computes the second precisely because the first
// does not have the contrast for small text.
function hueFill(hue) {
    return `var(--aura-${hue})`;
}

function hueText(hue) {
    return `var(--aura-${hue}-text)`;
}

// Configurations are the other axis of comparison, and colour is already spent
// on models, so they get a shape. Nine points labelled in text collide with each
// other and with the dots; two legends and a tooltip do not.
const SHAPES = ["circle", "square", "triangle", "diamond"];

function shapeMap(configs) {
    const sorted = [...new Set(configs)].sort();
    return new Map(sorted.map((config, i) => [config, SHAPES[i % SHAPES.length]]));
}

// Away from the chart there is room to tint a configuration as well, so it gets
// a hue of its own -- from the far end of the palette, so the greens and reds a
// config is drawn in do not read as one of the models' blues and purples. The
// shape stays the primary code: it is what the two axes are told apart by.
// Yellow is out: it is the one palette entry with no readable text variant at
// this size. The baseline configuration is out of the rotation altogether -- it
// is the absence of a setup rather than one of them, and neutral ink says that
// better than a colour, as well as leaving one more colour for the real ones.
const CONFIG_HUES = ["green", "red", "teal", "orange", "purple", "blue"];
const BASELINE_CONFIGS = new Set(["vanilla", "baseline", "none"]);

function configHueMap(configs) {
    const sorted = [...new Set(configs)].sort();
    let next = 0;
    return new Map(sorted.map((config) => [config, BASELINE_CONFIGS.has(config)
        ? "neutral"
        : CONFIG_HUES[next++ % CONFIG_HUES.length]]));
}

// The chart's marker at text size, so a configuration carries the same shape in
// a chip, a table row and a legend as it does in the scatter.
function shapeGlyph(shape, hue) {
    return `<svg class="glyph" viewBox="0 0 14 14" aria-hidden="true">${
        marker(shape, 7, 7, `fill:${hueFill(hue)}`, "dot", 5)}</svg>`;
}

const SHAPE_TAGS = { circle: "circle", square: "rect", triangle: "polygon", diamond: "polygon" };

function marker(shape, x, y, style, klass = "dot", r = 6) {
    const kind = SHAPE_TAGS[shape] ? shape : "circle";
    const body = {
        circle: `<circle cx="${x}" cy="${y}" r="${r}"`,
        square: `<rect x="${x - r * 0.9}" y="${y - r * 0.9}" width="${r * 1.8}"
            height="${r * 1.8}" rx="1"`,
        triangle: `<polygon points="${x},${y - r * 1.15} ${x + r},${y + r * 0.8}
            ${x - r},${y + r * 0.8}"`,
        diamond: `<polygon points="${x},${y - r * 1.25} ${x + r * 1.05},${y}
            ${x},${y + r * 1.25} ${x - r * 1.05},${y}"`,
    }[kind];
    return `${body} class="${klass}" style="${style}"/>`;
}

// Candidate positions for a label, in preference order: beside the point first,
// then above and below, then progressively further out. Both horizontal anchors
// are offered at every vertical step, because a point near an edge may only have
// one side available -- and a long label beside a crowded point needs to be able
// to move vertically while staying on the side that fits.
const LABEL_SLOTS = (() => {
    const slots = [[11, 4, "start"], [-11, 4, "end"], [0, -11, "middle"], [0, 16, "middle"]];
    for (const dy of [-13, 19, -25, 31, -37, 43, -49, 55]) {
        slots.push([11, dy, "start"], [-11, dy, "end"], [0, dy, "middle"]);
    }
    return slots;
})();

function layoutChartLabels(svg) {
    if (!svg) return;
    const labels = [...svg.querySelectorAll(".dot-label")];
    if (!labels.length) return;
    const width = svg.viewBox.baseVal.width;
    const pad = 2;
    const grow = (box) => ({
        x: box.x - pad, y: box.y - pad,
        w: box.width + pad * 2, h: box.height + pad * 2,
    });
    // Markers and the axis text are obstacles from the start; each label becomes
    // one as it lands. Including the ticks is what keeps a label from settling on
    // top of "100%" or "$2.00".
    const taken = [...svg.querySelectorAll(".dot, .tick, .axis-title")]
        .map((node) => grow(node.getBBox()));

    // Overlap by area, not yes/no: when a point is boxed in on every side, the
    // least bad slot is a real answer and "keep the default" is not.
    const overlap = (a, b) =>
        Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
        * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

    for (const label of labels) {
        const cx = Number(label.dataset.cx), cy = Number(label.dataset.cy);
        const { width: w, height: h } = label.getBBox();
        let best = null;
        for (const [dx, dy, anchor] of LABEL_SLOTS) {
            const x = cx + dx, y = cy + dy;
            const left = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
            const box = { x: left - pad, y: y - h * 0.8 - pad, w: w + pad * 2, h: h + pad * 2 };
            if (box.x < 0 || box.x + box.w > width) continue;
            const cost = taken.reduce((sum, other) => sum + overlap(box, other), 0);
            if (!best || cost < best.cost) best = { x, y, anchor, box, cost };
            if (cost === 0) break;
        }
        if (!best) continue;
        label.setAttribute("x", best.x);
        label.setAttribute("y", best.y);
        label.setAttribute("text-anchor", best.anchor);
        taken.push(best.box);
    }
}

// A tooltip that follows the pointer rather than SVG's own <title>, which waits
// about a second and then lets the window manager put it wherever it likes --
// far from the point it describes, which reads as a bug.
function bindTips(root) {
    const tip = root.querySelector(".tip");
    if (!tip) return;
    const show = (target) => {
        const box = target.getBoundingClientRect();
        const frame = tip.parentElement.getBoundingClientRect();
        tip.textContent = target.dataset.tip;
        tip.hidden = false;
        // Measured after the text is in, so the width is the real one, then
        // clamped so a point near either edge keeps the whole label on screen.
        const left = box.left - frame.left + box.width / 2 - tip.offsetWidth / 2;
        tip.style.left = `${Math.max(0, Math.min(left, frame.width - tip.offsetWidth))}px`;
        tip.style.top = `${box.top - frame.top - tip.offsetHeight - 8}px`;
    };
    root.addEventListener("pointerover", (event) => {
        const target = event.target.closest("[data-tip]");
        if (target) show(target);
    });
    root.addEventListener("pointerout", (event) => {
        if (event.target.closest("[data-tip]")) tip.hidden = true;
    });
}

// ------------------------------------------------------------------ markdown

// Task prompts and agent messages are written in Markdown, and reading them as
// raw text means reading the punctuation instead of the prose.
//
// This is a deliberate subset -- headings, paragraphs, lists, code, emphasis,
// links, quotes, rules -- not a CommonMark implementation, because the input is
// the narrow dialect these agents actually emit and a real parser is a
// dependency this site does not have a way to carry.
//
// SECURITY: the text is agent output, so it is escaped *first* and every tag
// below is one this function wrote. Nothing from the input is ever interpolated
// as markup, and link targets are checked against a scheme allowlist, so a
// `javascript:` href renders as plain text rather than a link.

const MD_SAFE_URL = /^(https?:\/\/|mailto:|#|\/)[^\s]*$/i;

function mdUrl(url) {
    // Already HTML-escaped, so quotes cannot terminate the attribute.
    return MD_SAFE_URL.test(url.trim()) ? url.trim() : "";
}

// Inline spans, on already-escaped text. Code first, so emphasis markers inside
// a code span are left alone; the placeholder can never appear in the input,
// because U+0000 does not survive escaping.
function mdInline(text) {
    const code = [];
    let out = text.replace(/`([^`]+)`/g, (_, body) => {
        code.push(body);
        return `\u0000${code.length - 1}\u0000`;
    });

    out = out
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label, href) => {
            const url = mdUrl(href);
            return url ? `<a href="${url}">${label}</a>` : label;
        })
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/__([^_]+)__/g, "<strong>$1</strong>")
        .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
        .replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>")
        .replace(/~~([^~]+)~~/g, "<del>$1</del>");

    return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${code[Number(i)]}</code>`);
}

// Lists nest by indent, so they are built depth-first: an item deeper than the
// level being built starts a sublist inside the item before it.
function mdList(items, start, indent) {
    const tag = items[start].ordered ? "ol" : "ul";
    let html = `<${tag}>`;
    let i = start;
    while (i < items.length && items[i].indent >= indent) {
        if (items[i].indent > indent) {
            const [sub, next] = mdList(items, i, items[i].indent);
            html += sub;
            i = next;
            continue;
        }
        html += `<li>${mdInline(items[i].text)}`;
        if (i + 1 < items.length && items[i + 1].indent > indent) {
            const [sub, next] = mdList(items, i + 1, items[i + 1].indent);
            html += sub;
            i = next;
        } else {
            i += 1;
        }
        html += "</li>";
    }
    return [`${html}</${tag}>`, i];
}

const MD_ITEM = /^(\s*)(?:([-*+])|(\d+)[.)])\s+(.*)$/;

function renderMarkdown(text) {
    const lines = escapeHtml(text ?? "").split("\n");
    const out = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Fenced code. An unterminated fence runs to the end rather than
        // swallowing the rest of the document into a paragraph.
        const fence = line.match(/^\s*```+\s*([\w+-]*)\s*$/);
        if (fence) {
            const body = [];
            i += 1;
            while (i < lines.length && !/^\s*```+\s*$/.test(lines[i])) {
                body.push(lines[i]);
                i += 1;
            }
            i += 1;
            out.push(`<pre><code>${body.join("\n")}</code></pre>`);
            continue;
        }

        if (!line.trim()) { i += 1; continue; }

        if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
            out.push("<hr>");
            i += 1;
            continue;
        }

        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading) {
            const level = heading[1].length;
            out.push(`<h${level}>${mdInline(heading[2].trim())}</h${level}>`);
            i += 1;
            continue;
        }

        if (/^\s*&gt;\s?/.test(line)) {
            const body = [];
            while (i < lines.length && /^\s*&gt;\s?/.test(lines[i])) {
                body.push(lines[i].replace(/^\s*&gt;\s?/, ""));
                i += 1;
            }
            out.push(`<blockquote>${renderMarkdown(unescapeHtml(body.join("\n")))}</blockquote>`);
            continue;
        }

        if (MD_ITEM.test(line)) {
            const items = [];
            while (i < lines.length) {
                const match = lines[i].match(MD_ITEM);
                if (match) {
                    items.push({
                        indent: match[1].length,
                        ordered: Boolean(match[3]),
                        text: match[4],
                    });
                    i += 1;
                } else if (lines[i].trim() && /^\s+/.test(lines[i]) && items.length) {
                    // A wrapped continuation line belongs to the item above it.
                    items[items.length - 1].text += ` ${lines[i].trim()}`;
                    i += 1;
                } else {
                    break;
                }
            }
            out.push(mdList(items, 0, items[0].indent)[0]);
            continue;
        }

        const paragraph = [];
        while (i < lines.length && lines[i].trim()
            && !MD_ITEM.test(lines[i])
            && !/^(#{1,6})\s/.test(lines[i])
            && !/^\s*```/.test(lines[i])
            && !/^\s*&gt;\s?/.test(lines[i])) {
            paragraph.push(lines[i]);
            i += 1;
        }
        out.push(`<p>${mdInline(paragraph.join("\n"))}</p>`);
    }

    return out.join("");
}

// Blockquote bodies are re-parsed, and the parser escapes what it is given, so
// one round has to be undone to avoid escaping the escapes.
function unescapeHtml(value) {
    return String(value)
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
}

// Summary figures as a one-row table rather than a flat run of label/value
// pairs: it puts them on a card like every other block of content, lines the
// numbers up under their names, and needs no styling of its own.
function metricsTable(pairs) {
    const cells = pairs.filter(([, value]) => value !== null && value !== undefined);
    if (!cells.length) return "";
    return `<div class="wrap"><table class="summary">
        <thead><tr>${cells.map(([label]) =>
            `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead>
        <tbody><tr>${cells.map(([, value]) =>
            `<td>${value}</td>`).join("")}</tr></tbody>
    </table></div>`;
}

// Invented data must never be mistaken for a measurement, so it is called out on
// every page that shows any, not only where it was generated.
function syntheticBanner(isSynthetic) {
    if (!isSynthetic) return "";
    return `<div class="banner"><strong>Synthetic data.</strong> These numbers
        were invented to develop this site, not measured. They disappear the
        first time real results are published.</div>`;
}

function renderFooter(generatedAt) {
    const footer = document.getElementById("footer");
    if (!footer) return;
    // A trial page has no generation stamp of its own; it shows just the links
    // rather than an empty date.
    const stamp = generatedAt
        ? `Generated ${escapeHtml(new Date(generatedAt).toISOString().slice(0, 16).replace("T", " "))} UTC · `
        : "";
    footer.innerHTML = `${stamp}
        <a href="https://github.com/vesanieminen/vaadinbench-results">source</a> ·
        <a href="https://github.com/vesanieminen/vaadinbench">tasks</a>`;
}

// The way to the other benchmarks. Just the way there: which benchmark this is
// belongs to the page below, which says it in its own rows, and repeating it in
// the header only competes with the wordmark.
//
// Rendered from the registry rather than written into each page, so it appears
// on its own once a second benchmark is published -- with one, it would be a
// link to a list of the page you are already on.
// The pages carry `index.html` in their own markup -- the wordmark, run.html's
// crumb. Inside a benchmark that has to mean this benchmark's leaderboard, or
// the way home is a silent jump back to the default with no sign it happened.
function localiseHomeLinks() {
    if (benchmark === DEFAULT_BENCHMARK) return;
    document.querySelectorAll('a[href="index.html"]').forEach((link) => {
        link.setAttribute("href", leaderboardUrl());
    });
}

function renderBenchmarkBar() {
    const slot = document.getElementById("benchmark");
    if (!slot) return;
    fetchJson("data/benchmarks.json").then((registry) => {
        if ((registry.benchmarks ?? []).length < 2) return;
        slot.innerHTML =
            `<a class="bench-switch" href="benchmarks.html">All benchmarks</a>`;
    }).catch(() => {
        // No registry is the state this site was in before benchmarks existed.
        // The page below it works either way, so it says nothing.
    });
}

function showError(error) {
    // A benchmark in the URL that has no folder fails here, as a 404 on a path
    // nobody typed. Offer the list rather than leaving the reader to guess a
    // slug back.
    const elsewhere = benchmark === DEFAULT_BENCHMARK ? ""
        : ` <a href="benchmarks.html">See the benchmarks that are published.</a>`;
    document.getElementById("content").innerHTML =
        `<p class="empty">Could not load the data: ${escapeHtml(error.message)}.${elsewhere}</p>`;
}

renderMark();
localiseHomeLinks();
renderBenchmarkBar();
