"use client";

// components/GoalIconPicker.tsx
//
// Two-tab picker: a curated grid of lucide icons (matching the site's
// icon style) and an emoji input as a fallback for users who want
// something off-list. The parent passes one of icon|emoji at a time —
// picking from one tab clears the other.

import { useState } from "react";
import { ICON_GROUPS } from "@/lib/goalIcons";

type Props = {
  icon: string | null;
  emoji: string | null;
  onChange: (next: { icon: string | null; emoji: string | null }) => void;
};

export default function GoalIconPicker({ icon, emoji, onChange }: Props) {
  const [tab, setTab] = useState<"icons" | "emoji">(emoji ? "emoji" : "icons");
  const [emojiInput, setEmojiInput] = useState(emoji || "");

  return (
    <div className="border border-gray-200 dark:border-dark-border rounded-xl bg-white dark:bg-dark-bg p-3">
      <div className="flex gap-1 mb-3 border-b border-gray-100 dark:border-dark-border">
        <button
          type="button"
          onClick={() => setTab("icons")}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px ${
            tab === "icons"
              ? "border-accent-500 text-accent-600 dark:text-accent-400"
              : "border-transparent text-gray-500 dark:text-gray-400"
          }`}
        >
          Icons
        </button>
        <button
          type="button"
          onClick={() => setTab("emoji")}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px ${
            tab === "emoji"
              ? "border-accent-500 text-accent-600 dark:text-accent-400"
              : "border-transparent text-gray-500 dark:text-gray-400"
          }`}
        >
          Emoji
        </button>
      </div>

      {tab === "icons" ? (
        <div className="max-h-64 overflow-y-auto space-y-3">
          {ICON_GROUPS.map(group => (
            <div key={group.label}>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
                {group.label}
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                {group.icons.map(entry => {
                  const selected = icon === entry.name;
                  const I = entry.Icon;
                  return (
                    <button
                      key={entry.name}
                      type="button"
                      title={entry.label}
                      onClick={() => onChange({ icon: entry.name, emoji: null })}
                      className={`flex items-center justify-center aspect-square rounded-lg border transition-colors ${
                        selected
                          ? "border-accent-500 bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300"
                          : "border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400 hover:border-accent-300"
                      }`}
                    >
                      <I className="w-5 h-5" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Paste any emoji. On macOS press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-dark-hover rounded text-[10px]">⌃⌘Space</kbd>, on Windows <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-dark-hover rounded text-[10px]">Win + .</kbd>
          </p>
          <input
            type="text"
            value={emojiInput}
            onChange={(e) => {
              const v = e.target.value;
              setEmojiInput(v);
              onChange({ icon: null, emoji: v || null });
            }}
            placeholder="🏖️"
            maxLength={4}
            className="w-full px-3 py-2 text-2xl text-center border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
          />
          {emojiInput && (
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              Using: <span className="text-2xl align-middle">{emojiInput}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
