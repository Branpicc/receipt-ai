"use client";

import { useEditMode } from "@/lib/EditMode";
import { Eye, Pencil } from "lucide-react";

/**
 * Visible only to owners. In read-only state, shows an Eye icon and a
 * "Read only — click to edit" button. In edit state, shows a Pencil
 * with a clear background colour and "Edit mode — click to lock".
 *
 * Renders nothing for any other role.
 */
export default function EditModeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { editMode, setEditMode, isOwner } = useEditMode();
  if (!isOwner) return null;

  if (collapsed) {
    return (
      <div className="relative group">
        <button
          onClick={() => setEditMode(!editMode)}
          className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${
            editMode
              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover"
          }`}
        >
          {editMode ? <Pencil className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
          {editMode ? "Edit mode (click to lock)" : "Read only (click to edit)"}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditMode(!editMode)}
      className={`w-full mb-3 flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        editMode
          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50"
          : "bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border"
      }`}
    >
      <span className="flex items-center gap-2">
        {editMode ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        {editMode ? "Edit mode" : "Read only"}
      </span>
      <span className="text-xs opacity-75">
        {editMode ? "click to lock" : "click to edit"}
      </span>
    </button>
  );
}
