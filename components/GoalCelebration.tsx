"use client";

// components/GoalCelebration.tsx
//
// Self-contained celebration overlay. Triggered when a goal contribution
// pushes the contributed total to/past the target. Three tiers:
//   • "fireworks" — bursts of emoji + a 'whoosh' chime. Important goals.
//   • "confetti"  — falling colored squares + a soft 'pop'. Normal goals.
//   • "none"      — render nothing. Bills get this.
//
// Uses WebAudio for the sound (no asset files) and pure CSS animations
// (no extra deps). Caller is responsible for choosing the tier based on
// the goal category and is_important flag — see celebrationTier() helper.

import { useEffect, useState } from "react";

export type CelebrationTier = "fireworks" | "confetti" | "none";

export function celebrationTier(category: string, isImportant: boolean): CelebrationTier {
  if (category === "bills") return "none";
  if (isImportant) return "fireworks";
  return "confetti";
}

type Props = {
  tier: CelebrationTier;
  show: boolean;
  onDone: () => void;
  // Optional — names of the goals that just completed. The banner
  // displays them so the user knows exactly which goal(s) crossed the
  // line. Especially important on the paycheck splitter where a single
  // commit can finish multiple goals at once.
  goalNames?: string[];
};

const CONFETTI_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#ef4444"];
const FIREWORK_BURSTS = ["🎆", "🎇", "✨", "🎉", "🌟"];

export default function GoalCelebration({ tier, show, onDone, goalNames }: Props) {
  // Build the banner headline once. If we have one name, show it
  // directly; for multiple, list the first and "+ N more"; if none
  // were passed (e.g. from manual contribute on a single goal where the
  // parent already knows the name) fall back to a generic message.
  const bannerLine = (() => {
    if (!goalNames || goalNames.length === 0) return null;
    if (goalNames.length === 1) return `${goalNames[0]} complete!`;
    const [first, ...rest] = goalNames;
    return `${first} + ${rest.length} more complete!`;
  })();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!show || tier === "none") return;
    setActive(true);
    playChime(tier);
    const duration = tier === "fireworks" ? 3500 : 2200;
    const t = setTimeout(() => {
      setActive(false);
      onDone();
    }, duration);
    return () => clearTimeout(t);
  }, [show, tier, onDone]);

  if (!active || tier === "none") return null;

  if (tier === "fireworks") {
    return (
      <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
        <div className="relative w-full h-full">
          {Array.from({ length: 18 }).map((_, i) => {
            const left = 10 + Math.random() * 80;
            const top = 10 + Math.random() * 70;
            const delay = Math.random() * 1.5;
            const emoji = FIREWORK_BURSTS[i % FIREWORK_BURSTS.length];
            const size = 36 + Math.floor(Math.random() * 36);
            return (
              <span
                key={i}
                className="absolute select-none"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  fontSize: `${size}px`,
                  animation: `gc-burst 1.8s ${delay}s ease-out forwards`,
                  opacity: 0,
                }}
              >
                {emoji}
              </span>
            );
          })}
          <div
            className="absolute inset-0 flex items-center justify-center px-6"
            style={{ animation: "gc-banner 3s ease-out" }}
          >
            <div className="bg-white/95 dark:bg-dark-surface/95 backdrop-blur rounded-2xl px-8 py-6 shadow-2xl border-2 border-amber-300 dark:border-amber-700 max-w-md">
              <div className="text-2xl md:text-3xl font-bold text-amber-700 dark:text-amber-300 text-center">
                🎉 {bannerLine || "Goal complete!"}
              </div>
            </div>
          </div>
        </div>
        <style jsx>{`
          @keyframes gc-burst {
            0% { transform: scale(0.3) rotate(0deg); opacity: 0; }
            30% { transform: scale(1.4) rotate(45deg); opacity: 1; }
            100% { transform: scale(1.8) rotate(90deg); opacity: 0; }
          }
          @keyframes gc-banner {
            0% { transform: scale(0.5); opacity: 0; }
            30% { transform: scale(1.1); opacity: 1; }
            80% { transform: scale(1); opacity: 1; }
            100% { transform: scale(1); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  // confetti tier
  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.8;
        const duration = 1.6 + Math.random() * 0.8;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const rotate = Math.floor(Math.random() * 360);
        return (
          <span
            key={i}
            className="absolute top-0 block"
            style={{
              left: `${left}%`,
              width: "10px",
              height: "14px",
              backgroundColor: color,
              transform: `rotate(${rotate}deg)`,
              animation: `gc-fall ${duration}s ${delay}s linear forwards`,
              opacity: 0,
            }}
          />
        );
      })}
      <div
        className="absolute inset-0 flex items-center justify-center px-6"
        style={{ animation: "gc-mini-banner 2s ease-out" }}
      >
        <div className="bg-white/95 dark:bg-dark-surface/95 backdrop-blur rounded-xl px-6 py-3 shadow-lg border border-green-300 dark:border-green-700 max-w-sm">
          <div className="text-base md:text-lg font-semibold text-green-700 dark:text-green-400 text-center">
            ✓ {bannerLine || "Goal complete"}
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes gc-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0.5; }
        }
        @keyframes gc-mini-banner {
          0% { transform: scale(0.7) translateY(20px); opacity: 0; }
          30% { transform: scale(1) translateY(0); opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// Tiny WebAudio chime — no asset file. Fireworks gets a 3-note ascending
// arpeggio; confetti gets a single soft pop. Both auto-clean.
function playChime(tier: CelebrationTier) {
  if (typeof window === "undefined") return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (tier === "fireworks") {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        tone(ctx, freq, ctx.currentTime + i * 0.12, 0.18, 0.18);
      });
    } else {
      tone(ctx, 880, ctx.currentTime, 0.22, 0.12);
    }
  } catch {
    // Audio unavailable (Safari without user interaction etc.) — fine.
  }
}

function tone(ctx: AudioContext, freq: number, start: number, dur: number, vol: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}
