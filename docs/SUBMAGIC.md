# Submagic

Submagic is a video captioning and editing tool for short-form videos.

In this workflow, Submagic is used after the individual generated scenes have been stitched into one ad.

## What Submagic Does

Submagic can:

- transcribe the video
- add animated captions
- apply caption presets
- style the captions so they are easier to watch on TikTok, Instagram, YouTube Shorts, and Meta ads
- export a captioned video

## Where It Fits

Candy Flow does not send every single scene to Submagic.

The expected order is:

1. Generate scene A, B, and C.
2. Stitch A + B + C into one video.
3. Send the stitched video to Submagic.
4. Download the captioned video.
5. Add background music.
6. Export the final ad.

## API Key

Put the key in `.env`:

```bash
SUBMAGIC_API_KEY=your_key_here
```

Never commit `.env`.

## Integration Notes

The demo server in this repo does not call Submagic yet. It only simulates the workflow.

To make it real, replace the fake finish logic in:

```text
server/candy-flow-server.mjs
```

with real calls to:

1. stitch clips with `ffmpeg`
2. upload the stitched video to Submagic
3. poll Submagic until the captioned video is ready
4. download the captioned video
5. add music and export

## Presets

Use one consistent caption preset when testing creatives. If you change the caption style every time, you make it harder to know whether the script won or the editing style won.

For clean ad testing, keep these stable:

- caption preset
- font
- color
- music volume
- video length

Then test script variables like:

- hook
- angle
- pain point
- promise
- CTA
