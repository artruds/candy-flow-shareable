# Real Backend Plan

The public repo ships with a demo backend. It is intentionally fake so a friend can test the app safely.

To make it production-ready, replace the demo functions in:

```text
server/candy-flow-server.mjs
```

## Required Endpoints

Candy Flow currently expects these endpoints:

```text
GET  /aa/health
GET  /aa/waves
GET  /aa/wave/:wave
GET  /aa/avatars
GET  /aa/credit
GET  /aa/finish/status?wave=1
POST /aa/generate
POST /aa/finish
POST /aa/open
```

## Real Implementation

### POST /aa/generate

Should:

1. receive a wave and optional beat IDs
2. submit each selected scene to your video generation provider
3. save provider task IDs
4. poll until finished
5. download scene clips
6. update beat statuses

### POST /aa/finish

Should:

1. receive selected script IDs
2. verify all scenes exist
3. stitch scenes together with `ffmpeg`
4. upload stitched video to Submagic
5. wait for captioned export
6. download captioned export
7. choose a song
8. add music at 15% volume
9. save final video

## Keep Testing Clean

For clean creative tests, avoid changing too many variables at once.

Keep stable:

- avatar or visual style
- voice
- music volume
- caption preset
- scene length

Vary:

- hook
- angle
- pain point
- promise
- CTA
