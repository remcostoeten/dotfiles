import { useEffect } from 'react';

interface KeyboardShortcut {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  callback: () => void;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const {
          key,
          metaKey = false,
          ctrlKey = false,
          altKey = false,
          shiftKey = false,
          callback,
        } = shortcut;

        const isMatch =
          event.key.toLowerCase() === key.toLowerCase() &&
          !!event.metaKey === metaKey &&
          !!event.ctrlKey === ctrlKey &&
          !!event.altKey === altKey &&
          !!event.shiftKey === shiftKey;

        if (isMatch) {
          event.preventDefault();
          callback();
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
