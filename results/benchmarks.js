// Every published benchmark, one card each. A benchmark is a folder under
// `data/` with its own index and trials; this page is the only place that shows
// more than one of them, and the only way between them.
//
// It reads `data/benchmarks.json`, which publish.py rebuilds by scanning those
// folders. Nothing here counts anything: the numbers on a card come from the
// same index the benchmark's own leaderboard reads, so the two cannot disagree.

const content = document.getElementById("content");

// What a benchmark is, in the units a reader is choosing between: how much was
// run, and how it went. The score is the same one the leaderboard totals -- the
// share of graded trials that reached reward 1 -- so a card previews the page it
// opens rather than introducing a second number for the same thing.
function renderCard(entry, isDefault) {
    const score = entry.graded
        ? Math.round((entry.solved / entry.graded) * 100) : null;
    const facts = [
        `${entry.models} model${entry.models === 1 ? "" : "s"}`,
        `${entry.configs} configuration${entry.configs === 1 ? "" : "s"}`,
        `${entry.tasks} task${entry.tasks === 1 ? "" : "s"}`,
        `${entry.trials} trial${entry.trials === 1 ? "" : "s"}`,
    ];
    const stamp = entry.generated_at
        ? new Date(entry.generated_at).toISOString().slice(0, 10) : null;
    const url = entry.slug === DEFAULT_BENCHMARK
        ? "index.html" : `index.html?benchmark=${encodeURIComponent(entry.slug)}`;

    return `<li class="bench-card${isDefault ? " is-default" : ""}">
        <a href="${url}">
            <h2>${escapeHtml(entry.name)}
                ${isDefault ? `<span class="badge tag">opens by default</span>` : ""}
                ${entry.synthetic ? `<span class="badge fail">synthetic</span>` : ""}
            </h2>
            ${entry.description
                ? `<p class="bench-desc">${escapeHtml(entry.description)}</p>` : ""}
            <p class="bench-facts">${facts.map(escapeHtml).join(" · ")}</p>
            <p class="bench-score">
                ${score === null ? "—" : `<strong>${score}%</strong> solved
                    <span class="note">${entry.solved}/${entry.graded}</span>`}
                ${stamp ? `<span class="note">published ${escapeHtml(stamp)}</span>` : ""}
            </p>
        </a>
    </li>`;
}

fetchJson("data/benchmarks.json").then((registry) => {
    const all = registry.benchmarks ?? [];
    if (!all.length) {
        content.innerHTML = `<p class="empty">No benchmarks published yet.</p>`;
        return;
    }
    content.innerHTML = `<h1 class="page-title">Benchmarks</h1>
        <p class="page-lede">Each one is a separate set of runs, with its own
        leaderboard and its own trials. Nothing is compared across them: a
        different benchmark is a different question.</p>
        <ul class="bench-list">${all.map((entry) =>
            renderCard(entry, entry.slug === (registry.default ?? DEFAULT_BENCHMARK))
        ).join("")}</ul>`;
    // The registry carries no stamp of its own -- each benchmark is published on
    // its own day, and the cards say when.
    renderFooter(null);
}).catch(showError);
