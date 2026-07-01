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

  // Blur Toggle state: Pre-vote (blurred to 15px) vs Unlocked (sharp)
  const [isPreviewBlurred, setIsPreviewBlurred] = useState(true);

  // Snippets local list — initialized from profile data
  const [snippets, setSnippets] = useState<string[]>(user.videoUrls ?? []);
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [recordingState, setRecordingState] = useState<"idle" | "countdown" | "recording" | "saving">("idle");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadIndex, setActiveUploadIndex] = useState<number | null>(null);

  // Directives local editing states
  const [nonNegotiable, setNonNegotiable] = useState(user.nonNegotiable || "");
  const [currentThesis, setCurrentThesis] = useState(user.currentThesis || "");

  // Local settings states
  const [distance, setDistance] = useState(user.radiusKm || 200);
  const [isGlobalMode, setIsGlobalMode] = useState(user.radiusKm === undefined || user.radiusKm >= 500);
  const [orientation, setOrientation] = useState(user.orientation || "hetero");

  function saveFilterChange(key: string, value: any) {
    onUpdateUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [key]: value,
      };
    });
  }
  // Push snippet changes to parent profile (non-circular, explicit)
  function syncVideoUrls(urls: string[]) {
    onUpdateUser((prev) => {
      if (!prev) return null;
      return { ...prev, videoUrls: urls };
    });
  }


  // Save directives changes back to profile
  function handleSaveDirectives(field: "nonNegotiable" | "currentThesis", val: string) {
    onUpdateUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: val,
      };
    });
  }

  // JIT Camera Record Flow
  async function startRecording(index: number) {
    haptic("tap");
    setRecordingIndex(index);
    setRecordingState("countdown");
    setCountdown(3);

    let stream: MediaStream;
    try {
      stream = await openCamera({
        video: {
          facingMode: "user",
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 0.5625 } // 9:16 portrait
        },
        audio: false
      });
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
        syncVideoUrls(next);
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

    const tempVideo = document.createElement("video");
    tempVideo.src = videoUrl;
    tempVideo.onloadedmetadata = () => {
      if (tempVideo.duration > 3.2) {
        alert("Video je dlhšie ako 3 sekundy. Bude automaticky orezané a zacyklené na prvých 3 sekundách.");
      }
      setSnippets((prev) => {
        const next = [...prev];
        next[index] = videoUrl;
        syncVideoUrls(next);
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
      syncVideoUrls(next);
      return next;
    });
  }

  // Algorithmic Age Bracket Calculations (Half-your-age-plus-seven reciprocity)
  const minBracketAge = Math.max(18, Math.floor((user.age / 2) + 7));
  const maxBracketAge = Math.floor((user.age - 7) * 2);
  const calculatedBracket = `[${minBracketAge} - ${maxBracketAge < minBracketAge ? minBracketAge : maxBracketAge}]`;

  // Slovak attachment styles mapper
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

      {/* Blur Preview Toggle */}
      <div className="mb-6 border border-foreground/10 bg-card p-4 rounded-none flex items-center justify-between">
        <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">NÁHĽAD PRE TRH</span>
        <button
          onClick={() => { haptic("tap"); setIsPreviewBlurred(!isPreviewBlurred); }}
          className={`flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[9px] tracking-widest uppercase transition-all rounded-none font-bold ${
            isPreviewBlurred 
              ? "border-amber-500 bg-amber-500/10 text-amber-500" 
              : "border-foreground bg-foreground text-background"
          }`}
        >
          {isPreviewBlurred ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          {isPreviewBlurred ? "[ STAV PRED HLASOVANÍM ]" : "[ ODOMKNUTÝ STAV ]"}
        </button>
      </div>

      {/* CCTV Live Snippets Grid (respects preview blur toggle) */}
      <div className="mb-6">
        <p className="mb-3 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">VIACERÉ LIVE SNIPPETY (3s CCTV SLUČKY)</p>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, idx) => {
            const url = snippets[idx];
            return (
              <div key={idx} className="relative aspect-[3/4] w-full border border-foreground/20 rounded-none bg-black overflow-hidden group">
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
                      className={`size-full object-cover rounded-none transition-all duration-300 ${
                        isPreviewBlurred ? "blur-[15px]" : "blur-none"
                      }`}
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

      {/* Market Parameters (Moved from settings to DNA section) */}
      <div className="mb-6 border border-foreground/10 bg-card p-5 rounded-none space-y-4">
        <p className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">PARAMETRE TRHU (TRHOVÉ FILTRE)</p>

        <div className="space-y-4 font-mono text-xs">
          {/* Global vs National Toggle */}
          <div className="flex justify-between items-center border-b border-foreground/5 pb-3">
            <span className="text-foreground/45 uppercase text-[9px]">ROZSAH VYHĽADÁVANIA</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  haptic("tap");
                  setIsGlobalMode(false);
                  saveFilterChange("radiusKm", distance);
                }}
                className={`px-2 py-1 border text-[9px] tracking-wider rounded-none font-bold ${
                  !isGlobalMode
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/15 text-foreground hover:bg-foreground/5"
                }`}
              >
                NÁRODNÝ
              </button>
              <button
                onClick={() => {
                  haptic("tap");
                  setIsGlobalMode(true);
                  saveFilterChange("radiusKm", 500); // 500+ triggers Global search
                }}
                className={`px-2 py-1 border text-[9px] tracking-wider rounded-none font-bold ${
                  isGlobalMode
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/15 text-foreground hover:bg-foreground/5"
                }`}
              >
                GLOBÁLNY
              </button>
            </div>
          </div>

          {/* Distance Filter */}
          <div className={isGlobalMode ? "opacity-30 pointer-events-none transition-opacity" : "transition-opacity"}>
            <div className="flex justify-between mb-1">
              <span className="text-foreground/45 uppercase text-[9px]">MAXIMÁLNA VZDIALENOSŤ</span>
              <span className="font-bold text-foreground">{distance} km</span>
            </div>
            <input
              type="range"
              min="5"
              max="250"
              step="5"
              value={distance}
              disabled={isGlobalMode}
              onChange={(e) => {
                const val = Number(e.target.value);
                setDistance(val);
                saveFilterChange("radiusKm", val);
              }}
              className="w-full accent-foreground h-1 bg-foreground/10 rounded-none cursor-pointer"
            />
          </div>

          {/* Target Demographic Orientation Dropdown */}
          <div>
            <label className="block text-[8px] text-muted-foreground uppercase mb-1">Cieľová demografia (Sexuálna orientácia)</label>
            <select
              value={orientation}
              onChange={(e) => {
                const val = e.target.value;
                setOrientation(val);
                saveFilterChange("orientation", val);
              }}
              className="w-full border border-foreground/20 bg-background p-2 font-mono text-xs text-foreground focus:border-foreground focus:outline-none rounded-none"
            >
              <option value="hetero">Heterosexuálna</option>
              <option value="homo">Homosexuálna</option>
              <option value="bi">Bisexuálna</option>
              <option value="other">Iná / Neurodivergentná</option>
            </select>
          </div>
        </div>
      </div>

      {/* Brutalist Directives Form Fields */}
      <div className="mb-6 border border-foreground/15 bg-card p-5 rounded-none space-y-4">
        <p className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">KOGNITÍVNE SMERNICE (DIRECTIVES)</p>
        
        {/* NON-NEGOTIABLE */}
        <div className="space-y-1">
          <div className="flex justify-between font-mono text-[8px] text-muted-foreground uppercase">
            <span>Non-Negotiable (Nezjednateľná podmienka)</span>
            <span>{nonNegotiable.length} / 60</span>
          </div>
          <input
            type="text"
            maxLength={60}
            value={nonNegotiable}
            onChange={(e) => {
              const val = e.target.value;
              setNonNegotiable(val);
              handleSaveDirectives("nonNegotiable", val);
            }}
            placeholder="Napr. Tolerancia hluku, stabilita hodnôt, vernosť..."
            className="w-full border border-foreground/20 bg-background p-3 font-mono text-xs text-foreground focus:border-foreground focus:outline-none rounded-none placeholder:text-foreground/30"
          />
        </div>

        {/* CURRENT THESIS */}
        <div className="space-y-1">
          <div className="flex justify-between font-mono text-[8px] text-muted-foreground uppercase">
            <span>Current Thesis (Súčasná téza o živote)</span>
            <span>{currentThesis.length} / 100</span>
          </div>
          <textarea
            maxLength={100}
            rows={2}
            value={currentThesis}
            onChange={(e) => {
              const val = e.target.value;
              setCurrentThesis(val);
              handleSaveDirectives("currentThesis", val);
            }}
            placeholder="Napr. Hľadám kľúč k zjednoteniu v asymetrii ticha a racionálneho dialogu..."
            className="w-full border border-foreground/20 bg-background p-3 font-mono text-xs text-foreground focus:border-foreground focus:outline-none rounded-none resize-none placeholder:text-foreground/30"
          />
        </div>
      </div>

      {/* Pure Data Algorithmic Diagnostics */}
      <div className="mb-6">
        <p className="mb-3 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">ALGORITMICKÁ DIAGNOSTIKA // METRIKY</p>
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
          
          {/* HARDCODED ALGORITHMIC BRACKET */}
          <div className="flex justify-between border-b border-foreground/5 pb-2 border-dashed">
            <span className="text-amber-500 font-bold uppercase">Algoritmické_Rozmedzie_Trhu</span>
            <span className="font-black text-amber-500 font-mono">{calculatedBracket}</span>
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
              [ ROZHRANIE CCTV KAMERY ]
            </div>
            
            <div className="relative aspect-[3/4] w-full border border-foreground/20 rounded-none bg-black overflow-hidden mb-6">
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
                  <span className="font-mono text-[7px] text-white tracking-widest uppercase">ZÁZNAM (3s)</span>
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
