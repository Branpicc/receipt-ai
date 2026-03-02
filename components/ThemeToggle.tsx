"use client";

import { useTheme } from "@/contexts/ThemeProvider";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="bg-white dark:bg-dark-surface rounded-lg border border-gray-200 dark:border-dark-border p-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
        Appearance
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Choose your preferred theme
      </p>

      <div className="flex gap-3">
        <button
          onClick={() => setTheme("light")}
          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
            theme === "light"
              ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400"
              : "border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl">☀️</span>
            <span className="font-medium">Light</span>
          </div>
        </button>

        <button
          onClick={() => setTheme("dark")}
          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
            theme === "dark"
              ? "border-accent-500 bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400"
              : "border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl">🌙</span>
            <span className="font-medium">Dark</span>
          </div>
        </button>
      </div>

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          💡 Your theme preference is saved and will persist across sessions
        </p>
      </div>
    </div>
  );
}