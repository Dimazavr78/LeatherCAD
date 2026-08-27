import { useCallback, useEffect, useRef, useState } from 'react';
import type { CadObject } from '../../types/cad';

export interface EditorDocumentState {
    objects: CadObject[];
}

interface HistoryState {
    past: EditorDocumentState[];
    present: EditorDocumentState;
    future: EditorDocumentState[];
}

type StateUpdater = (state: EditorDocumentState) => EditorDocumentState;

const HISTORY_LIMIT = 100;

function documentsEqual(a: EditorDocumentState, b: EditorDocumentState) {
    return JSON.stringify(a.objects) === JSON.stringify(b.objects);
}

export function useEditorHistory(initialState: EditorDocumentState) {
    const [history, setHistory] = useState<HistoryState>({
        past: [],
        present: initialState,
        future: [],
    });
    const transactionStartRef = useRef<EditorDocumentState | null>(null);
    const presentRef = useRef(history.present);

    useEffect(() => {
        presentRef.current = history.present;
    }, [history.present]);

    const commitState = useCallback((update: StateUpdater) => {
        setHistory((current) => {
            const next = update(current.present);

            if (documentsEqual(current.present, next)) {
                return current;
            }

            return {
                past: [...current.past, current.present].slice(-HISTORY_LIMIT),
                present: next,
                future: [],
            };
        });
    }, []);

    const updateLiveState = useCallback((update: StateUpdater) => {
        setHistory((current) => ({
            ...current,
            present: update(current.present),
        }));
    }, []);

    const beginTransaction = useCallback(() => {
        if (!transactionStartRef.current) {
            transactionStartRef.current = presentRef.current;
        }
    }, []);

    const commitTransaction = useCallback(() => {
        const start = transactionStartRef.current;
        transactionStartRef.current = null;

        if (!start) {
            return;
        }

        setHistory((current) => {
            if (documentsEqual(start, current.present)) {
                return current;
            }

            return {
                past: [...current.past, start].slice(-HISTORY_LIMIT),
                present: current.present,
                future: [],
            };
        });
    }, []);

    const cancelTransaction = useCallback(() => {
        const start = transactionStartRef.current;
        transactionStartRef.current = null;

        if (start) {
            setHistory((current) => ({ ...current, present: start }));
        }
    }, []);

    const undo = useCallback(() => {
        setHistory((current) => {
            const previous = current.past.at(-1);

            if (!previous) {
                return current;
            }

            return {
                past: current.past.slice(0, -1),
                present: previous,
                future: [current.present, ...current.future],
            };
        });
    }, []);

    const redo = useCallback(() => {
        setHistory((current) => {
            const next = current.future[0];

            if (!next) {
                return current;
            }

            return {
                past: [...current.past, current.present].slice(-HISTORY_LIMIT),
                present: next,
                future: current.future.slice(1),
            };
        });
    }, []);

    return {
        state: history.present,
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
        commitState,
        updateLiveState,
        beginTransaction,
        commitTransaction,
        cancelTransaction,
        undo,
        redo,
    };
}
