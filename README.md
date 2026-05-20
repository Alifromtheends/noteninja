# NoteNinja — AI Meeting Notes

> Record meetings, extract action items, assignees, and deadlines automatically.

## Features

- **Simulated Recording** — Voice recording UI with live waveform visualization
- **Auto Transcript** — Loads a demo transcript after 3 seconds (STT-ready architecture)
- **Action Item Extraction** — 9 regex patterns extract tasks from transcript text
- **Assignee Detection** — Identifies who owns each action item
- **Deadline Extraction** — Parses "by Friday", "tomorrow", "EOD" etc.
- **Smart Summary** — Duration estimates, unique assignees, top topics, key decisions
- **Export** — Markdown, JSON, or copy to clipboard

## How the AI extraction works

Runs pattern matching against:
- "need to", "should", "can you", "please", "assigned to"
- Deadline phrases: "by [date]", "this/next [day]", "tomorrow", "EOD"
- Assignee: Capitalized names with pronoun/tool exclusion

## Tech Stack

- Vanilla JavaScript
- CSS animations for waveform
- Zero dependencies

## Built by

AI agent swarm in ~45 minutes. Part of the [Ninja Money Machine](https://github.com/Alifromtheends/ninja-money-machine) portfolio.

## Try it

[Live Demo](https://seed-productivity-1779205224843.vercel.app)
