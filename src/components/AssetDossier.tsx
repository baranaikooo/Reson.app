import React, { useState, useRef, useEffect } from "react";
import { X, Camera, Upload, Eye, EyeOff } from "lucide-react";
import { UserProfile } from "@/lib/resonance";
import { useHaptic } from "@/hooks/use-haptics";
import { openCamera, recordStreamForMs, stopStream, attachStreamToVideo } from "@/lib/media";

interface AssetDossierProps {
  user: UserProfile;
  onUpdateUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  onBack: () => void;
}

export function AssetDossier({ user, onUpdateUser, onBack }: AssetDossierProps) {
  const haptic = useHaptic();
  
  // Snippets local list
  const [snippets, setSnippets] = useState<string[]>([]);
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [recordingState, setRecordingState] = useState<"idle" | "countdown" | "recording" | "saving">("idle");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadIndex, setActiveUploadIndex] = useState<number | null>(null);

  // Initialize list
  useEffect(() => {
    setSnippets([
      "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-cyberpunk-look-39891-large.mp4",
      "https://assets.mixkit.co/videos/preview/mixkit-woman-close-up-under-neon-light-40409-large.mp4",
    ]);
  }, []);

  // JIT Camera Record Flow
  async function startRecording(index: number) {
    haptic("tap");
    setRecordingIndex(index);
    setRecordingState("countdown");
    setCountdown(3);

    let stream: MediaStream;
    try {
      stream = await openCamera();
      setCameraStream(stream);
    } catch (err) {
      console.error("[dossier] openCamera failed:", err);
      alert("Nepodarilo sa spustiť kameru. Skontrolujte povolenia.");
      cancelRecording();
      return;
    }

    setTimeout(() => {
      if (videoRef.current) {
        attachStreamToVideo(videoRef.current, stream);
      }
    }, 100);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
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
        return next;
      });

      haptic("success");
    } catch (err) {
      console.error("[dossier] recordStreamForMs failed:", err);
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

    // Validate duration
    const tempVideo = document.createElement("video");
    tempVideo.src = videoUrl;
    tempVideo.onloadedmetadata = () => {
      if (tempVideo.duration > 3.2) {
        alert("Video je dlhšie ako 3 sekundy. Bude automaticky orezané a zacyklené na prvých 3 sekundách.");
      }
      setSnippets((prev) => {
        const next = [...prev];
        next[index] = videoUrl;
        return next;
      });
      haptic("success");
      setActiveUploadIndex(null);
    };
  }

  function deleteSnippet(index: number) {
    haptic("warning");
    setSnippets((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  }

  // Pure mathematical metrics for ALGORITHMIC DIAGNOSTICS
  const styleMap: Record<string, string> = {
    Secure: "BEZPEČNÝ",
    Anxious: "ÚZKOSTNÝ",
    Avoidant: "VYHÝBAVÝ",
    Fearful: "DEZORGANIZOVANÝ"
  };
  const attachmentStyleSlovak = styleMap[user.attachmentStyle || "Secure"] || "BEZPEČNÝ";
  const primaryMarker = `[${attachmentStyleSlovak}]`;
  const decisionLatency = `${(user.avgResponseTime || 2.45).toFixed(2)}s`;
  const redemptionQuota = `${user.redemptionQuota ?? 0}`;
  const closureRate = "85%";
  const cognitiveDepth = `${(user.cognitiveDepth || 0.55).toFixed(2)}`;
  const conscientiousness = `${(user.conscientiousness || 0.50).toFixed(2)}`;
  const extraversion = `${(user.extraversion || 0.50).toFixed(2)}`;
  const hesitationFlag = user.hesitated ? "[ÁNO]" : "[NIE]";

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between border-b border-foreground/15 pb-4">
        <h1 className="font-sans text-2xl tracking-tight text-foreground font-black uppercase">ASSET DOSSIER // KOGNITÍVNA DNA</h1>
        <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">{user.name}</span>
      </div>

      {/* CCTV Live Snippets Grid */}
      <div className="mb-6">
        <p className="mb-3 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">MULTIPLE LIVE SNIPPETS (3s CCTV LOOPS)</p>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, idx) => {
            const url = snippets[idx];
            return (
              <div key={idx} className="relative aspect-video w-full border border-foreground/20 rounded-none bg-black overflow-hidden group">
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
                      className="size-full object-cover rounded-none"
                    />
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/70 px-1.5 py-0.5 rounded-none border border-white/5">
                      <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="font-mono text-[7px] text-white tracking-widest uppercase">LIVE</span>
                    </div>
                    <div className="absolute bottom-1.5 left-1.5 bg-black/70 px-1.5 py-0.5 rounded-none">
                      <span className="font-mono text-[7px] text-white tracking-widest uppercase">00:03:00</span>
                    </div>
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
                    <span className="mt-1.5 font-mono text-[7px] text-foreground/35 uppercase">SLOT {idx + 1} (MAX 3s)</span>
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
      </div>

      {/* Directives Section */}
      <div className="mb-6 border border-foreground/15 bg-card p-5 rounded-none space-y-4">
        <p className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">PSYCHOLOGICKÉ SMERNICE</p>
        
        <div className="font-mono text-xs text-foreground/80 space-y-2.5">
          <div className="border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase text-[9px] block mb-0.5">Nezjednateľná priorita (Non-Negotiable)</span>
            <span className="font-bold text-foreground">STABILITA A BLÍZKOSŤ</span>
          </div>
          <div>
            <span className="text-foreground/45 uppercase text-[9px] block mb-1">Aktuálna kognitívna téza</span>
            <p className="italic text-[10px] text-foreground/75 leading-relaxed bg-foreground/[0.01] p-2 border border-foreground/5 font-sans">
              "Kolektívny architekt hľadajúci kľúč k zjednoteniu v asymetrii ticha."
            </p>
          </div>
        </div>
      </div>

      {/* Pure Data Algorithmic Diagnostics */}
      <div className="mb-6">
        <p className="mb-3 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">ALGORITMICKÁ DIAGNOSTIKA</p>
        <div className="border border-foreground/15 bg-card p-5 font-mono text-xs text-foreground/90 space-y-2.5 rounded-none select-none">
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Primárny_Marker</span>
            <span className="font-bold text-foreground">{primaryMarker}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Reakčný_čas</span>
            <span className="font-bold text-foreground">{decisionLatency}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Počet_penalizácií</span>
            <span className="font-bold text-foreground">{redemptionQuota}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Úspešnosť_ukončenia</span>
            <span className="font-bold text-foreground">{closureRate}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Kognitívna_hĺbka</span>
            <span className="font-bold text-foreground">{cognitiveDepth}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Svedomitosť</span>
            <span className="font-bold text-foreground">{conscientiousness}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Extraverzia</span>
            <span className="font-bold text-foreground">{extraversion}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Príznak_váhania</span>
            <span className="font-bold text-foreground">{hesitationFlag}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/45 uppercase">Stav_aktívneho_spisu</span>
            <span className="font-bold text-green-600 uppercase">KALIBROVANÉ</span>
          </div>
        </div>
      </div>

      {/* Recording Overlay Modal */}
      {recordingIndex !== null && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-[150] flex flex-col justify-center items-center p-4">
          <div className="w-full max-w-sm border border-foreground/20 bg-card p-6 rounded-none relative">
            <div className="mb-4 font-mono text-[9px] tracking-widest text-red-500 font-bold uppercase animate-pulse">
              [ CCTV CAMERA RECORDER INTERFACE ]
            </div>
            
            <div className="relative aspect-video w-full border border-foreground/20 rounded-none bg-black overflow-hidden mb-6">
              <video ref={videoRef} playsInline muted className="size-full object-cover scale-110" style={{ transform: "scaleX(-1)" }} />
              
              {recordingState === "countdown" && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                  <span className="font-mono text-4xl text-white font-bold animate-ping">{countdown}</span>
                  <span className="font-mono text-[9px] text-white/50 tracking-widest uppercase mt-2">Príprava...</span>
                </div>
              )}

              {recordingState === "recording" && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 px-2 py-0.5 border border-red-500">
                  <span className="size-1.5 rounded-full bg-red-500 animate-ping" />
                  <span className="font-mono text-[7px] text-white tracking-widest uppercase">REC (3s)</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={cancelRecording}
                className="flex-1 border border-foreground/20 py-3 text-xs tracking-widest text-foreground/60 font-mono font-bold uppercase hover:bg-foreground/5 transition-all rounded-none bg-card"
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
