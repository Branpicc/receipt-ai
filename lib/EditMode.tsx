"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * Owner edit-mode context.
 *
 * Owners (the role name we use for product-team / super-admin access)
 * can see every firm's data, but in normal operation they should be
 * read-only — accidental clicks while reviewing customers' data
 * shouldn't mutate it. They flip an explicit toggle when they actually
 * mean to edit.
 *
 * For non-owner roles this context is a no-op:
 *   - firm_admin still blocked by their own role rules
 *   - accountant / client unaffected
 */
type EditModeContextType = {
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  isOwner: boolean;
};

const EditModeContext = createContext<EditModeContextType>({
  editMode: false,
  setEditMode: () => {},
  isOwner: false,
});

const STORAGE_KEY = "receipture-owner-edit-mode";

export function EditModeProvider({
  children,
  userRole,
}: {
  children: React.ReactNode;
  userRole: string | null;
}) {
  const isOwner = userRole === "owner";
  const [editMode, setEditModeState] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isOwner) {
      setEditModeState(window.localStorage.getItem(STORAGE_KEY) === "true");
    } else {
      setEditModeState(false);
    }
  }, [isOwner]);

  function setEditMode(v: boolean) {
    setEditModeState(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, v ? "true" : "false");
    }
  }

  return (
    <EditModeContext.Provider value={{ editMode, setEditMode, isOwner }}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  return useContext(EditModeContext);
}
