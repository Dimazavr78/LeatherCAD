import { useEffect } from 'react';

export type NudgeDirection = 'left' | 'right' | 'up' | 'down';

interface EditorShortcutActions {
    undo: () => void;
    redo: () => void;
    copy: () => void;
    paste: () => void;
    duplicate: () => void;
    deleteSelected: () => void;
    nudge: (direction: NudgeDirection, largeStep: boolean) => void;
    cancel: () => void;
}

export function isEditableElement(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)
    );
}

export function useEditorShortcuts(actions: EditorShortcutActions) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (isEditableElement(event.target)) {
                return;
            }

            const primaryModifier = event.ctrlKey || event.metaKey;
            const key = event.key.toLowerCase();

            if (primaryModifier && key === 'z') {
                event.preventDefault();
                if (event.shiftKey) {
                    actions.redo();
                } else {
                    actions.undo();
                }
            } else if (primaryModifier && key === 'y') {
                event.preventDefault();
                actions.redo();
            } else if (primaryModifier && key === 'c') {
                event.preventDefault();
                actions.copy();
            } else if (primaryModifier && key === 'v') {
                event.preventDefault();
                actions.paste();
            } else if (primaryModifier && key === 'd') {
                event.preventDefault();
                actions.duplicate();
            } else if (event.key === 'Delete' || event.key === 'Backspace') {
                event.preventDefault();
                actions.deleteSelected();
            } else if (event.key === 'Escape') {
                actions.cancel();
            } else if (event.key.startsWith('Arrow')) {
                const direction = event.key.slice(5).toLowerCase();

                if (
                    direction === 'left' ||
                    direction === 'right' ||
                    direction === 'up' ||
                    direction === 'down'
                ) {
                    event.preventDefault();
                    actions.nudge(direction, event.shiftKey);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [actions]);
}
