# Candy Flow

Candy Flow is a simple visual dashboard for turning short ad scripts into finished short-form video creatives.

This public version is sanitized:

- no private scripts
- no avatar media
- no API keys
- no paid generation calls
- demo data only

The app includes a local demo API so a new user can learn the workflow before connecting real video generation and Submagic captioning.

## Quick Start

```bash
npm install
npm run dev:all
```

Open:

[http://127.0.0.1:5180](http://127.0.0.1:5180)

The demo API runs on:

[http://127.0.0.1:8783](http://127.0.0.1:8783)

## What You Are Looking At

Candy Flow shows creatives as little “candies”.

- Each row is one creative.
- Each `A`, `B`, `C` candy is one scene or beat.
- Green means the scene is ready.
- Grey means it has not been generated yet.
- The finish flow shows the steps after scenes exist: glue, captions, music, folder.

The default demo project is intentionally fake and safe to share. Replace it with your own scripts when ready.

## Real Workflow

1. Add scripts.
2. Generate each scene as a 15-second clip.
3. Glue the scenes together into one ad.
4. Send the stitched video to Submagic for captions.
5. Add background music at about 15% volume.
6. Export the final video.

See [docs/WORKFLOW.md](docs/WORKFLOW.md) for the full step-by-step.

## API Keys

Copy `.env.example` to `.env`.

```bash
cp .env.example .env
```

Then add only the keys you need locally. Do not commit `.env`.

```bash
SUBMAGIC_API_KEY=your_key_here
VIDEO_PROVIDER_API_KEY=your_key_here
```

See [docs/SUBMAGIC.md](docs/SUBMAGIC.md) for what Submagic does and how it fits into the workflow.

## Adding New Scripts

For a simple demo, edit:

```text
server/data/wave-1.json
```

Each creative should usually have 3 scenes:

- `A`: hook / problem
- `B`: idea / shift
- `C`: CTA / next step

Aim for **54-62 words per scene** for 15-second clips.

See [docs/SCRIPT_FORMAT.md](docs/SCRIPT_FORMAT.md).

## Prompt For An AI Agent

If you want an AI agent to add scripts for you, give it the prompt in:

[docs/AI_AGENT_PROMPT.md](docs/AI_AGENT_PROMPT.md)

## Notes

This repo is a shareable starter. The included server is a demo adapter, not a production video-generation backend. Replace `server/candy-flow-server.mjs` with real provider calls when you are ready.
