import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Captions,
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Link2,
  Loader2,
  Music2,
  Pencil,
  Play,
  RotateCcw,
  Sparkles,
  Waves,
  XCircle,
} from 'lucide-react';

const SERVER = import.meta.env.VITE_CANDY_FLOW_SERVER || 'http://localhost:8783';
const DEFAULT_WAVE = 1;
const POLL_MS = 2000;
const MASTER_PROJECT_PATH = '/demo-projects/hn_demo_creatives.json';

type BeatStatus = 'pending' | 'creating' | 'generating' | 'downloading' | 'done' | 'failed';
type FinishAction = 'whole' | 'glue' | 'captions' | 'music';

interface Beat {
  beatId: string;
  scriptId: string;
  letter: string;
  text: string;
  status: BeatStatus;
  path?: string | null;
  lastState?: string | null;
  attempts?: number;
  error?: string | null;
  failCode?: string | null;
}

interface Avatar {
  id: string;
  name: string;
  gender: string;
  hue?: number;
}

interface WaveSnapshot {
  wave: number;
  label: string;
  coach: string;
  gender: string;
  wrapper: string;
  wrapperPreset: string;
  avatarId?: string;
  avatarName?: string;
  avatarHue?: number;
  lengthSec?: number;
  concurrency: number;
  uiOrder?: string[];
  beats: Record<string, Beat>;
  counts?: Record<string, number>;
}

interface WaveSummary {
  wave: number;
  label: string;
  coach: string;
  total: number;
  counts: Record<string, number>;
}

interface FinishJob {
  id: string;
  wave: number;
  scriptId: string;
  status: string;
  stage: string;
  combined?: string;
  captionedFile?: string;
  musicFile?: string;
  song?: string;
  exported?: {
    folder?: string;
    files?: string[];
  };
  error?: string;
}

interface MasterScene {
  scene: number;
  words?: number;
  text: string;
}

interface MasterCreative {
  uid: string;
  batch?: string;
  source_id?: string;
  displayName?: string;
  angle?: string;
  swiped_from?: string;
  num_scenes?: number;
  scenes: MasterScene[];
}

interface MasterProject {
  title: string;
  brand?: string;
  voice?: string;
  totals?: {
    creatives?: number;
    scenes?: number;
    batches?: Record<string, number>;
  };
  creatives: MasterCreative[];
}

type BoardProjectId = 'fpa' | 'hn';

interface BoardScene {
  key: string;
  letter: string;
  text: string;
  status: BeatStatus;
  words: number;
}

interface BoardCreative {
  key: string;
  project: BoardProjectId;
  id: string;
  scenes: BoardScene[];
  job?: FinishJob;
}

interface PreviewScene {
  title: string;
  text: string;
}

async function getJSON<T>(path: string): Promise<T> {
  const response = await fetch(SERVER + path);
  return response.json();
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(SERVER + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}

const beatList = (snapshot: WaveSnapshot | null): Beat[] =>
  snapshot ? (Object.values(snapshot.beats) as Beat[]) : [];

const ACTIVE: BeatStatus[] = ['creating', 'generating', 'downloading'];

const STATUS_COPY: Record<BeatStatus, { label: string; tone: string; glyph: string }> = {
  pending: { label: 'Missing', tone: 'pending', glyph: '' },
  creating: { label: 'Starting', tone: 'active', glyph: '' },
  generating: { label: 'Making', tone: 'active', glyph: '' },
  downloading: { label: 'Saving', tone: 'active', glyph: '' },
  done: { label: 'Ready', tone: 'done', glyph: '' },
  failed: { label: 'Fix me', tone: 'failed', glyph: '' },
};

const FLOW_STEPS = [
  { key: 'glue', label: 'Glue', Icon: Link2 },
  { key: 'captions', label: 'Captions', Icon: Captions },
  { key: 'music', label: 'Music', Icon: Music2 },
  { key: 'folder', label: 'Folder', Icon: FolderOpen },
];

const textKey = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const creativeTextKey = (creative: MasterCreative): string =>
  textKey((creative.scenes || []).map((scene) => scene.text).join(' '));

const creativeCompareText = (creative: MasterCreative): string =>
  [
    creative.angle || '',
    creative.swiped_from || '',
    ...(creative.scenes || []).map((scene) => scene.text),
  ].join(' ');

const tokenSet = (text: string): Set<string> =>
  new Set(textKey(text).split(' ').filter((word) => word.length > 3));

const creativeSimilarity = (a: MasterCreative, b: MasterCreative): number => {
  const left = tokenSet(creativeCompareText(a));
  const right = tokenSet(creativeCompareText(b));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  left.forEach((token) => {
    if (right.has(token)) overlap += 1;
  });
  return overlap / Math.min(left.size, right.size);
};

const wordCount = (text: string): number => text.split(/\s+/).filter(Boolean).length;

const readStoredSet = (key: string): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch {
    return new Set();
  }
};

const writeStoredSet = (key: string, value: Set<string>) => {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(value)));
  } catch {
    /* ignore storage failures */
  }
};

const readStoredProject = (): BoardProjectId => {
  try {
    return localStorage.getItem('cf_active_candy_project') === 'hn' ? 'hn' : 'fpa';
  } catch {
    return 'fpa';
  }
};

export const SmoothSailing: React.FC = () => {
  const [snapshot, setSnapshot] = useState<WaveSnapshot | null>(null);
  const [waves, setWaves] = useState<WaveSummary[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [currentWave, setCurrentWave] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ss_wave');
      return saved ? Number(saved) : DEFAULT_WAVE;
    } catch {
      return DEFAULT_WAVE;
    }
  });
  const [serverUp, setServerUp] = useState<boolean | null>(null);
  const [keyLoaded, setKeyLoaded] = useState<boolean>(false);
  const [credit, setCredit] = useState<string>('');
  const [busy, setBusy] = useState<string>('');
  const [toast, setToast] = useState<string>('');
  const [activeProject, setActiveProject] = useState<BoardProjectId>(readStoredProject);
  const [openScripts, setOpenScripts] = useState<Set<string>>(() => readStoredSet('cf_open_fpa_creatives'));
  const [previewBeatId, setPreviewBeatId] = useState<string>('');
  const [selectedScriptId, setSelectedScriptId] = useState<string>('');
  const [selectedFinishAction, setSelectedFinishAction] = useState<FinishAction>('whole');
  const [finishJobs, setFinishJobs] = useState<FinishJob[]>([]);
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string>(() => {
    try { return localStorage.getItem('cf_candy_avatar') || ''; } catch { return ''; }
  });
  const [masterProject, setMasterProject] = useState<MasterProject | null>(null);
  const [openMasterCreatives, setOpenMasterCreatives] = useState<Set<string>>(() => readStoredSet('cf_open_hn_creatives'));
  const collapseTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  };

  const refresh = useCallback(async () => {
    try {
      const result = await getJSON<{ ok: boolean; wave?: WaveSnapshot }>(`/aa/wave/${currentWave}`);
      setServerUp(true);
      if (result.ok && result.wave) {
        setSnapshot(result.wave);
      } else {
        setSnapshot(null);
      }
    } catch {
      setServerUp(false);
    }
  }, [currentWave]);

  const refreshMeta = useCallback(async () => {
    try {
      const health = await getJSON<{ ok: boolean; keyLoaded?: boolean }>('/aa/health');
      setServerUp(true);
      setKeyLoaded(!!health.keyLoaded);
    } catch {
      setServerUp(false);
    }

    try {
      const result = await getJSON<{ ok: boolean; waves: WaveSummary[] }>('/aa/waves');
      if (result.ok) setWaves(result.waves || []);
    } catch {
      /* keep the screen usable with the current wave */
    }

    try {
      const result = await getJSON<{ ok: boolean; avatars: Avatar[] }>('/aa/avatars');
      if (result.ok) setAvatars(result.avatars || []);
    } catch {
      /* avatars are optional for the first-pass front end */
    }

    try {
      const result = await getJSON<{ ok: boolean; raw?: unknown }>('/aa/credit');
      if (result.ok) {
        const raw = result.raw as any;
        const value =
          typeof raw === 'object' && raw
            ? raw.data?.credits ?? raw.data?.credit ?? raw.credits ?? raw.data ?? ''
            : raw;
        setCredit(String(value ?? '').slice(0, 24));
      }
    } catch {
      /* credit is nice-to-have */
    }
  }, []);

  const refreshFinishJobs = useCallback(async () => {
    try {
      const result = await getJSON<{ ok: boolean; jobs?: FinishJob[] }>(`/aa/finish/status?wave=${currentWave}`);
      if (result.ok) setFinishJobs(result.jobs || []);
    } catch {
      /* finish jobs are optional for the scene board */
    }
  }, [currentWave]);

  useEffect(() => {
    refreshMeta();
    refresh();
    refreshFinishJobs();
    const intervalId = window.setInterval(() => {
      refresh();
      refreshFinishJobs();
    }, POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [refresh, refreshMeta, refreshFinishJobs]);

  useEffect(() => {
    let cancelled = false;
    fetch(MASTER_PROJECT_PATH)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load master project: ${response.status}`);
        return response.json();
      })
      .then((project: MasterProject) => {
        if (!cancelled) setMasterProject(project);
      })
      .catch(() => {
        if (!cancelled) setMasterProject(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ss_wave', String(currentWave));
    } catch {
      /* ignore storage failures */
    }
  }, [currentWave]);

  useEffect(() => {
    try {
      localStorage.setItem('cf_active_candy_project', activeProject);
    } catch {
      /* ignore storage failures */
    }
  }, [activeProject]);

  useEffect(() => {
    writeStoredSet('cf_open_fpa_creatives', openScripts);
  }, [openScripts]);

  useEffect(() => {
    writeStoredSet('cf_open_hn_creatives', openMasterCreatives);
  }, [openMasterCreatives]);

  const counts = snapshot?.counts || {
    pending: 0,
    creating: 0,
    generating: 0,
    downloading: 0,
    done: 0,
    failed: 0,
  };
  const activeCount = (counts.creating || 0) + (counts.generating || 0) + (counts.downloading || 0);

  const scripts = useMemo(() => {
    if (!snapshot) return [] as { scriptId: string; beats: Beat[] }[];
    const grouped: Record<string, Beat[]> = {};

    for (const beat of beatList(snapshot)) {
      (grouped[beat.scriptId] = grouped[beat.scriptId] || []).push(beat);
    }

    for (const scriptId of Object.keys(grouped)) {
      grouped[scriptId].sort((a, b) => a.letter.localeCompare(b.letter));
    }

    const order = snapshot.uiOrder?.length ? snapshot.uiOrder : Object.keys(grouped).sort();
    const seen = new Set<string>();
    const ordered: { scriptId: string; beats: Beat[] }[] = [];

    for (const scriptId of order) {
      if (grouped[scriptId] && !seen.has(scriptId)) {
        ordered.push({ scriptId, beats: grouped[scriptId] });
        seen.add(scriptId);
      }
    }

    for (const scriptId of Object.keys(grouped).sort()) {
      if (!seen.has(scriptId)) ordered.push({ scriptId, beats: grouped[scriptId] });
    }

    return ordered;
  }, [snapshot]);

  const total = beatList(snapshot).length;
  const ready = counts.done || 0;
  const missing = (counts.pending || 0) + (counts.failed || 0);
  const percent = total ? Math.round((ready / total) * 100) : 0;
  const allReady = total > 0 && ready === total;

  const selectedScript = useMemo(
    () => scripts.find((script) => script.scriptId === selectedScriptId),
    [scripts, selectedScriptId],
  );
  const selectedScriptReady = !!selectedScript?.beats.length && selectedScript.beats.every((beat) => beat.status === 'done');

  const generatedCreativeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const script of scripts) {
      keys.add(textKey(script.beats.map((beat) => beat.text).join(' ')));
    }
    return keys;
  }, [scripts]);

  const hnCreatives = useMemo(() => {
    if (!masterProject) return [] as MasterCreative[];
    const kept: MasterCreative[] = [];
    const compareAgainst: MasterCreative[] = [];

    for (const creative of masterProject.creatives || []) {
      const isAlreadyGenerated = generatedCreativeKeys.has(creativeTextKey(creative));
      const isRanked = /(^rank|_rank$)/i.test(creative.source_id || creative.uid);
      const duplicatesEarlierSwipeIdea =
        isRanked && compareAgainst.some((existing) => creativeSimilarity(creative, existing) >= 0.5);

      if (isAlreadyGenerated || duplicatesEarlierSwipeIdea) continue;

      compareAgainst.push(creative);
      const displayName = `HN${String(kept.length + 1).padStart(2, '0')}${isRanked ? '_rank' : ''}`;
      kept.push({ ...creative, displayName });
    }

    return kept;
  }, [masterProject, generatedCreativeKeys]);

  const latestJobByScript = useMemo(() => {
    const byScript = new Map<string, FinishJob>();
    for (const job of finishJobs) {
      if (Number(job.wave) !== Number(currentWave)) continue;
      if (!byScript.has(job.scriptId)) byScript.set(job.scriptId, job);
    }
    return byScript;
  }, [finishJobs, currentWave]);

  const fpaCreatives = useMemo<BoardCreative[]>(() => (
    scripts.map(({ scriptId, beats }) => ({
      key: scriptId,
      project: 'fpa',
      id: scriptId,
      job: latestJobByScript.get(scriptId),
      scenes: beats.map((beat) => ({
        key: beat.beatId,
        letter: beat.letter,
        text: beat.text,
        status: beat.status,
        words: wordCount(beat.text),
      })),
    }))
  ), [scripts, latestJobByScript]);

  const hnBoardCreatives = useMemo<BoardCreative[]>(() => (
    hnCreatives.map((creative) => {
      const id = creative.displayName || creative.source_id || creative.uid;
      return {
        key: creative.uid,
        project: 'hn',
        id,
        scenes: creative.scenes.map((scene, index) => ({
          key: `hn:${creative.uid}:${index}`,
          letter: String.fromCharCode(65 + index),
          text: scene.text,
          status: 'pending',
          words: scene.words || wordCount(scene.text),
        })),
      };
    })
  ), [hnCreatives]);

  const boardCreatives = activeProject === 'hn' ? hnBoardCreatives : fpaCreatives;

  const boardLetters = useMemo(() => {
    const set = new Set<string>();
    for (const creative of boardCreatives) {
      for (const scene of creative.scenes) set.add(scene.letter);
    }
    return Array.from(set).sort();
  }, [boardCreatives]);

  const previewScene = useMemo<PreviewScene | undefined>(() => {
    if (!previewBeatId) return undefined;
    for (const creative of [...fpaCreatives, ...hnBoardCreatives]) {
      const scene = creative.scenes.find((candidate) => candidate.key === previewBeatId);
      if (scene) {
        return {
          title: creative.project === 'fpa' ? scene.key : `${creative.id}-${scene.letter.toLowerCase()}`,
          text: scene.text,
        };
      }
    }
    return undefined;
  }, [fpaCreatives, hnBoardCreatives, previewBeatId]);

  const selectedFinishJob = selectedScriptId ? latestJobByScript.get(selectedScriptId) : undefined;
  const selectedHasCaptions = !!selectedFinishJob?.captionedFile;

  const selectedActionLabel = (() => {
    if (activeProject === 'hn') return 'Generate all remaining';
    if (!selectedScript) return 'Generate all remaining';
    if (selectedFinishAction === 'glue') return 'Regenerate glue + captions';
    if (selectedFinishAction === 'captions') return 'Regenerate captions';
    if (selectedFinishAction === 'music') return 'Change song';
    return 'Generate selected';
  })();

  const selectedActionDisabled =
    activeProject === 'hn' ||
    !snapshot ||
    !!busy ||
    (!!selectedScript &&
      (((selectedFinishAction === 'glue' || selectedFinishAction === 'captions' || selectedFinishAction === 'music') && !selectedScriptReady) ||
        (selectedFinishAction === 'music' && !selectedHasCaptions)));

  const firstVideo = useMemo(() => {
    const done = beatList(snapshot).find((beat) => beat.status === 'done' && beat.path);
    if (!done?.path) return '';
    return `${SERVER}/aa/file/${currentWave}/${encodeURIComponent(done.path.split('/').pop() || '')}`;
  }, [snapshot, currentWave]);

  const generateMissing = async () => {
    setBusy('missing');
    const result = await postJSON<{ ok: boolean; enqueued?: unknown[]; skipped?: unknown[]; error?: string }>('/aa/generate', {
      wave: currentWave,
    });
    setBusy('');
    if (result.ok) flash(`Sent ${result.enqueued?.length || 0} scenes to make`);
    else flash(result.error || 'Could not start generation');
    refresh();
  };

  const finishSelectedAd = async () => {
    if (!selectedScript) {
      await generateMissing();
      return;
    }
    if ((selectedFinishAction === 'glue' || selectedFinishAction === 'captions' || selectedFinishAction === 'music') && !selectedScriptReady) {
      flash('Scenes need to be ready first');
      return;
    }
    if (selectedFinishAction === 'music' && !selectedHasCaptions) {
      flash('Captions need to exist before changing the song');
      return;
    }

    const regenerateScenes = selectedFinishAction === 'whole' && selectedScriptReady;
    const glueOnly = selectedFinishAction === 'glue';
    const captionsOnly = selectedFinishAction === 'captions';
    const musicOnly = selectedFinishAction === 'music';
    setBusy(selectedFinishAction);
    const result = await postJSON<{ ok: boolean; jobs?: { id: string }[]; error?: string }>('/aa/finish', {
      wave: currentWave,
      scriptIds: [selectedScript.scriptId],
      templateName: 'Ella',
      musicVolume: 15,
      musicStartSec: 5,
      generateFirst: selectedFinishAction === 'whole' && !selectedScriptReady,
      regenerateScenes,
      musicOnly,
      forceStitch: regenerateScenes || glueOnly,
    });
    setBusy('');
    if (result.ok && regenerateScenes) flash(`Regenerating ${selectedScript.scriptId} from scratch`);
    else if (result.ok && glueOnly) flash(`Regenerating glue and captions for ${selectedScript.scriptId}`);
    else if (result.ok && captionsOnly) flash(`Regenerating captions for ${selectedScript.scriptId}`);
    else if (result.ok && musicOnly) flash(`Changing song for ${selectedScript.scriptId}`);
    else if (result.ok) flash(`Started ${selectedScript.scriptId} ad`);
    else flash(result.error || 'Could not start this ad');
    refresh();
    refreshFinishJobs();
  };

  const retryFailed = async () => {
    const failedIds = beatList(snapshot).filter((beat) => beat.status === 'failed').map((beat) => beat.beatId);
    if (!failedIds.length) {
      flash('No failed scenes');
      return;
    }

    setBusy('retry');
    const result = await postJSON<{ ok: boolean; enqueued?: unknown[]; error?: string }>('/aa/generate', {
      wave: currentWave,
      beatIds: failedIds,
    });
    setBusy('');
    if (result.ok) flash(`Retrying ${result.enqueued?.length || 0} scenes`);
    else flash(result.error || 'Could not retry scenes');
    refresh();
  };

  const setWaveAvatar = async (avatarId: string) => {
    const result = await postJSON<{ ok: boolean; wave?: WaveSnapshot; error?: string }>('/aa/wave/avatar', {
      wave: currentWave,
      avatarId,
    });
    if (result.ok && result.wave) {
      setSnapshot(result.wave);
      flash(`Avatar set to ${result.wave.avatarName || 'coach'}`);
    } else {
      flash(result.error || 'Could not change avatar');
    }
  };

  const setWaveLength = async (lengthSec: number) => {
    const result = await postJSON<{ ok: boolean; wave?: WaveSnapshot; error?: string }>('/aa/wave/length', {
      wave: currentWave,
      lengthSec,
    });
    if (result.ok && result.wave) {
      setSnapshot(result.wave);
      flash(`${lengthSec} second clips selected`);
    } else {
      flash(result.error || 'Could not change clip length');
    }
  };

  const openFolder = async () => {
    await postJSON('/aa/open', { wave: currentWave });
  };

  const openFinishFolder = async (job: FinishJob) => {
    const result = await postJSON<{ ok: boolean; path?: string; error?: string }>('/aa/open', { jobId: job.id });
    flash(result.ok ? 'Opened finished video folder' : result.error || 'Could not open export folder');
  };

  const handleAvatarFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setCustomAvatarUrl(dataUrl);
      try { localStorage.setItem('cf_candy_avatar', dataUrl); } catch {}
    };
    reader.readAsDataURL(file);
  };

  const toggleScript = (scriptId: string) => {
    setOpenScripts((previous) => {
      const next = new Set(previous);
      next.has(scriptId) ? next.delete(scriptId) : next.add(scriptId);
      return next;
    });
  };

  const toggleMasterCreative = (creativeId: string) => {
    setOpenMasterCreatives((previous) => {
      const next = new Set(previous);
      next.has(creativeId) ? next.delete(creativeId) : next.add(creativeId);
      return next;
    });
  };

  const collapseAllScripts = () => {
    setOpenScripts(new Set());
    setOpenMasterCreatives(new Set());
    flash('All creatives minimized');
  };

  const startScriptHold = () => {
    longPressTriggered.current = false;
    if (collapseTimer.current) window.clearTimeout(collapseTimer.current);
    collapseTimer.current = window.setTimeout(() => {
      collapseTimer.current = null;
      longPressTriggered.current = true;
      collapseAllScripts();
    }, 1000);
  };

  const stopScriptHold = () => {
    if (collapseTimer.current) {
      window.clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  };

  const selectScript = (scriptId: string, action: FinishAction = 'whole') => {
    setActiveProject('fpa');
    setSelectedScriptId(scriptId);
    setSelectedFinishAction(action);
    setOpenScripts((previous) => new Set(previous).add(scriptId));
  };

  const selectBoardScene = (creative: BoardCreative, scene: BoardScene, action: FinishAction = 'whole') => {
    setPreviewBeatId(scene.key);
    if (creative.project === 'fpa') {
      selectScript(creative.id, action);
      return;
    }

    setActiveProject('hn');
    setSelectedScriptId('');
    setSelectedFinishAction('whole');
    setOpenMasterCreatives((previous) => new Set(previous).add(creative.key));
  };

  const clearSelection = () => {
    setSelectedScriptId('');
    setSelectedFinishAction('whole');
    setPreviewBeatId('');
  };

  const clearSelectionFromBlank = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, select, input, textarea, a, video, .ss-scene')) return;
    clearSelection();
  };

  return (
    <div className="ss-root" onClick={clearSelectionFromBlank}>
      <style>{SMOOTH_STYLE}</style>

      <header className="ss-hero">
        <div className="ss-brand">
          <div className="ss-mark"><Waves size={25} /></div>
          <div>
            <p className="ss-kicker">Candy Flow</p>
          </div>
        </div>

        <div className="ss-top-pills">
          <span className="ss-top-pill"><Sparkles size={15} /> {credit || '-'} credits</span>
          <span className={`ss-top-pill ${serverUp && keyLoaded ? 'ok' : 'warn'}`}>
            <span className="ss-live-dot" />
            {serverUp ? (keyLoaded ? 'ready' : 'needs key') : 'server off'}
          </span>
          <button className="ss-mini-button" onClick={openFolder} title="Open output folder">
            <FolderOpen size={17} />
          </button>
        </div>
      </header>

      {serverUp === false && (
        <div className="ss-alert">
          <AlertTriangle size={18} />
          Start the generation server on port 8783, then press refresh.
        </div>
      )}

      <main className="ss-shell">
        {snapshot && (
          <section className={`ss-progress-band ${previewScene ? 'has-preview' : ''}`}>
            <div className="ss-avatar-bubble">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={(event) => handleAvatarFile(event.target.files?.[0])}
                hidden
              />
              {customAvatarUrl ? (
                customAvatarUrl.startsWith('data:video') ? (
                  <video src={customAvatarUrl} muted loop autoPlay playsInline />
                ) : (
                  <img src={customAvatarUrl} alt="" />
                )
              ) : firstVideo ? (
                <video src={firstVideo} muted loop autoPlay playsInline />
              ) : (
                <Waves size={42} />
              )}
              <button className="ss-avatar-edit" onClick={() => avatarInputRef.current?.click()} title="Change image">
                <Pencil size={16} />
              </button>
            </div>

            <div className="ss-progress-main">
              <div className="ss-progress-title">
                <div>
                  <p>W{snapshot.wave} - {snapshot.label}</p>
                  <h2>{ready} of {total} scenes ready</h2>
                </div>
                <strong>{percent}%</strong>
              </div>
              <div className="ss-progress-track" aria-label={`${percent}% complete`}>
                <div style={{ width: `${percent}%` }} />
              </div>
              <div className="ss-count-row">
                <StatusCount tone="done" label="Ready" value={ready} />
                <StatusCount tone="active" label="Making" value={activeCount} />
                <StatusCount tone="pending" label="Missing" value={counts.pending || 0} />
                <StatusCount tone="failed" label="Fix me" value={counts.failed || 0} />
                <div className="ss-progress-actions">
                  <button
                    className="ss-go"
                    disabled={selectedActionDisabled}
                    onClick={finishSelectedAd}
                  >
                    {busy ? <Loader2 size={21} className="ss-spin" /> : <Play size={21} />}
                    {selectedActionLabel}
                  </button>
                  {!!counts.failed && (
                    <button className="ss-icon-action" disabled={busy === 'retry'} onClick={retryFailed} title="Retry failed scenes">
                      {busy === 'retry' ? <Loader2 size={19} className="ss-spin" /> : <RotateCcw size={19} />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {previewScene && (
              <div className="ss-preview-card">
                <span>{previewScene.title}</span>
                <p>{previewScene.text}</p>
              </div>
            )}
          </section>
        )}

        {!!boardCreatives.length && (
          <section className="ss-board-section">
            <div className="ss-section-title">
              <h2>Creative candy board</h2>
            </div>
            <div className="ss-board-scroll">
              <table className="ss-board">
                <thead>
                  <tr>
                    <th>Creative</th>
                    {boardLetters.map((letter) => <th key={letter}>{letter.toUpperCase()}</th>)}
                    <th className="ss-flow-heading">Finish flow</th>
                  </tr>
                </thead>
                <tbody>
                  {boardCreatives.map((creative) => {
                    const byLetter: Record<string, BoardScene> = {};
                    creative.scenes.forEach((scene) => { byLetter[scene.letter] = scene; });
                    const isSelected =
                      (creative.project === 'fpa' && selectedScriptId === creative.id) ||
                      creative.scenes.some((scene) => scene.key === previewBeatId);
                    return (
                      <tr key={creative.key} className={isSelected ? 'selected' : ''}>
                        <td>
                          <button
                            className="ss-script-pick"
                            onClick={() => {
                              if (creative.project === 'fpa') selectScript(creative.id, 'whole');
                              else {
                                setActiveProject('hn');
                                setSelectedScriptId('');
                                setOpenMasterCreatives((previous) => new Set(previous).add(creative.key));
                              }
                            }}
                            title={`Select ${creative.id}`}
                          >
                            {creative.id}
                          </button>
                        </td>
                        {boardLetters.map((letter) => {
                          const scene = byLetter[letter];
                          if (!scene) return <td key={letter}><span className="ss-candy empty" /></td>;
                          return (
                            <td key={letter}>
                              <button
                                className={`ss-candy ${STATUS_COPY[scene.status].tone} ${previewBeatId === scene.key ? 'picked' : ''}`}
                                title={`${creative.id}-${scene.letter.toLowerCase()}: ${STATUS_COPY[scene.status].label}`}
                                onClick={() => selectBoardScene(creative, scene, 'whole')}
                              >
                                {scene.status === 'done' && <Check size={18} />}
                                {ACTIVE.includes(scene.status) && <Loader2 size={17} className="ss-spin" />}
                                {scene.status === 'failed' && <XCircle size={17} />}
                                {scene.status === 'pending' && <span />}
                              </button>
                            </td>
                          );
                        })}
                        <td className="ss-flow-cell">
                          <div className="ss-flow-road" aria-label={`${creative.id} finish flow`}>
                            {FLOW_STEPS.map((step) => (
                              <FlowStep
                                key={step.key}
                                stepKey={step.key}
                                label={step.label}
                                Icon={step.Icon}
                                job={creative.job}
                                chosen={
                                  selectedScriptId === creative.id &&
                                  ((selectedFinishAction === 'glue' && step.key === 'glue') ||
                                    (selectedFinishAction === 'captions' && step.key === 'captions') ||
                                    (selectedFinishAction === 'music' && step.key === 'music'))
                                }
                                onSelectAction={
                                  creative.project === 'fpa'
                                    ? step.key === 'glue'
                                      ? () => selectScript(creative.id, 'glue')
                                      : step.key === 'captions'
                                      ? () => selectScript(creative.id, 'captions')
                                      : step.key === 'music'
                                        ? () => selectScript(creative.id, 'music')
                                        : undefined
                                    : undefined
                                }
                                onOpenFolder={creative.job?.status === 'done' && step.key === 'folder' ? () => openFinishFolder(creative.job!) : undefined}
                              />
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!snapshot && serverUp && (
          <section className="ss-empty">
            <Waves size={36} />
            <h2>No scenes loaded for W{currentWave}</h2>
            <p>Start the Candy Flow demo server, then reload the app.</p>
          </section>
        )}

        {(!!scripts.length || !!masterProject) && (
          <section className="ss-script-list">
            <div className="ss-section-title">
              <h2>Projects</h2>
            </div>
            <button className="ss-project-divider" onClick={() => {
              setActiveProject('fpa');
              clearSelection();
            }}>
              <span>{activeProject === 'fpa' ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
              <strong>Demo project</strong>
              <em>{scripts.length}</em>
            </button>

            {activeProject === 'fpa' && fpaCreatives.map((creative) => (
              <CreativeCard
                key={creative.key}
                creative={creative}
                isOpen={openScripts.has(creative.key)}
                isSelected={selectedScriptId === creative.id}
                previewSceneKey={previewBeatId}
                onToggle={() => toggleScript(creative.key)}
                onHoldStart={startScriptHold}
                onHoldStop={stopScriptHold}
                consumeLongPress={() => {
                  if (!longPressTriggered.current) return false;
                  longPressTriggered.current = false;
                  return true;
                }}
                onSelect={() => selectScript(creative.id, 'whole')}
                onPreview={(scene) => setPreviewBeatId(scene.key)}
              />
            ))}

            <button className="ss-project-divider" onClick={() => {
              setActiveProject('hn');
              clearSelection();
            }}>
              <span>{activeProject === 'hn' ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
              <strong>Swipe project</strong>
              <em>{hnCreatives.length}</em>
            </button>

            {activeProject === 'hn' && hnBoardCreatives.map((creative) => (
              <CreativeCard
                key={creative.key}
                creative={creative}
                isOpen={openMasterCreatives.has(creative.key)}
                isSelected={creative.scenes.some((scene) => scene.key === previewBeatId)}
                previewSceneKey={previewBeatId}
                onToggle={() => toggleMasterCreative(creative.key)}
                onHoldStart={startScriptHold}
                onHoldStop={stopScriptHold}
                consumeLongPress={() => {
                  if (!longPressTriggered.current) return false;
                  longPressTriggered.current = false;
                  return true;
                }}
                onSelect={() => {
                  setActiveProject('hn');
                  setSelectedScriptId('');
                  setOpenMasterCreatives((previous) => new Set(previous).add(creative.key));
                }}
                onPreview={(scene) => selectBoardScene(creative, scene)}
              />
            ))}
          </section>
        )}
      </main>

      {toast && <div className="ss-toast">{toast}</div>}
    </div>
  );
};

const StatusCount: React.FC<{ tone: string; label: string; value: number }> = ({ tone, label, value }) => (
  <div className={`ss-count ${tone}`}>
    <strong>{value}</strong>
    <span>{label}</span>
  </div>
);

const CreativeCard: React.FC<{
  creative: BoardCreative;
  isOpen: boolean;
  isSelected: boolean;
  previewSceneKey: string;
  onToggle: () => void;
  onHoldStart: () => void;
  onHoldStop: () => void;
  consumeLongPress: () => boolean;
  onSelect: () => void;
  onPreview: (scene: BoardScene) => void;
}> = ({
  creative,
  isOpen,
  isSelected,
  previewSceneKey,
  onToggle,
  onHoldStart,
  onHoldStop,
  consumeLongPress,
  onSelect,
  onPreview,
}) => {
  const readyScenes = creative.scenes.filter((scene) => scene.status === 'done').length;

  return (
    <article className={`ss-script ${isSelected ? 'selected' : ''}`}>
      <button
        className="ss-script-head"
        onClick={() => {
          if (consumeLongPress()) return;
          onToggle();
        }}
        onPointerDown={onHoldStart}
        onPointerUp={onHoldStop}
        onPointerLeave={onHoldStop}
        onPointerCancel={onHoldStop}
      >
        <span className="ss-script-toggle">{isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}</span>
        <span
          className="ss-script-name"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        >
          {creative.id}
        </span>
        <span className="ss-script-mini">
          {creative.scenes.map((scene) => (
            <span key={scene.key} className={STATUS_COPY[scene.status].tone} />
          ))}
        </span>
        <strong>{readyScenes}/{creative.scenes.length}</strong>
      </button>

      {isOpen && (
        <div className="ss-scenes">
          {creative.scenes.map((scene) => (
            <SceneLine
              key={scene.key}
              scene={scene}
              isPreview={previewSceneKey === scene.key}
              onPreview={() => onPreview(scene)}
            />
          ))}
        </div>
      )}
    </article>
  );
};

interface MasterCreativeCardProps {
  creative: MasterCreative;
  isOpen: boolean;
  onToggle: () => void;
}

const MasterCreativeCard: React.FC<MasterCreativeCardProps> = ({
  creative,
  isOpen,
  onToggle,
}) => {
  const sceneCount = creative.num_scenes || creative.scenes.length;
  const name = creative.displayName || creative.source_id || creative.uid;

  return (
    <article className="ss-master-creative">
      <button className="ss-master-head" onClick={onToggle}>
        <span className="ss-script-toggle">{isOpen ? <ChevronDown size={19} /> : <ChevronRight size={19} />}</span>
        <span className="ss-master-name">
          <strong>{name}</strong>
        </span>
        <span className="ss-master-mini" aria-hidden="true">
          {Array.from({ length: sceneCount }).map((_, index) => (
            <span key={`${creative.uid}-${index}`} />
          ))}
        </span>
        <strong>{sceneCount}</strong>
      </button>

      {isOpen && (
        <div className="ss-master-scenes">
          {creative.scenes.map((scene, index) => (
            <div className="ss-master-scene" key={`${creative.uid}-${scene.scene}-${index}`}>
              <span>{String.fromCharCode(65 + index)}</span>
              <p>{scene.text}</p>
              {scene.words ? <small>{scene.words} words</small> : null}
            </div>
          ))}
        </div>
      )}
    </article>
  );
};

const flowTone = (job: FinishJob | undefined, stepKey: string): string => {
  if (!job) return 'waiting';
  if (job.status === 'cancelled') return 'waiting';
  if (job.status === 'done') return stepKey === 'folder' ? 'exported' : 'done';
  if (job.status === 'failed') {
    if (stepKey === 'glue') return job.combined ? 'done' : 'failed';
    if (stepKey === 'captions') return job.captionedFile ? 'done' : (job.combined ? 'failed' : 'waiting');
    if (stepKey === 'music') return job.musicFile ? 'done' : (job.captionedFile ? 'failed' : 'waiting');
    if (stepKey === 'folder') return job.exported?.folder ? 'exported' : (job.musicFile ? 'failed' : 'waiting');
    return 'failed';
  }

  const stage = job.stage || 'queued';
  if (stepKey === 'glue') {
    if (job.combined || ['submagic-upload', 'submagic-processing', 'music', 'export'].includes(stage)) return 'done';
    if (stage === 'stitching') return 'active';
    return 'waiting';
  }
  if (stepKey === 'captions') {
    if (job.captionedFile || ['music', 'export'].includes(stage)) return 'done';
    if (stage === 'submagic-upload' || stage === 'submagic-processing') return 'active';
    return 'waiting';
  }
  if (stepKey === 'music') {
    if (job.musicFile || stage === 'export') return 'done';
    if (stage === 'music') return 'active';
    return 'waiting';
  }
  if (stepKey === 'folder') {
    if (job.status === 'done') return 'exported';
    if (stage === 'export') return 'active';
    return 'waiting';
  }
  return 'waiting';
};

const FlowStep: React.FC<{
  stepKey: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  job?: FinishJob;
  chosen?: boolean;
  onSelectAction?: () => void;
  onOpenFolder?: () => void;
}> = ({ stepKey, label, Icon, job, chosen, onSelectAction, onOpenFolder }) => {
  const tone = flowTone(job, stepKey);
  const isActive = tone === 'active';
  const title = job?.error ? `${label}: ${job.error}` : `${label}: ${tone}`;
  const content = (
    <>
      {isActive ? <Loader2 size={18} className="ss-spin" /> : <Icon size={18} />}
      <small>{label}</small>
    </>
  );

  if (onOpenFolder) {
    return (
      <button className={`ss-flow-step ${tone}`} title="Open exported video folder" onClick={onOpenFolder}>
        {content}
      </button>
    );
  }

  if (onSelectAction) {
    return (
      <button className={`ss-flow-step ${tone} ${chosen ? 'chosen' : ''}`} title={title} onClick={onSelectAction}>
        {content}
      </button>
    );
  }

  return (
    <span className={`ss-flow-step ${tone}`} title={title}>
      {content}
    </span>
  );
};

const SceneLine: React.FC<{
  scene: BoardScene;
  isPreview: boolean;
  onPreview: () => void;
}> = ({ scene, isPreview, onPreview }) => {
  return (
    <div className={`ss-scene ${isPreview ? 'picked' : ''}`} onClick={onPreview}>
      <span className="ss-letter">{scene.letter.toUpperCase()}</span>
      <p>{scene.text}</p>
      <small>{scene.words} words</small>
    </div>
  );
};

const SMOOTH_STYLE = `
.ss-root { --ink:#263042; --muted:#6f7b8d; --line:#dfe8f4; --paper:#fffdf7; --sea:#2ec4b6; --sky:#4dabf7; --sun:#ffd166; --berry:#ef476f; --leaf:#06d6a0; --grape:#7b61ff; --cloud:#f5f9ff; color:var(--ink); min-height:100vh; margin:0; overflow:auto; background:
  radial-gradient(circle at 18% 5%, rgba(255,209,102,0.35), transparent 24%),
  radial-gradient(circle at 80% 0%, rgba(77,171,247,0.28), transparent 26%),
  linear-gradient(180deg,#f6fbff 0%,#fffdf7 52%,#f4fff9 100%); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
.ss-root *, .ss-root *::before, .ss-root *::after { box-sizing:border-box; }
.ss-root button, .ss-root select { font:inherit; }
.ss-hero { display:flex; justify-content:space-between; align-items:center; gap:18px; padding:24px 34px 16px 72px; max-width:1280px; margin:0 auto; }
.ss-brand { display:flex; align-items:center; gap:15px; min-width:0; }
.ss-mark { width:58px; height:58px; border-radius:18px; display:grid; place-items:center; color:#fff; background:linear-gradient(135deg,var(--sea),var(--sky)); box-shadow:0 14px 28px rgba(46,196,182,0.28); border:3px solid rgba(255,255,255,0.86); }
.ss-kicker { margin:0; color:var(--ink); font-weight:950; font-size:28px; line-height:1; letter-spacing:0; }
.ss-hero h1 { margin:0; font-size:34px; line-height:1; letter-spacing:0; font-weight:900; }
.ss-top-pills { display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
.ss-top-pill, .ss-mini-button { min-height:42px; display:inline-flex; align-items:center; gap:8px; border:2px solid rgba(38,48,66,0.08); background:rgba(255,255,255,0.78); border-radius:14px; padding:9px 13px; color:var(--muted); font-weight:800; box-shadow:0 8px 22px rgba(79,107,137,0.1); }
.ss-top-pill.ok { color:#087f5b; }
.ss-top-pill.warn { color:#b35c00; }
.ss-live-dot { width:10px; height:10px; border-radius:50%; background:currentColor; box-shadow:0 0 0 5px color-mix(in srgb,currentColor 16%, transparent); }
.ss-mini-button { color:var(--ink); cursor:pointer; }
.ss-shell { width:min(1220px, calc(100% - 44px)); margin:0 auto; padding-bottom:82px; }
.ss-alert { width:min(1220px, calc(100% - 44px)); margin:0 auto 12px; display:flex; align-items:center; gap:10px; padding:13px 16px; border-radius:14px; background:#fff0f3; color:#ad1742; border:2px solid #ffc2d1; font-weight:800; }
.ss-command { display:flex; justify-content:flex-end; align-items:center; gap:14px; padding:0 0 2px; }
.ss-control-stack { display:flex; flex-direction:column; gap:7px; min-width:0; }
.ss-label { font-size:12px; color:var(--muted); font-weight:900; text-transform:uppercase; letter-spacing:0; }
.ss-select { width:100%; min-height:48px; border:2px solid var(--line); border-radius:14px; background:#fff; color:var(--ink); padding:0 13px; font-weight:900; outline:none; }
.ss-select:focus { border-color:var(--sky); box-shadow:0 0 0 4px rgba(77,171,247,0.16); }
.ss-choice { display:grid; grid-template-columns:1fr 1fr; gap:8px; background:#eef7ff; border:2px solid var(--line); border-radius:16px; padding:5px; }
.ss-choice button { min-height:38px; border:none; border-radius:12px; background:transparent; color:var(--muted); font-weight:900; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; }
.ss-choice button.active { background:linear-gradient(135deg,var(--sun),#ff9f1c); color:#533500; box-shadow:0 8px 14px rgba(255,159,28,0.2); }
.ss-choice button:disabled, .ss-select:disabled { opacity:0.5; cursor:not-allowed; }
.ss-main-action { display:flex; gap:10px; justify-content:flex-end; align-items:center; flex-wrap:wrap; }
.ss-go { min-height:52px; min-width:0; max-width:218px; border:none; border-radius:18px; color:#fff; background:linear-gradient(135deg,var(--sea),var(--grape)); box-shadow:0 14px 24px rgba(46,196,182,0.26); font-size:15px; font-weight:950; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; padding:0 18px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ss-go svg { flex:0 0 auto; }
.ss-go:disabled { opacity:0.55; cursor:not-allowed; }
.ss-secondary-action { min-height:52px; max-width:234px; border:2px solid var(--line); border-radius:16px; background:#fff; color:var(--muted); cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-size:14px; font-weight:950; padding:0 14px; white-space:nowrap; box-shadow:0 8px 18px rgba(75,103,130,0.08); }
.ss-secondary-action:disabled { opacity:0.42; cursor:not-allowed; }
.ss-icon-action { width:52px; height:52px; border-radius:16px; border:2px solid var(--line); background:#fff; color:var(--ink); cursor:pointer; display:grid; place-items:center; }
.ss-icon-action:disabled { opacity:0.45; cursor:not-allowed; }
.ss-progress-band { display:grid; grid-template-columns:138px minmax(0,1fr); gap:18px; align-items:stretch; margin-top:16px; }
.ss-progress-band.has-preview { grid-template-columns:138px minmax(0,1fr) 300px; }
.ss-avatar-bubble, .ss-progress-main, .ss-preview-card, .ss-board-section, .ss-script, .ss-empty { background:rgba(255,255,255,0.82); border:2px solid rgba(38,48,66,0.08); box-shadow:0 14px 34px rgba(75,103,130,0.1); }
.ss-avatar-bubble { position:relative; border-radius:24px; padding:12px; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:10px; text-align:center; font-weight:950; color:var(--ink); min-height:154px; }
.ss-avatar-bubble video, .ss-avatar-bubble img { width:88px; height:112px; object-fit:cover; border-radius:18px; border:3px solid #fff; box-shadow:0 10px 20px rgba(38,48,66,0.15); }
.ss-avatar-bubble svg { width:84px; height:84px; padding:18px; border-radius:22px; background:#e7fff9; color:#07977f; }
.ss-avatar-edit { position:absolute; right:14px; bottom:14px; width:36px; height:36px; border-radius:13px; border:3px solid #fff; background:linear-gradient(135deg,var(--sun),#ffed9e); color:#704600; cursor:pointer; display:grid; place-items:center; box-shadow:0 8px 16px rgba(38,48,66,0.16); }
.ss-avatar-edit svg { width:16px; height:16px; padding:0; border-radius:0; background:transparent; color:currentColor; }
.ss-progress-main { border-radius:24px; padding:20px; }
.ss-progress-title { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; }
.ss-progress-title p { margin:0 0 4px; color:var(--muted); font-weight:900; }
.ss-progress-title h2 { margin:0; font-size:31px; line-height:1.05; letter-spacing:0; font-weight:950; }
.ss-progress-title strong { font-size:46px; line-height:1; color:var(--sea); }
.ss-progress-track { height:22px; border-radius:999px; background:#e8edf5; overflow:hidden; margin:18px 0; border:3px solid #fff; box-shadow:inset 0 2px 7px rgba(38,48,66,0.09); }
.ss-progress-track div { height:100%; border-radius:999px; background:linear-gradient(90deg,var(--leaf),var(--sky),var(--grape)); transition:width .35s ease; }
.ss-count-row { display:grid; grid-template-columns:repeat(4,minmax(112px,1fr)) auto; gap:9px; align-items:stretch; }
.ss-count { border-radius:16px; padding:10px 13px; display:flex; align-items:baseline; justify-content:flex-start; gap:10px; font-weight:900; background:#f5f7fb; color:var(--muted); }
.ss-count strong { font-size:24px; color:var(--ink); min-width:30px; text-align:left; }
.ss-count span { white-space:nowrap; }
.ss-count.done { background:#e7fff4; color:#087f5b; }
.ss-count.active { background:#fff7dc; color:#946200; }
.ss-count.failed { background:#fff0f3; color:#ba1748; }
.ss-progress-actions { display:flex; justify-content:flex-end; align-items:stretch; gap:9px; }
.ss-progress-actions .ss-go { max-width:none; min-width:212px; min-height:100%; }
.ss-progress-actions .ss-icon-action { width:52px; height:auto; min-height:100%; }
.ss-preview-card { border-radius:24px; padding:24px 26px; display:flex; flex-direction:column; gap:12px; min-width:0; }
.ss-preview-card span { color:var(--sea); font-weight:950; }
.ss-preview-card p { margin:0; color:var(--ink); font-size:15px; line-height:1.5; overflow:auto; padding-right:2px; }
.ss-board-section, .ss-script-list, .ss-master-project { margin-top:18px; }
.ss-board-section { border-radius:24px; padding:18px; }
.ss-section-title { display:flex; align-items:end; justify-content:space-between; gap:14px; margin:0 0 13px; }
.ss-section-title h2 { margin:0; font-size:21px; letter-spacing:0; font-weight:950; }
.ss-board-scroll { overflow:auto; padding-bottom:4px; }
.ss-board { width:100%; border-collapse:separate; border-spacing:14px 12px; min-width:760px; }
.ss-board th { color:var(--muted); font-size:13px; font-weight:950; text-align:center; }
.ss-board th:first-child, .ss-board td:first-child { text-align:left; padding-right:10px; }
.ss-board td { vertical-align:middle; }
.ss-board td:first-child { font-weight:950; color:var(--ink); white-space:nowrap; }
.ss-flow-heading { text-align:left !important; padding-left:28px; }
.ss-script-pick { border:none; background:transparent; color:var(--ink); font-weight:950; cursor:pointer; padding:7px 9px; border-radius:12px; }
.ss-script-pick:hover { background:#fff7dc; }
.ss-board tr.selected .ss-script-pick { background:#fff0b8; box-shadow:0 0 0 4px rgba(255,209,102,0.32); }
.ss-board tr.selected .ss-candy { box-shadow:0 0 0 5px rgba(255,209,102,0.62), 0 9px 18px rgba(38,48,66,0.12); }
.ss-board tr.selected .ss-flow-road { background:#fffbeb; box-shadow:inset 0 0 0 2px rgba(255,209,102,0.34); }
.ss-candy { width:48px; height:48px; border-radius:15px; display:inline-grid; place-items:center; border:3px solid #fff; cursor:pointer; box-shadow:0 8px 14px rgba(38,48,66,0.12); transition:transform .13s ease, box-shadow .13s ease; }
.ss-candy:hover { transform:translateY(-2px) scale(1.04); }
.ss-candy.picked { box-shadow:0 0 0 5px rgba(255,209,102,0.78), 0 9px 18px rgba(38,48,66,0.13); }
.ss-candy.done { background:linear-gradient(135deg,#8cffcf,var(--leaf)); color:#05664e; }
.ss-candy.active { background:linear-gradient(135deg,#fff0a6,var(--sun)); color:#815300; }
.ss-candy.pending { background:linear-gradient(135deg,#edf3fb,#dfe8f4); color:#93a0b2; }
.ss-candy.failed { background:linear-gradient(135deg,#ffb5c8,var(--berry)); color:#fff; }
.ss-candy.empty { border:2px dashed #d7e1ef; background:transparent; box-shadow:none; cursor:default; }
.ss-candy.pending span { width:9px; height:9px; border-radius:50%; background:#96a3b4; }
.ss-flow-cell { width:auto; padding-left:18px; }
.ss-flow-road { width:max-content; min-width:0; display:flex; align-items:center; gap:12px; padding:8px 10px; border-radius:18px; background:#f7fbff; transition:box-shadow .13s ease, background .13s ease; }
.ss-flow-step { width:70px; min-height:54px; border-radius:16px; border:3px solid #fff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; color:#96a3b4; background:linear-gradient(135deg,#edf3fb,#dfe8f4); box-shadow:0 8px 14px rgba(38,48,66,0.1); font-weight:950; }
.ss-flow-step small { font-size:10px; line-height:1; color:currentColor; }
button.ss-flow-step { cursor:pointer; font:inherit; }
button.ss-flow-step:hover { transform:translateY(-2px); }
.ss-flow-step.done { color:#087f5b; background:linear-gradient(135deg,#dcfff0,#8cffcf); }
.ss-flow-step.active { color:#765000; background:linear-gradient(135deg,#fff4c2,var(--sun)); box-shadow:0 0 0 5px rgba(255,209,102,0.52), 0 9px 18px rgba(38,48,66,0.12); }
.ss-flow-step.exported { color:#704600; background:linear-gradient(135deg,#ffe8a3,#ffd166); box-shadow:0 0 0 5px rgba(255,209,102,0.58), 0 10px 18px rgba(38,48,66,0.14); }
.ss-flow-step.failed { color:#ba1748; background:#fff0f3; box-shadow:0 0 0 5px rgba(239,71,111,0.18), 0 9px 18px rgba(38,48,66,0.12); }
.ss-flow-step.chosen { box-shadow:0 0 0 5px rgba(123,97,255,0.28), 0 10px 18px rgba(38,48,66,0.14); }
.ss-script-list { display:flex; flex-direction:column; gap:12px; }
.ss-script-list .ss-section-title { margin-top:8px; }
.ss-script { border-radius:22px; overflow:hidden; }
.ss-script.selected { border-color:rgba(255,209,102,0.95); box-shadow:0 0 0 4px rgba(255,209,102,0.26), 0 14px 34px rgba(75,103,130,0.1); }
.ss-script-head { width:100%; display:grid; grid-template-columns:36px minmax(90px,150px) minmax(100px,1fr) 58px; align-items:center; gap:10px; padding:14px 16px; border:none; background:transparent; color:var(--ink); cursor:pointer; }
.ss-script-toggle { width:34px; height:34px; border-radius:12px; background:#eef7ff; display:grid; place-items:center; color:var(--sky); }
.ss-script-name { font-size:18px; font-weight:950; text-align:left; border-radius:12px; padding:5px 8px; margin-left:-8px; }
.ss-script-name:hover { background:#fff7dc; }
.ss-script-mini { display:flex; gap:6px; flex-wrap:wrap; }
.ss-script-mini span { width:13px; height:13px; border-radius:50%; background:#dfe8f4; }
.ss-script-mini span.done { background:var(--leaf); }
.ss-script-mini span.active { background:var(--sun); }
.ss-script-mini span.failed { background:var(--berry); }
.ss-script-head strong { font-size:17px; color:var(--sea); }
.ss-scenes { display:flex; flex-direction:column; gap:10px; padding:0 14px 14px; }
.ss-scene { display:grid; grid-template-columns:42px minmax(0,1fr) 78px; align-items:start; gap:12px; padding:14px; border-radius:18px; background:#f7fbff; border:2px solid transparent; cursor:pointer; }
.ss-scene.picked { border-color:var(--sun); background:#fffbeb; }
.ss-letter { width:38px; height:38px; border-radius:13px; display:grid; place-items:center; font-weight:950; color:#075c49; background:var(--leaf); }
.ss-scene p { margin:0; font-size:16px; line-height:1.52; color:var(--ink); }
.ss-scene small { color:var(--muted); font-weight:850; text-align:right; white-space:nowrap; padding-top:8px; }
.ss-master-project { display:flex; flex-direction:column; gap:12px; }
.ss-project-divider { width:100%; min-height:58px; border:2px solid rgba(38,48,66,0.08); border-radius:22px; background:rgba(255,255,255,0.86); color:var(--ink); cursor:pointer; box-shadow:0 14px 34px rgba(75,103,130,0.1); display:grid; grid-template-columns:36px minmax(0,1fr) 70px; align-items:center; gap:12px; padding:12px 16px; text-align:left; }
.ss-project-divider span { width:34px; height:34px; border-radius:12px; display:grid; place-items:center; color:#704600; background:linear-gradient(135deg,#ffe8a3,#ffd166); box-shadow:0 0 0 5px rgba(255,209,102,0.22); }
.ss-project-divider strong { font-size:18px; font-weight:950; }
.ss-project-divider em { min-height:32px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; background:#fff7dc; color:#704600; font-style:normal; font-weight:950; }
.ss-master-body { display:flex; flex-direction:column; gap:12px; }
.ss-master-list { display:flex; flex-direction:column; gap:10px; }
.ss-master-creative { border:2px solid rgba(38,48,66,0.08); border-radius:22px; background:rgba(255,255,255,0.82); box-shadow:0 14px 34px rgba(75,103,130,0.1); overflow:hidden; }
.ss-master-head { width:100%; border:none; background:transparent; color:var(--ink); cursor:pointer; display:grid; grid-template-columns:36px minmax(90px,150px) minmax(100px,1fr) 58px; align-items:center; gap:10px; padding:14px 16px; text-align:left; }
.ss-master-name { display:block; min-width:0; }
.ss-master-name strong { display:block; font-size:18px; font-weight:950; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ss-master-mini { display:flex; justify-content:flex-end; gap:6px; }
.ss-master-mini span { width:13px; height:13px; border-radius:50%; background:linear-gradient(135deg,#dcfff0,#8cffcf); box-shadow:0 0 0 3px rgba(6,214,160,0.08); }
.ss-master-head > strong { color:var(--sea); font-size:16px; text-align:right; }
.ss-master-scenes { display:flex; flex-direction:column; gap:9px; padding:0 13px 13px; }
.ss-master-scene { display:grid; grid-template-columns:38px minmax(0,1fr) 74px; gap:12px; align-items:start; border-radius:17px; background:#f7fbff; padding:13px; }
.ss-master-scene span { width:36px; height:36px; border-radius:13px; display:grid; place-items:center; background:var(--sea); color:#fff; font-weight:950; }
.ss-master-scene p { margin:0; color:var(--ink); font-size:15px; line-height:1.48; }
.ss-master-scene small { color:var(--muted); font-weight:850; text-align:right; }
.ss-empty { margin-top:18px; border-radius:24px; padding:34px; text-align:center; color:var(--muted); }
.ss-empty h2 { margin:10px 0 4px; color:var(--ink); }
.ss-empty p { margin:0; font-weight:800; }
.ss-toast { position:fixed; left:50%; bottom:28px; transform:translateX(-50%); z-index:70; background:#263042; color:#fff; padding:12px 18px; border-radius:16px; box-shadow:0 16px 36px rgba(38,48,66,0.24); font-weight:900; }
.ss-spin { animation:ss-spin .9s linear infinite; }
@keyframes ss-spin { to { transform:rotate(360deg); } }
@media (max-width:1050px) {
  .ss-progress-band, .ss-progress-band.has-preview { grid-template-columns:1fr 1fr; }
  .ss-preview-card { grid-column:1 / -1; }
}
@media (max-width:720px) {
  .ss-root { margin:0; }
  .ss-hero { align-items:flex-start; flex-direction:column; padding:20px 18px 12px 72px; }
  .ss-kicker { font-size:24px; }
  .ss-shell, .ss-alert { width:calc(100% - 24px); }
  .ss-progress-band, .ss-progress-band.has-preview { grid-template-columns:1fr; }
  .ss-count-row { grid-template-columns:1fr 1fr; }
  .ss-progress-actions { grid-column:1 / -1; display:grid; grid-template-columns:1fr auto; }
  .ss-progress-actions .ss-go { min-width:0; }
  .ss-section-title { align-items:flex-start; flex-direction:column; }
  .ss-script-head { grid-template-columns:36px 1fr 54px; }
  .ss-script-mini { grid-column:2 / 4; }
  .ss-scene { grid-template-columns:42px 1fr; }
  .ss-scene small { grid-column:2 / 3; text-align:left; padding-top:0; }
  .ss-project-divider, .ss-master-head, .ss-master-scene { grid-template-columns:36px 1fr; }
  .ss-project-divider em, .ss-master-mini, .ss-master-head > strong, .ss-master-scene small { grid-column:2 / 3; justify-content:flex-start; text-align:left; }
}
`;
