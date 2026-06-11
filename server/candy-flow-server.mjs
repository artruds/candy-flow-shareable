import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 8783);
const waveFile = path.join(__dirname, 'data', 'wave-1.json');

let finishJobs = [];

const readWave = async () => JSON.parse(await fs.readFile(waveFile, 'utf8'));

const json = (res, status, body) => {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(payload);
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
};

const withCounts = (wave) => {
  const counts = { pending: 0, creating: 0, generating: 0, downloading: 0, done: 0, failed: 0 };
  for (const beat of Object.values(wave.beats)) {
    counts[beat.status] = (counts[beat.status] || 0) + 1;
  }
  return { ...wave, counts };
};

const markGenerated = async (beatIds = []) => {
  const wave = await readWave();
  const ids = beatIds.length ? beatIds : Object.keys(wave.beats).filter((id) => wave.beats[id].status !== 'done');
  for (const id of ids) {
    if (wave.beats[id]) wave.beats[id].status = 'done';
  }
  await fs.writeFile(waveFile, JSON.stringify(withCounts(wave), null, 2));
  return ids;
};

const makeFinishJob = (scriptId) => ({
  id: `demo-job-${Date.now()}-${scriptId}`,
  wave: 1,
  scriptId,
  status: 'done',
  stage: 'export',
  combined: `server/output/${scriptId}/stitched.mp4`,
  captionedFile: `server/output/${scriptId}/captioned.mp4`,
  musicFile: `server/output/${scriptId}/final-with-music.mp4`,
  song: 'demo-song.mp3',
  exported: {
    folder: `server/output/${scriptId}`,
    files: ['final-with-music.mp4'],
  },
});

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (url.pathname === '/aa/health') return json(res, 200, { ok: true, keyLoaded: Boolean(process.env.SUBMAGIC_API_KEY) });
    if (url.pathname === '/aa/waves') {
      const wave = withCounts(await readWave());
      return json(res, 200, {
        ok: true,
        waves: [{ wave: wave.wave, label: wave.label, coach: wave.coach, total: Object.keys(wave.beats).length, counts: wave.counts }],
      });
    }
    if (url.pathname === '/aa/avatars') return json(res, 200, { ok: true, avatars: [{ id: 'demo', name: 'Demo Avatar', gender: 'neutral', hue: 190 }] });
    if (url.pathname === '/aa/credit') return json(res, 200, { ok: true, raw: { credits: 'demo' } });
    if (url.pathname === '/aa/finish/status') return json(res, 200, { ok: true, jobs: finishJobs });

    if (url.pathname.startsWith('/aa/wave/')) {
      return json(res, 200, { ok: true, wave: withCounts(await readWave()) });
    }

    if (url.pathname === '/aa/generate' && req.method === 'POST') {
      const body = await readBody(req);
      const ids = await markGenerated(body.beatIds || []);
      return json(res, 200, { ok: true, enqueued: ids.map((id) => ({ id })), skipped: [] });
    }

    if (url.pathname === '/aa/finish' && req.method === 'POST') {
      const body = await readBody(req);
      const scriptIds = body.scriptIds || [];
      const generated = body.generateFirst ? await markGenerated() : [];
      const jobs = scriptIds.map(makeFinishJob);
      finishJobs = [...jobs, ...finishJobs].slice(0, 50);
      return json(res, 200, { ok: true, jobs, generated });
    }

    if (url.pathname === '/aa/open' && req.method === 'POST') {
      const body = await readBody(req);
      const target = body.jobId ? finishJobs.find((job) => job.id === body.jobId)?.exported?.folder : 'server/output';
      return json(res, 200, { ok: true, path: path.join(root, target || 'server/output') });
    }

    return json(res, 404, { ok: false, error: `No demo route for ${url.pathname}` });
  } catch (error) {
    return json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Candy Flow demo server listening on http://127.0.0.1:${port}`);
});
