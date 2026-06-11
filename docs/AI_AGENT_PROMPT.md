# Prompt To Give An AI Agent

Use this prompt when you want an AI agent to add new scripts to Candy Flow.

```text
You are helping me add scripts to a Candy Flow project.

Open this file:

server/data/wave-1.json

Add new ad creatives without deleting the existing demo format.

Rules:
- Each creative needs 3 scenes: A, B, and C.
- Each scene should be 54-62 words if possible.
- Scene A is the hook and pain point.
- Scene B is the idea, promise, mechanism, or better way.
- Scene C is the CTA and next step.
- Use clear, simple, spoken language.
- Do not use private client names, private claims, private scripts, or API keys.
- Make every new beat status "pending".
- Add each new creative ID to uiOrder.
- Keep valid JSON.

Naming:
- Use script IDs like demo-004, demo-005, demo-006.
- Use beat IDs like demo-004-a, demo-004-b, demo-004-c.

After editing:
- Run npm run server to make sure the JSON loads.
- Run npm run dev and check that the new creatives appear in Candy Flow.

Do not connect paid APIs or make real generation calls unless I explicitly ask.
```
