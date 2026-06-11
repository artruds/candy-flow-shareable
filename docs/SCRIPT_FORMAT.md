# Script Format

Candy Flow expects scripts to be broken into scenes.

The easiest format is one creative with three scenes:

- A
- B
- C

## Scene Length

For 15-second clips, aim for:

```text
54-62 words per scene
```

This is a practical target, not a law. If the voice is slower, use fewer words. If the voice is faster, you can use slightly more.

## Scene Jobs

### Scene A

Use scene A for the hook.

Good jobs for scene A:

- name the pain point
- show the pattern
- create curiosity
- make the viewer feel understood

### Scene B

Use scene B for the idea.

Good jobs for scene B:

- explain the mistake
- introduce the better way
- make the promise believable
- show the mechanism if there is one

### Scene C

Use scene C for the CTA.

Good jobs for scene C:

- tell the viewer what to do next
- make the next step feel easy
- repeat the core promise
- create a reason to act now

## Example

```json
{
  "beatId": "demo-004-a",
  "scriptId": "demo-004",
  "letter": "A",
  "text": "Your scene text goes here. Keep it clear, conversational, and about 54-62 words.",
  "status": "pending",
  "path": null
}
```

Add scenes to:

```text
server/data/wave-1.json
```

Then add the creative ID to:

```json
"uiOrder": ["demo-001", "demo-002", "demo-003", "demo-004"]
```

Restart the demo server after editing the JSON.
