import React, { useState, useEffect } from "react";

interface EncryptedTextProps {
  text: string;
  encryptedClassName?: string;
  revealedClassName?: string;
  revealDelayMs?: number;
  scrambleIntervalMs?: number;
}

const SCRAMBLE_CHARS = "01$#@%&*?<>[]{}/\\|+=~";

export function EncryptedText({
  text,
  encryptedClassName = "text-neutral-500",
  revealedClassName = "text-foreground",
  revealDelayMs = 50,
  scrambleIntervalMs = 40,
}: EncryptedTextProps) {
  const [revealedLength, setRevealedLength] = useState(0);
  const [scrambledText, setScrambledText] = useState("");

  const uiSpeed = typeof window !== "undefined" ? window.localStorage.getItem("reson_ui_speed") || "TYPEWRITER_ANIMATED" : "TYPEWRITER_ANIMATED";
  const isInstant = uiSpeed === "INSTANT_RAW";

  if (isInstant) {
    return <span className={revealedClassName}>{text}</span>;
  }

  // Reveal characters one-by-one
  useEffect(() => {
    setRevealedLength(0);
    const interval = setInterval(() => {
      setRevealedLength((prev) => {
        if (prev >= text.length) {
          clearInterval(interval);
          return text.length;
        }
        return prev + 1;
      });
    }, revealDelayMs);

    return () => clearInterval(interval);
  }, [text, revealDelayMs]);

  // Scramble the unrevealed characters periodically
  useEffect(() => {
    if (revealedLength >= text.length) {
      setScrambledText(text);
      return;
    }

    const interval = setInterval(() => {
      let result = "";
      for (let i = 0; i < text.length; i++) {
        if (i < revealedLength) {
          result += text[i];
        } else if (text[i] === " ") {
          result += " ";
        } else {
          const randChar = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          result += randChar;
        }
      }
      setScrambledText(result);
    }, scrambleIntervalMs);

    return () => clearInterval(interval);
  }, [text, revealedLength, scrambleIntervalMs]);

  return (
    <span className="font-mono">
      <span className={revealedClassName}>
        {scrambledText.substring(0, revealedLength)}
      </span>
      <span className={encryptedClassName}>
        {scrambledText.substring(revealedLength)}
      </span>
    </span>
  );
}
