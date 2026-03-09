import { useEffect } from 'react';
import toast from 'react-hot-toast';

type ShortcutCallback = () => void;

interface Shortcut {
  key: string;
  ctrlOrCmd?: boolean;
  shift?: boolean;
  alt?: boolean;
  callback: ShortcutCallback;
  preventDefault?: boolean;
  blockIfInput?: boolean;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea, unless explicitly allowed
      const isInput = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target as HTMLElement).isContentEditable;

      for (const shortcut of shortcuts) {
        if (shortcut.blockIfInput !== false && isInput) {
          continue;
        }

        const isCtrlCmd = event.ctrlKey || event.metaKey;
        const keysMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrlOrCmd === (event.ctrlKey || event.metaKey);
        const shiftMatch = !!shortcut.shift === event.shiftKey;
        const altMatch = !!shortcut.alt === event.altKey;

        if (keysMatch && ctrlMatch && shiftMatch && altMatch) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.callback();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
}

/**
 * Global Keyboard Shortcuts Hook
 * Call this once at the root of the app.
 */
export function useGlobalShortcuts() {
  useKeyboardShortcuts([
    {
      key: 'k',
      ctrlOrCmd: true,
      blockIfInput: false,
      callback: () => {
        // Example: Focus search or open command palette
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        } else {
          toast('Search: Not available on this page', { icon: '🔍' });
        }
      }
    },
    {
      key: '?',
      shift: true,
      blockIfInput: true,
      callback: () => {
        toast.success(
          'Keyboard Shortcuts:\nCmd/Ctrl+K: Search\nShift+?: Help',
          { duration: 4000 }
        );
      }
    }
  ]);
}
