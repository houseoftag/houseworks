'use client';

import { useCallback, useRef } from 'react';

export type CellEdit = {
  itemId: string;
  columnId: string;
  previousValue: unknown;
  newValue: unknown;
};

type UndoRedoState = {
  undoStack: CellEdit[];
  redoStack: CellEdit[];
};

/**
 * Hook that provides undo/redo functionality for cell edits.
 * Returns push/undo/redo functions and an applyCellUpdate callback.
 */
export function useUndoRedo(
  applyCellUpdate: (itemId: string, columnId: string, value: unknown) => void,
) {
  const stateRef = useRef<UndoRedoState>({ undoStack: [], redoStack: [] });

  const pushEdit = useCallback((edit: CellEdit) => {
    stateRef.current.undoStack.push(edit);
    // Clear redo stack on new edit
    stateRef.current.redoStack = [];
    // Cap stack size
    if (stateRef.current.undoStack.length > 50) {
      stateRef.current.undoStack.shift();
    }
  }, []);

  const undo = useCallback(() => {
    const edit = stateRef.current.undoStack.pop();
    if (!edit) return;
    stateRef.current.redoStack.push(edit);
    applyCellUpdate(edit.itemId, edit.columnId, edit.previousValue);
  }, [applyCellUpdate]);

  const redo = useCallback(() => {
    const edit = stateRef.current.redoStack.pop();
    if (!edit) return;
    stateRef.current.undoStack.push(edit);
    applyCellUpdate(edit.itemId, edit.columnId, edit.newValue);
  }, [applyCellUpdate]);

  const canUndo = useCallback(() => stateRef.current.undoStack.length > 0, []);
  const canRedo = useCallback(() => stateRef.current.redoStack.length > 0, []);

  return { pushEdit, undo, redo, canUndo, canRedo };
}
