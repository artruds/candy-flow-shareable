# Candy Flow Workflow

Candy Flow is built around one simple idea: make the ad production process visible.

## 1. Prepare Scripts

Each creative should be broken into scenes.

For the default short-form workflow:

- 3 scenes per creative is ideal.
- Each scene should be 54-62 words.
- Each scene becomes one 15-second generated clip.

Recommended structure:

| Scene | Job |
| --- | --- |
| A | Hook, problem, or recognizable pain point |
| B | The insight, promise, mechanism, or better way |
| C | CTA and next step |

## 2. Generate Scene Clips

The scene generation provider is separate from Candy Flow.

Candy Flow expects the backend to track whether each scene is:

- pending
- generating
- done
- failed

In the demo server, clicking generate simply marks scenes as done. In a real backend, this is where you call your video generation provider.

## 3. Glue The Clips

After all scenes for a creative are ready, glue them into one continuous video.

Example:

```text
demo-001-a.mp4 + demo-001-b.mp4 + demo-001-c.mp4 -> demo-001-stitched.mp4
```

This is usually done with `ffmpeg`.

## 4. Caption With Submagic

Upload the stitched video to Submagic, choose your caption preset, and wait for Submagic to produce the captioned video.

The public starter does not include a real Submagic integration. It includes the place where that integration belongs.

## 5. Add Music

Pick a background song from your approved list.

Recommended starter setting:

```text
music volume: 15%
music starts: 5 seconds
```

Keep the voice clear. Music should support the ad, not fight the message.

## 6. Export

Save the final file in a folder named after the creative.

Example:

```text
output/demo-001/final-with-music.mp4
```

## 7. Review Before Uploading

Before running paid traffic, check:

- the script matches the voiceover
- captions are readable
- music is not too loud
- CTA is present
- no claims are too aggressive for the platform
- no accidental private files are included
