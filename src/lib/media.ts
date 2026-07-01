/** Browser-safe MIME selection + MediaRecorder helpers for voice/video capture. */

function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) &&
    !(window as Window & { MSStream?: unknown }).MSStream
  );
}

export function pickAudioMime(): string {
  const webmFirst = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/aac",
  ];
  const mp4First = [
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/aac",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return pickSupportedMime(isAppleDevice() ? mp4First : webmFirst);
}

export function pickVideoMime(): string {
  const candidates = isAppleDevice()
    ? [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ]
    : [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4",
      ];
  return pickSupportedMime(candidates);
}

function pickSupportedMime(candidates: string[]): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return "";
}

export function canPlayMime(mime: string): boolean {
  if (typeof document === "undefined" || !mime) return false;
  const probe = document.createElement("audio");
  const level = probe.canPlayType(mime);
  return level === "probably" || level === "maybe";
}

/** Synthesized tone when mic capture is blocked (sandbox / empty blob). */
export function makeMockToneWavUrl(seconds: number): string {
  const sr = 22050;
  const len = Math.max(1, Math.min(60, Math.round(seconds))) * sr;
  const buf = new ArrayBuffer(44 + len * 2);
  const view = new DataView(buf);
  const wstr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  wstr(0, "RIFF");
  view.setUint32(4, 36 + len * 2, true);
  wstr(8, "WAVE");
  wstr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  wstr(36, "data");
  view.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.min(1, t * 4) * Math.min(1, (seconds - t) * 4);
    const wob = 1 + 0.15 * Math.sin(2 * Math.PI * 0.6 * t);
    const s = Math.sin(2 * Math.PI * 220 * wob * t) * 0.18 + Math.sin(2 * Math.PI * 330 * t) * 0.1;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s * env)) * 0x7fff, true);
  }
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const wstr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };

  wstr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  wstr(8, "WAVE");
  wstr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  wstr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i] ?? 0));
      view.setInt16(offset, sample * 0x7fff, true);
      offset += 2;
    }
  }
  return buf;
}

/** Returns a blob URL the current browser can actually play back. */
export async function blobToPlayableAudioUrl(blob: Blob, fallbackSeconds: number): Promise<string> {
  if (blob.size <= 32) {
    console.warn("[voice] empty recording — using synthesized fallback tone", { size: blob.size });
    return makeMockToneWavUrl(fallbackSeconds);
  }

  const mime = blob.type || "audio/webm";
  if (canPlayMime(mime)) {
    return URL.createObjectURL(blob);
  }

  try {
    const Ctx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) throw new Error("AudioContext unavailable");
    const ctx = new Ctx();
    try {
      const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
      const wav = audioBufferToWav(decoded);
      console.info("[voice] converted recording to WAV for playback", {
        from: mime,
        size: blob.size,
      });
      return URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
    } finally {
      void ctx.close();
    }
  } catch (err) {
    console.warn("[voice] decode failed — using synthesized fallback tone", err);
    return makeMockToneWavUrl(fallbackSeconds);
  }
}

export function createMediaRecorder(
  stream: MediaStream,
  mime: string,
  kind?: "audio" | "video",
): MediaRecorder {
  const options: MediaRecorderOptions = {};
  if (mime) options.mimeType = mime;
  if (kind === "video") {
    options.videoBitsPerSecond = 3500000; // 3.5 Mbps optimized for 720p vertical video size under 1.5MB-2MB
  }
  try {
    return new MediaRecorder(stream, options);
  } catch {
    return new MediaRecorder(stream);
  }
}

/** Record from an existing stream for a fixed duration; resolves when recorder stops. */
export function recordStreamForMs(
  stream: MediaStream,
  durationMs: number,
  kind: "audio" | "video",
  timesliceMs = 250,
): Promise<{ blob: Blob; mimeType: string }> {
  const preferred = kind === "audio" ? pickAudioMime() : pickVideoMime();
  const rec = createMediaRecorder(stream, preferred, kind);
  const mimeType = rec.mimeType || preferred || (kind === "audio" ? "audio/webm" : "video/webm");
  const chunks: Blob[] = [];

  return new Promise((resolve, reject) => {
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    rec.onerror = () => reject(new Error("MediaRecorder error"));
    rec.onstop = () => {
      const blob = chunks.length
        ? new Blob(chunks, { type: mimeType })
        : new Blob([], { type: mimeType });
      resolve({ blob, mimeType });
    };

    try {
      rec.start(timesliceMs);
    } catch (err) {
      reject(err);
      return;
    }

    window.setTimeout(() => {
      try {
        if (rec.state === "recording") rec.requestData();
      } catch {
        /* ignore */
      }
      try {
        if (rec.state !== "inactive") rec.stop();
      } catch (err) {
        reject(err);
      }
    }, durationMs);
  });
}

export async function attachStreamToVideo(
  video: HTMLVideoElement,
  stream: MediaStream,
): Promise<void> {
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  try {
    await video.play();
  } catch {
    /* autoplay policy — user gesture will unlock */
  }
}

export async function openCamera(
  constraints: MediaStreamConstraints = { video: { facingMode: "user" }, audio: false },
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException("getUserMedia unavailable", "NotSupportedError");
  }
  return navigator.mediaDevices.getUserMedia(constraints);
}

export async function openMic(
  constraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException("getUserMedia unavailable", "NotSupportedError");
  }
  return navigator.mediaDevices.getUserMedia({ audio: constraints });
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

export function micErrorMessage(err: unknown): string {
  const e = err as DOMException;
  const map: Record<string, string> = {
    NotAllowedError: "Mikrofón je zablokovaný. Povoľ ho v adresnom riadku prehliadača.",
    PermissionDeniedError: "Mikrofón je zablokovaný. Povoľ ho v adresnom riadku prehliadača.",
    SecurityError: "Mikrofón funguje len cez HTTPS. Skús stránku znova načítať.",
    NotFoundError: "Žiadny mikrofón sa nenašiel.",
    DevicesNotFoundError: "Žiadny mikrofón sa nenašiel.",
    NotReadableError: "Mikrofón používa iná aplikácia. Zavri ju a skús to znova.",
    TrackStartError: "Mikrofón používa iná aplikácia. Zavri ju a skús to znova.",
    OverconstrainedError: "Mikrofón nespĺňa požiadavky tohto prehliadača.",
    AbortError: "Nahrávanie bolo prerušené. Skús to znova.",
    NotSupportedError: "Tento prehliadač nepodporuje nahrávanie z mikrofónu.",
  };
  return map[e?.name] ?? `Mikrofón sa nepodarilo spustiť (${e?.name ?? "neznáma chyba"}).`;
}

export function cameraErrorMessage(err: unknown): string {
  const e = err as DOMException;
  const map: Record<string, string> = {
    NotAllowedError: "Kamera je zablokovaná. Povoľ prístup v adresnom riadku prehliadača.",
    PermissionDeniedError: "Kamera je zablokovaná. Povoľ prístup v adresnom riadku prehliadači.",
    NotFoundError: "Kamera sa nenašla.",
    NotReadableError: "Kameru používa iná aplikácia.",
    NotSupportedError: "Tento prehliadač nepodporuje kameru.",
  };
  return map[e?.name] ?? "Bez kamery sa nedá pokračovať. Povoľ prístup v prehliadači a skús znovu.";
}
