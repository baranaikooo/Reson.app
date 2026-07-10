import React, { useState, useRef, useEffect } from "react";
import { X, Camera, Upload } from "lucide-react";
import { useHaptic } from "@/hooks/use-haptics";
import { openCamera, recordStreamForMs, stopStream, attachStreamToVideo } from "@/lib/media";
import { saveVideoBlob, getVideoBlob, clearVideoBlobs } from "@/lib/indexeddb";

async function syncSnippetsToDB(urls: string[]) {
  try {
    await clearVideoBlobs();
    const active = urls.filter(Boolean);
    for (let i = 0; i < active.length; i++) {
      const res = await fetch(active[i]);
      const blob = await res.blob();
      await saveVideoBlob(`snippet_${i + 1}`, blob);
    }
  } catch (err) {
    console.error("[syncSnippetsToDB] Failed to sync blobs:", err);
  }
}

interface SnippetsOnboardingProps {
  onDone: (urls: string[]) => void;
}

export function SnippetsOnboarding({ onDone }: SnippetsOnboardingProps) {
  const haptic = useHaptic();

  // Initialize snippets list as empty slots
  const [snippets, setSnippets] = useState<string[]>([]);

  useEffect(() => {
    async function loadFromDB() {
      const loaded: string[] = [];
      for (let idx = 0; idx < 4; idx++) {
        const blob = await getVideoBlob(`snippet_${idx + 1}`);
        if (blob) {
          loaded[idx] = URL.createObjectURL(blob);
        }
      }
      const filtered = loaded.filter(Boolean);
      if (filtered.length > 0) {
        setSnippets(filtered);
      }
    }
    loadFromDB().catch((err) => console.error("Failed to load from IDB on mount:", err));
  }, []);
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [recordingState, setRecordingState] = useState<
    "idle" | "countdown" | "recording" | "saving"
  >("idle");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeUploadIndex, setActiveUploadIndex] = useState<number | null>(null);

  useEffect(() => {
    const currentStream = cameraStream;
    return () => {
      if (currentStream) stopStream(currentStream);
    };
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Handle app going to background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (cameraStream) {
          stopStream(cameraStream);
          setCameraStream(null);
        }
        setRecordingIndex(null);
        setRecordingState("idle");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [cameraStream]);

  // JIT Camera Record Flow
  async function startRecording(index: number) {
    haptic("tap");
    setRecordingIndex(index);
    setRecordingState("countdown");
    setCountdown(3);

    let stream: MediaStream;
    try {
      stream = await openCamera({
        video: { facingMode: "user" },
        audio: false,
      });
      setCameraStream(stream);
    } catch (err) {
      console.error("[onboarding-snippets] openCamera failed:", err);
      alert("Nepodarilo sa spustiť kameru. Skontrolujte povolenia.");
      cancelRecording();
      return;
    }

    setTimeout(() => {
      if (videoRef.current) {
        attachStreamToVideo(videoRef.current, stream);
      }
    }, 100);

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          triggerRecord(stream, index);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function triggerRecord(stream: MediaStream, index: number) {
    haptic("warning");
    setRecordingState("recording");

    try {
      const { blob } = await recordStreamForMs(stream, 3000, "video");
      setRecordingState("saving");

      const videoUrl = URL.createObjectURL(blob);
      setSnippets((prev) => {
        const next = [...prev];
        next[index] = videoUrl;
        const filtered = next.filter(Boolean);
        syncSnippetsToDB(filtered).catch(console.error);
        return filtered;
      });

      haptic("success");
    } catch (err) {
      console.error("[onboarding-snippets] recordStreamForMs failed:", err);
      alert("Nahrávanie zlyhalo.");
    } finally {
      stopStream(stream);
      setCameraStream(null);
      setRecordingIndex(null);
      setRecordingState("idle");
    }
  }

  function cancelRecording() {
    if (cameraStream) {
      stopStream(cameraStream);
      setCameraStream(null);
    }
    setRecordingIndex(null);
    setRecordingState("idle");
  }

  // Gallery File Upload Trim logic
  function triggerFileUpload(index: number) {
    haptic("tap");
    setActiveUploadIndex(index);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const index = activeUploadIndex;
    if (index === null) return;

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      alert("Vyberte validný video súbor.");
      return;
    }

    const videoUrl = URL.createObjectURL(file);

    const tempVideo = document.createElement("video");
    tempVideo.src = videoUrl;
    tempVideo.onloadedmetadata = () => {
      if (tempVideo.duration > 3.2) {
        alert(
          "Video je dlhšie ako 3 sekundy. Bude automaticky orezané a zacyklené na prvých 3 sekundách.",
        );
      }
      setSnippets((prev) => {
        const next = [...prev];
        next[index] = videoUrl;
        const filtered = next.filter(Boolean);
        syncSnippetsToDB(filtered).catch(console.error);
        return filtered;
      });
      haptic("success");
      setActiveUploadIndex(null);
    };
  }

  function deleteSnippet(index: number) {
    haptic("warning");
    setSnippets((prev) => {
      const next = [...prev];
      if (index === 0) {
        next[0] = "";
      } else {
        next[index] = "";
      }
      const filtered = next.filter(Boolean);
      syncSnippetsToDB(filtered).catch(console.error);
      return filtered;
    });
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-background min-h-screen flex flex-col justify-between animate-fade-in font-mono">
      {/* Title */}
      <div className="space-y-4 mb-6">
        <div className="text-[10px] tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-foreground/30 animate-pulse" />
          <span>FÁZA 0.5: MULTIPLE LIVE SNIPPETS</span>
        </div>
        <h2 className="font-sans text-2xl font-black tracking-tight text-foreground uppercase leading-none">
          Pridajte video slučku
        </h2>
        <p className="text-sm md:text-base text-foreground/75 leading-relaxed font-sans font-medium">
          Základné informácie boli kalibrované. Pre overenie identity a algoritmický náhľad na trh vyžadujeme nahrať aspoň 1 krátke 3-sekundové video. Ak chcete, môžete pridať celkovo až 4 video slučky.
        </p>
      </div>

      {/* CCTV Live Snippets Grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {Array.from({ length: 4 }).map((_, idx) => {
          const url = snippets[idx];
          return (
            <div
              key={idx}
              className="relative aspect-[3/4] w-full border border-foreground/20 rounded-none bg-black overflow-hidden group"
            >
              {url ? (
                <>
                  <video
                    src={url}
                    autoPlay
                    loop
                    muted
                    playsInline
                    onTimeUpdate={(e) => {
                      if (e.currentTarget.currentTime >= 3.0) {
                        e.currentTarget.currentTime = 0;
                      }
                    }}
                    className="size-full object-contain bg-black rounded-none transition-all duration-300"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/70 px-1.5 py-0.5 rounded-none border border-white/5">
                    <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-mono text-[7px] text-white tracking-widest uppercase">
                      LIVE
                    </span>
                  </div>
                  <div className="absolute bottom-1.5 left-1.5 bg-black/70 px-1.5 py-0.5 rounded-none">
                    <span className="font-mono text-[7px] text-white tracking-widest uppercase">
                      00:03:00
                    </span>
                  </div>
                  {/* Delete button only if url exists */}
                  <button
                    onClick={() => deleteSnippet(idx)}
                    className="absolute top-1.5 right-1.5 bg-red-600/90 text-white p-1 rounded-none border border-red-500 hover:bg-red-700 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                </>
              ) : (
                <div className="size-full flex flex-col justify-center items-center p-2 bg-foreground/[0.01]">
                  <div className="flex gap-2">
                    <button
                      onClick={() => startRecording(idx)}
                      className="p-2 border border-foreground/10 hover:border-foreground/30 hover:bg-foreground/5 transition-all text-foreground rounded-none bg-card"
                      title="Nahrať kamerou"
                    >
                      <Camera className="size-4" />
                    </button>
                    <button
                      onClick={() => triggerFileUpload(idx)}
                      className="p-2 border border-foreground/10 hover:border-foreground/30 hover:bg-foreground/5 transition-all text-foreground rounded-none bg-card"
                      title="Nahrať z galérie"
                    >
                      <Upload className="size-4" />
                    </button>
                  </div>
                  <span className="mt-1.5 font-mono text-[7px] text-foreground/35 uppercase">
                    SLOT {idx + 1} (MAX 3s)
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Action Footer */}
      <div className="space-y-3">
        <button
          onClick={() => {
            const activeSnippets = snippets.filter(Boolean);
            if (activeSnippets.length === 0) {
              haptic("error");
              alert("Chyba: Musíte nahrať aspoň 1 nový live snippet na overenie a pokračovanie.");
              return;
            }
            haptic("success");
            onDone(activeSnippets);
          }}
          className="w-full border-2 border-foreground py-4.5 text-lg font-bold tracking-wider text-background bg-foreground hover:bg-foreground/90 transition-all rounded-none uppercase"
        >
          [ POKRAČOVAŤ K SEMANTICKÉMU ZRKADLU ]
        </button>
        <p className="text-[9px] text-muted-foreground text-center uppercase">
          Všetky nahraté videá sa predvádzajú bez zvuku (muted).
        </p>
      </div>

      {/* Recording Overlay Modal */}
      {recordingIndex !== null && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-[150] flex flex-col justify-center items-center p-4">
          <div className="w-full max-w-sm border border-foreground/20 bg-card p-6 rounded-none relative">
            <div className="mb-4 text-[9px] tracking-widest text-red-500 font-bold uppercase animate-pulse">
              [ CCTV CAMERA RECORDER INTERFACE ]
            </div>

            <div className="relative aspect-[3/4] w-full border border-foreground/20 rounded-none bg-black overflow-hidden mb-6">
              <video
                ref={videoRef}
                playsInline
                muted
                className="size-full object-contain bg-black"
                style={{ transform: "scaleX(-1)" }}
              />

              {recordingState === "countdown" && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                  <span className="text-4xl text-white font-bold animate-ping">{countdown}</span>
                  <span className="text-[9px] text-white/50 tracking-widest uppercase mt-2">
                    Príprava...
                  </span>
                </div>
              )}

              {recordingState === "recording" && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 px-2 py-0.5 border border-red-500">
                  <span className="size-1.5 rounded-full bg-red-500 animate-ping" />
                  <span className="text-[7px] text-white tracking-widest uppercase">REC (3s)</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={cancelRecording}
                className="flex-1 border border-foreground/20 py-3.5 text-sm font-bold tracking-wider text-foreground/60 uppercase hover:bg-foreground/5 transition-all rounded-none bg-card"
              >
                [ ZRUŠIŤ ]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
