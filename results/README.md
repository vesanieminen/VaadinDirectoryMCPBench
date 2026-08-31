# VaadinBench results

**[https://vaadin.github.io/vaadinbench-results/](https://vaadin.github.io/vaadinbench-results/)**

The published results for [VaadinBench](https://github.com/vaadin/vaadinbench):
a leaderboard, and behind every trial the trajectory the agent actually produced.

That repository is only the tasks. This one is only the results, so a run never
touches the thing being measured.

## Benchmarks

The site holds more than one benchmark, and each is a folder under `data/`:

```text
data/benchmarks.json                 the registry the list page reads
data/default/                        the benchmark the site opens on
data/<slug>/index.json                   one row per trial
data/<slug>/trials/<id>.json             one file per trial
data/<slug>/benchmark.json               what it is called
```

A benchmark is a set of runs asking one question, and **nothing is compared
across them** — different models, different tasks, different months. The pages
show one at a time: `?benchmark=<slug>` selects it, `benchmarks.html` lists them
all, and the default is left out of the query string entirely, so every URL that
worked before there was more than one benchmark still resolves to it.

`benchmarks.json` is rebuilt by scanning `data/`, never edited. Deleting a
folder unpublishes it; `./publish.py --registry` rebuilds the list after one.
Everything on a card is counted from the benchmark's own index, so the list
cannot disagree with the page it links to — the one thing a scan cannot infer is
the name, which is why each folder carries a `benchmark.json`.

## Publishing a run

A run happens on the machine with Docker and the model credentials. This repo
turns its output into the site:

```bash
./publish.py --baselines ../vaadin-bench/tasks ../vaadin-bench/jobs/new-project-3models
git add data && git commit -m "Publish new-project-3models" && git push
```

That publishes into `default`. A run that belongs somewhere else names it, and
names the benchmark the first time it is published:

```bash
./publish.py --benchmark mcp-servers --name "MCP servers, head to head" \
    --baselines ../vaadin-bench/tasks ../vaadin-bench/jobs/mcp-*
```

The name and description stick: later publishes into the same benchmark keep
them unless they are given again.

The push *is* the deploy: GitHub Pages serves `main` from the repository root,
so there is no workflow and nothing to build. Pass several job directories at
once, or `--keep` to add a run without republishing the ones already there.

`--baselines` is temporary and is explained under [Rebuilt diffs](#rebuilt-diffs).
Without it a run from after the container split publishes with an empty Changes
tab.

## What gets published

`publish.py` copies fields **by allowlist**, one at a time. A Harbor trial
directory holds much more than this — the agent's whole file tree, recordings,
raw logs — and none of it appears here unless someone adds it to that list. What
goes out today, per trial:

| Published | Read from |
| --- | --- |
| Task, agent, model, attempt, reward, duration, tokens, cost | `result.json` |
| The prompt the agent was given | first user step of the trajectory |
| Every step: message, reasoning, tool calls and their output | `agent/trajectory.json` |
| Reward, graded suites, failed test names | `verifier/reward.txt`, `verifier/TEST-*.xml` |
| The verifier's console output, last 40 KB | `verifier/test-stdout.txt` |
| Generated-project report | `verifier/structure.txt` |
| Diffstat and patch, when a run has them | `artifacts/logs/artifacts/agent-diff-stat.txt`, `agent.patch` |

Harbor collects a container's `/logs` verbatim, so everything a task writes to
`/logs/artifacts` sits at `artifacts/logs/artifacts/` and everything the verifier
writes to `/logs/verifier` sits at `verifier/` — the paths above are the real
ones, and reading the shallower `artifacts/` finds nothing.

The last row is conditional, and the next section is why.

### Rebuilt diffs

Since the tasks repo split the agent and verifier into separate containers,
nothing writes `agent.patch`: the verifier imports the finished `/app` rather
than diffing it. Runs from before the split have their patches and keep them;
runs from after arrive with none, and the whole Changes tab goes blank —
`vaadinbench#27` is the fix, and `#7` is the issue that deletes what this
section describes once that lands.

Until then, `--baselines` rebuilds the diff from what a run *does* still carry:
`artifacts/app`, the agent's finished project. It is compared against the tree
the task's environment starts the agent from, read from the task's own
Dockerfile:

| Task | Baseline |
| --- | --- |
| `flow-grid-filtering` | `environment/app/`, copied into the image verbatim |
| `flow-new-view` | the upstream project at the pinned `BASE_SHA`, plus `pom-additions.patch` — cloned once into `.baselines/` |
| `flow-new-project` | an empty directory, by design: creating the project is the task |

Three things to know before trusting one.

It **fails closed**. Each of those shapes is recognised explicitly, and a task
whose environment does not match one produces no diff rather than a wrong one. A
diff against the wrong baseline is worse than an empty tab, because it reads as
a measurement — which is also why it is only correct while the tasks checkout
sits at the commit the run used.

It is **not complete**. Harbor's capture of `/app` holds no dotfiles, so
`.classpath`, `.settings/` and anything else beginning with a dot is outside it.
They come off the baseline side too, or every trial would appear to have deleted
them; the cost is that a dotfile the agent really wrote is not in the diff.

It is **never preferred**. A patch a task wrote is the measurement and is used
whenever there is one. Only a trial with none gets a rebuilt diff, and the trial
page names the baseline it was rebuilt against rather than letting it pass for a
captured one.

`test-stdout.txt` is the verifier script's own stdout and stderr, and it is the
only place that says *why* a trial scored what it did: a reward of 0 with no
graded suite means the verifier never compiled against the project, which reads
as a broken page unless the log is there to explain it. The tail is published
rather than the head, because Maven's output is long and the verdict is at the
end.

Two things worth being deliberate about. Publishing a trajectory publishes the
task's `instruction.md` verbatim, canary line and all — that is the trade for a
drill-down anyone can read, and it is the same trade ReactBench makes. And tool
output is capped per call, the patch as a whole; the page says when it truncated
something rather than quietly showing less than there was.

## How it works

There is no build step and no framework. The site is a handful of static files —
three pages and the CSS and JS beside them — reading JSON that `publish.py`
wrote:

```text
index.html          leaderboard: one row per model and configuration, plus a chart
run.html            one configuration: its trials
trial.html          one trial: trajectory, changes, verifier, instruction
benchmarks.html     every published benchmark, one card each
```

Each page reads the benchmark named in its own query string, and every link it
writes carries that name onward — a click that dropped it would land on the same
model and configuration in another benchmark, which reads as the data changing
rather than the benchmark.

A **configuration** is a job name with its timestamp stripped —
`vaadin-skills-20260820-171844` is one run of the `vaadin-skills`
configuration. It is what a run was testing, which skills and tools the agent
had, so `(model, configuration)` is the pair the leaderboard ranks and repeated
runs of one configuration collapse into a single row.

The colours are Vaadin's Aura theme. Aura computes nearly everything at runtime
from `--aura-background-color`, using relative-colour syntax that needs Aura's
own stylesheet, so `app.css` carries its formulas evaluated at Aura's defaults
and written out as literal `oklch()`. The header comment names the source files
to diff against when Aura moves.

They live at the repository root because that is where Pages serves this branch
from; `.nojekyll` turns off the Jekyll pass, since there is nothing to render.

A trial's id is `base64(job|task|model|attempt)`, so a link to a trial survives a
republish. The job is part of it because it has to be: without it, one task and
model run in three configurations produced three trials sharing a single id, so
`data/trials/<id>.json` was written three times and only the last job survived
— the index still listed all three rows, and two of them opened another run's
trajectory, reward and diff. `trial.html?id=…&tab=verifier` opens straight to a tab, and the
leaderboard keeps its tab and both filters in the query string, so
`index.html?tab=chart&models=anthropic/claude-opus-5` is a link rather than a
set of clicks to describe.

Harbor writes the trajectory as **ATIF** (Agent Trajectory Interchange Format), a
versioned schema whose steps carry `source`, `message`, `reasoning_content` and
`tool_calls[]`. `publish.py` flattens that into events and sorts tool calls into
the buckets the page offers as filters — reads, searches, edits, bash, tests. It
is the one place that guesses: an unknown tool name becomes "other" rather than
being forced into a bucket it does not belong in.

Codex needs one step more, because it has a single tool. Reading a file, running
Maven and writing a class all arrive as `exec`, carrying a snippet of JavaScript
that calls the harness's own functions — `tools.exec_command`, `tools.apply_patch`,
`tools.update_plan`. On the tool name alone a Codex trial is two thousand
identical `other` steps with every filter empty, so the snippet is read for what
it calls and the command inside it, which is also what the step is labelled with.

## Working on the site

```bash
python3 -m http.server 8000
```

To develop without a benchmark run, write a synthetic job first. It is built by
Harbor's own pydantic models, so it validates against the same schemas a real run
produces — and it needs Harbor, which the tasks repo already has installed:

```bash
../vaadin-bench/.venv/bin/python fixtures/make_fixture.py
./publish.py --benchmark scratch --name Scratch fixtures/jobs/example-3models
```

Into its own benchmark, not over `default`: publishing without `--benchmark`
replaces the front page with the fixture.

That job carries a `SYNTHETIC` marker. `publish.py` copies the flag into the data
and every page it reaches says so, so invented numbers cannot be mistaken for
measurements. Publishing a real run replaces them.
