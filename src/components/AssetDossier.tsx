import React, { useState, useRef, useEffect } from "react";
import { X, Camera, Upload, Eye, EyeOff, Loader2 } from "lucide-react";
import { UserProfile } from "@/lib/resonance";
import { useHaptic } from "@/hooks/use-haptics";
import { openCamera, recordStreamForMs, stopStream, attachStreamToVideo } from "@/lib/media";
import { supabase } from "@/lib/supabase";

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
  const [recordingState, setRecordingState] = useState<
    "idle" | "countdown" | "recording" | "saving"
  >("idle");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadIndex, setActiveUploadIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Directives local editing states
  const [nonNegotiable, setNonNegotiable] = useState(user.nonNegotiable || "");
  const [currentThesis, setCurrentThesis] = useState(user.currentThesis || "");

  // Local settings states
  const [distance, setDistance] = useState(user.radiusKm || 200);
  const [isGlobalMode, setIsGlobalMode] = useState(
    user.radiusKm === undefined || user.radiusKm >= 500,
  );
  const [orientation, setOrientation] = useState(user.orientation || "hetero");

  async function saveFilterChange(key: string, value: any) {
    onUpdateUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [key]: value,
      };
    });

    const userId = user.id;
    const dbKey = key === "radiusKm" ? "radius_km" : key;
    if (userId && userId !== "00000000-0000-0000-0000-000000000001") {
      const { error } = await supabase
        .from("profiles")
        .update({ [dbKey]: value })
        .eq("id", userId);
      if (error) {
        console.error(`[AssetDossier] Failed to update ${key} in DB:`, error);
      }
    }
  }
  // Push snippet changes to parent profile (non-circular, explicit)
  function syncVideoUrls(urls: string[]) {
    onUpdateUser((prev) => {
      if (!prev) return null;
      return { ...prev, videoUrls: urls };
    });
  }

  // Save directives changes back to profile
  async function handleSaveDirectives(field: "nonNegotiable" | "currentThesis", val: string) {
    onUpdateUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: val,
      };
    });

    const userId = user.id;
    const dbKey = field === "nonNegotiable" ? "non_negotiable" : "current_thesis";
    if (userId && userId !== "00000000-0000-0000-0000-000000000001") {
      const { error } = await supabase
        .from("profiles")
        .update({ [dbKey]: val })
        .eq("id", userId);
      if (error) {
        console.error(`[AssetDossier] Failed to update ${field} in DB:`, error);
      }
    }
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
        video: { facingMode: "user" },
        audio: false,
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

  async function uploadFileAndSave(index: number, blob: Blob | File) {
    const userId = user.id || "00000000-0000-0000-0000-000000000001";
    if (userId === "00000000-0000-0000-0000-000000000001") {
      // Demo Mode
      const videoUrl = URL.createObjectURL(blob);
      setSnippets((prev) => {
        const next = [...prev];
        next[index] = videoUrl;
        syncVideoUrls(next);
        return next;
      });
      return;
    }

    // Upload to Storage
    const filename = `${userId}/slot_${index + 1}_${Date.now()}.mp4`;
    const { data, error } = await supabase.storage.from("media-snippets").upload(filename, blob, {
      contentType: blob.type || "video/mp4",
      cacheControl: "3600",
      upsert: true,
    });

    if (error) {
      console.error("[dossier] upload error:", error);
      alert(`Ukladanie zlyhalo: ${error.message}`);
      throw error;
    }

    // Retrieve public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("media-snippets").getPublicUrl(filename);

    // Save to Database Table
    const { error: dbError } = await supabase.from("media_snippets").upsert(
      {
        user_id: userId,
        slot_index: index + 1,
        video_url: publicUrl,
      },
      { onConflict: "user_id, slot_index" }
    );

    if (dbError) {
      console.error("[dossier] database save error:", dbError);
      alert(`Nepodarilo sa uložiť informácie o videu do databázy.`);
      throw dbError;
    }

    setSnippets((prev) => {
      const next = [...prev];
      next[index] = publicUrl;
      syncVideoUrls(next);
      return next;
    });
  }

  async function triggerRecord(stream: MediaStream, index: number) {
    haptic("warning");
    setRecordingState("recording");

    try {
      const { blob } = await recordStreamForMs(stream, 3000, "video");
      setRecordingState("saving");

      // Enforce max upload limit of 5 MB
      const maxLimit = 5 * 1024 * 1024;
      if (blob.size > maxLimit) {
        alert(`Súbor je príliš veľký (${(blob.size / 1024 / 1024).toFixed(2)} MB). Limit je 5 MB.`);
        throw new Error("File size exceeds 5MB limit");
      }

      await uploadFileAndSave(index, blob);
      haptic("success");
    } catch (err) {
      console.error("[dossier] recordStreamForMs failed:", err);
      alert("Nahrávanie alebo nahratie na úložisko zlyhalo.");
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

  async function compressVideo(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;
      video.style.position = "absolute";
      video.style.left = "-9999px";
      video.style.top = "-9999px";
      document.body.appendChild(video);

      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 640; // 3:4 portrait aspect ratio
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        document.body.removeChild(video);
        reject(new Error("Could not get canvas context"));
        return;
      }

      video.onloadedmetadata = () => {
        video.play().then(() => {
          const fps = 30;
          const stream = canvas.captureStream(fps);
          
          let options: MediaRecorderOptions = { mimeType: "video/webm;codecs=vp8" };
          if (typeof MediaRecorder.isTypeSupported === "function") {
            if (options.mimeType && !MediaRecorder.isTypeSupported(options.mimeType)) {
              options = { mimeType: "video/mp4" };
            }
            if (options.mimeType && !MediaRecorder.isTypeSupported(options.mimeType)) {
              options = { mimeType: "" };
            }
          } else {
            options = { mimeType: "" };
          }

          const mediaRecorder = new MediaRecorder(stream, options);
          const chunks: Blob[] = [];

          mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              chunks.push(event.data);
            }
          };

          mediaRecorder.onstop = () => {
            const finalBlob = new Blob(chunks, { type: mediaRecorder.mimeType || "video/mp4" });
            document.body.removeChild(video);
            resolve(finalBlob);
          };

          let animationFrameId: number;
          function drawFrame() {
            if (!ctx) return;
            if (video.paused || video.ended) {
              cancelAnimationFrame(animationFrameId);
              if (mediaRecorder.state === "recording") {
                mediaRecorder.stop();
              }
              return;
            }

            const vWidth = video.videoWidth;
            const vHeight = video.videoHeight;
            const targetWidth = canvas.width;
            const targetHeight = canvas.height;
            const vRatio = vWidth / vHeight;
            const targetRatio = targetWidth / targetHeight;

            let sx = 0, sy = 0, sWidth = vWidth, sHeight = vHeight;

            if (vRatio > targetRatio) {
              sWidth = vHeight * targetRatio;
              sx = (vWidth - sWidth) / 2;
            } else {
              sHeight = vWidth / targetRatio;
              sy = (vHeight - sHeight) / 2;
            }

            ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
            animationFrameId = requestAnimationFrame(drawFrame);
          }

          mediaRecorder.start();
          drawFrame();

          const maxDuration = Math.min(3000, video.duration * 1000);
          setTimeout(() => {
            if (mediaRecorder.state === "recording") {
              video.pause();
            }
          }, maxDuration);
        }).catch(err => {
          document.body.removeChild(video);
          reject(err);
        });
      };

      video.onerror = (err) => {
        document.body.removeChild(video);
        reject(err);
      };
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const index = activeUploadIndex;
    if (index === null) return;

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      alert("Vyberte validný video súbor.");
      setActiveUploadIndex(null);
      return;
    }

    // Enforce max upload limit of 30 MB (fallback raw limit)
    const maxLimit = 30 * 1024 * 1024;
    if (file.size > maxLimit) {
      alert(`Súbor je príliš veľký (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximálny limit je 30 MB.`);
      setActiveUploadIndex(null);
      return;
    }

    setIsUploading(true);

    try {
      let uploadBlob: Blob | File = file;

      // Auto compress to 480p portrait 3s loops using canvas recording if supported
      if (typeof HTMLCanvasElement.prototype.captureStream === "function" && typeof window.MediaRecorder === "function") {
        try {
          uploadBlob = await compressVideo(file);
        } catch (compressErr) {
          console.warn("[dossier] Client-side video compression failed, using original file:", compressErr);
        }
      }

      haptic("warning");
      await uploadFileAndSave(index, uploadBlob);
      haptic("success");
    } catch (err: any) {
      console.error("[dossier] handleFileChange upload failed:", err);
      alert(`Nahrávanie zlyhalo: ${err.message || err}`);
    } finally {
      setIsUploading(false);
      setActiveUploadIndex(null);
    }
  }

  async function deleteSnippet(index: number) {
    if (!confirm("Naozaj chcete odstrániť toto video?")) return;
    haptic("warning");

    const userId = user.id || "00000000-0000-0000-0000-000000000001";
    if (userId !== "00000000-0000-0000-0000-000000000001") {
      const { error } = await supabase
        .from("media_snippets")
        .delete()
        .eq("user_id", userId)
        .eq("slot_index", index + 1);

      if (error) {
        console.error("[dossier] failed to delete snippet from database:", error);
        alert("Chyba: Nepodarilo sa odstrániť video z databázy.");
        return;
      }
    }

    setSnippets((prev) => {
      const next = [...prev];
      next[index] = ""; // Keep slot empty instead of splicing/shifting to avoid slot-index misalignment in database!
      syncVideoUrls(next);
      return next;
    });
  }

  // Algorithmic Age Bracket Calculations (Half-your-age-plus-seven reciprocity)
  const minBracketAge = Math.max(18, Math.floor(user.age / 2 + 7));
  const maxBracketAge = Math.floor((user.age - 7) * 2);
  const calculatedBracket = `[${minBracketAge} - ${maxBracketAge < minBracketAge ? minBracketAge : maxBracketAge}]`;

  // Slovak attachment styles mapper
  const styleMap: Record<string, string> = {
    Secure: "BEZPEČNÝ",
    Anxious: "ÚZKOSTNÝ",
    Avoidant: "VYHÝBAVÝ",
    Fearful: "DEZORGANIZOVANÝ",
  };
  const attachmentStyleSlovak = styleMap[user.attachmentStyle || "Secure"] || "BEZPEČNÝ";

  const primaryMarker = `[${attachmentStyleSlovak}]`;
  const decisionLatency = `${(user.avgResponseTime || 2.45).toFixed(2)}s`;
  const redemptionQuota = `${user.redemptionQuota ?? 0}`;
  const closureRate = "85%";
  const cognitiveDepth = `${(user.cognitiveDepth || 0.55).toFixed(2)}`;
  const conscientiousness = `${(user.conscientiousness || 0.5).toFixed(2)}`;
  const extraversion = `${(user.extraversion || 0.5).toFixed(2)}`;
  const hesitationFlag = user.hesitated ? "[ÁNO]" : "[NIE]";

  return (
    <>
      <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between border-b border-foreground/15 pb-4">
        <h1 className="font-sans text-2xl tracking-tight text-foreground font-black uppercase">
          MÔJ PROFIL // OSOBNOSŤ
        </h1>
        <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          {user.name}
        </span>
      </div>

      {/* Blur Preview Toggle */}
      <div className="mb-6 border border-foreground/10 bg-card p-4 rounded-none flex items-center justify-between">
        <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
          Ukážka pre ostatných
        </span>
        <button
          onClick={() => {
            haptic("tap");
            setIsPreviewBlurred(!isPreviewBlurred);
          }}
          className={`flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[9px] tracking-widest uppercase transition-all rounded-none font-bold ${
            isPreviewBlurred
              ? "border-amber-500 bg-amber-500/10 text-amber-500"
              : "border-foreground bg-foreground text-background"
          }`}
        >
          {isPreviewBlurred ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          {isPreviewBlurred ? "[ ROZMAZANÝ PROFIL ]" : "[ ODOMKNUTÝ PROFIL ]"}
        </button>
      </div>

      {/* CCTV Live Snippets Grid (respects preview blur toggle) */}
      <div className="mb-6">
        <p className="mb-3 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
          Moje videá (3-sekundové slučky)
        </p>
        <div className="grid grid-cols-2 gap-3">
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
                      className={`size-full object-contain bg-black rounded-none transition-all duration-300 ${
                        isPreviewBlurred ? "blur-[15px]" : "blur-none"
                      }`}
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
                    <button
                      onClick={() => deleteSnippet(idx)}
                      className="absolute top-1.5 right-1.5 bg-red-600/90 text-white p-1.5 rounded-none border border-red-500 hover:bg-red-700 transition-all opacity-90 active:scale-95 z-10"
                    >
                      <X className="size-3.5" />
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
      </div>

      {/* Market Parameters (Moved from settings to DNA section) */}
      <div className="mb-6 border border-foreground/10 bg-card p-5 rounded-none space-y-4">
        <p className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
          PARAMETRE TRHU (TRHOVÉ FILTRE)
        </p>

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
          <div
            className={
              isGlobalMode
                ? "opacity-30 pointer-events-none transition-opacity"
                : "transition-opacity"
            }
          >
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
            <label className="block text-[8px] text-muted-foreground uppercase mb-1">
              Koho hľadáš (Sexuálna orientácia)
            </label>
            <select
              value={orientation}
              onChange={(e) => {
                const val = e.target.value as "hetero" | "homo" | "bi";
                setOrientation(val);
                saveFilterChange("orientation", val);
              }}
              className="w-full border border-foreground/20 bg-background p-2 font-mono text-xs text-foreground focus:border-foreground focus:outline-none rounded-none"
            >
              <option value="hetero">Heterosexuálna</option>
              <option value="homo">Homosexuálna</option>
              <option value="bi">Bisexuálna</option>
            </select>
          </div>
        </div>
      </div>

      {/* Brutalist Directives Form Fields */}
      <div className="mb-6 border border-foreground/15 bg-card p-5 rounded-none space-y-4">
        <p className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
          Moje životné smernice
        </p>

        {/* NON-NEGOTIABLE */}
        <div className="space-y-1">
          <div className="flex justify-between font-mono text-[8px] text-muted-foreground uppercase">
            <span>Cez čo u mňa nejde vlak (Zásadná podmienka)</span>
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
            placeholder="Napr. Vernosť, úprimnosť, tolerancia..."
            className="w-full border border-foreground/20 bg-background p-3 font-mono text-xs text-foreground focus:border-foreground focus:outline-none rounded-none placeholder:text-foreground/30"
          />
        </div>

        {/* CURRENT THESIS */}
        <div className="space-y-1">
          <div className="flex justify-between font-mono text-[8px] text-muted-foreground uppercase">
            <span>Môj pohľad na svet (Stručne o mne)</span>
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
            placeholder="Napr. Snažím sa žiť naplno a hľadám niekoho, kto má podobné hodnoty..."
            className="w-full border border-foreground/20 bg-background p-3 font-mono text-xs text-foreground focus:border-foreground focus:outline-none rounded-none resize-none placeholder:text-foreground/30"
          />
        </div>
      </div>

      {/* Pure Data Algorithmic Diagnostics */}
      <div className="mb-6">
        <p className="mb-3 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          OSOBNOSTNÝ PROFIL // METRIKY
        </p>
        <div className="border border-foreground/15 bg-card p-5 font-mono text-xs text-foreground/90 space-y-2.5 rounded-none select-none">
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Typ_osobnosti</span>
            <span className="font-bold text-foreground">{primaryMarker}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Rýchlosť_odpovedí</span>
            <span className="font-bold text-foreground">{decisionLatency}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Zostávajúce_pokusy</span>
            <span className="font-bold text-foreground">{redemptionQuota}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Dokončené_scenáre</span>
            <span className="font-bold text-foreground">{closureRate}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Hĺbka_osobnosti</span>
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
            <span className="text-foreground/45 uppercase">Váhavosť_pri_teste</span>
            <span className="font-bold text-foreground">{hesitationFlag}</span>
          </div>

          {/* HARDCODED ALGORITHMIC BRACKET */}
          <div className="flex justify-between border-b border-foreground/5 pb-2 border-dashed">
            <span className="text-amber-500 font-bold uppercase">Hľadaný_vek_partnera</span>
            <span className="font-black text-amber-500 font-mono">{calculatedBracket}</span>
          </div>



          <div className="flex justify-between">
            <span className="text-foreground/45 uppercase">Stav_účtu</span>
            <span className="font-bold text-green-600 uppercase">KALIBROVANÉ</span>
          </div>
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
              <video
                ref={videoRef}
                playsInline
                muted
                className="size-full object-contain bg-black"
                style={{ transform: "scaleX(-1)" }}
              />

              {recordingState === "countdown" && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                  <span className="font-mono text-4xl text-white font-bold animate-ping">
                    {countdown}
                  </span>
                  <span className="font-mono text-[9px] text-white/50 tracking-widest uppercase mt-2">
                    Príprava...
                  </span>
                </div>
              )}

              {recordingState === "recording" && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 px-2 py-0.5 border border-red-500">
                  <span className="size-1.5 rounded-full bg-red-500 animate-ping" />
                  <span className="font-mono text-[7px] text-white tracking-widest uppercase">
                    ZÁZNAM (3s)
                  </span>
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

      {isUploading && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-[200] flex flex-col justify-center items-center p-4">
          <div className="w-full max-w-xs border border-foreground/20 bg-card p-6 rounded-none text-center space-y-4">
            <Loader2 className="size-8 animate-spin text-foreground mx-auto animate-pulse" />
            <h3 className="font-sans text-sm font-bold uppercase text-foreground">
              Spracovanie videa...
            </h3>
            <p className="text-[10px] text-foreground/60 font-mono max-w-xs leading-relaxed uppercase">
              Komprimujem a nahrávam súbor <br />
              (môže to trvať niekoľko sekúnd)
            </p>
          </div>
        </div>
      )}
    </>
  );
}
