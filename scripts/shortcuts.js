(function () {
  const STORAGE_KEY = "oceanShortcuts";

  const ACTION_LABELS = {
    defPrev: "Definition up",
    defNext: "Definition down",
    defToggle: "Toggle definition select",
    addToAnki: "Add to Anki",
    updateCard: "Update card",
    viewBrowser: "View browser",
    imageNext: "Image next",
    imagePrev: "Image previous",
    imageSelect: "Select image",
    audioNext: "Audio next",
    audioPrev: "Audio previous",
    audioSelect: "Select audio",
    audioPlay: "Play focused audio",
    ttsPrev: "TTS previous",
    ttsSelect: "Select TTS",
    ttsNext: "TTS next",
    ttsPlay: "Play focused TTS",
    showOther: "Show other dictionaries",
    showSentence: "Show sentence",
  };

  const DEFAULT_SHORTCUTS = {
    defPrev: { code: "KeyZ", shift: false, ctrl: false, alt: false, meta: false },
    defNext: { code: "KeyC", shift: false, ctrl: false, alt: false, meta: false },
    defToggle: { code: "KeyX", shift: false, ctrl: false, alt: false, meta: false },
    addToAnki: { code: "KeyR", shift: false, ctrl: false, alt: false, meta: false },
    updateCard: { code: "KeyU", shift: false, ctrl: false, alt: false, meta: false },
    viewBrowser: { code: "KeyT", shift: false, ctrl: false, alt: false, meta: false },
    imageNext: { code: "KeyE", shift: false, ctrl: false, alt: false, meta: false },
    imagePrev: { code: "KeyQ", shift: false, ctrl: false, alt: false, meta: false },
    imageSelect: { code: "KeyW", shift: false, ctrl: false, alt: false, meta: false },
    audioNext: { code: "KeyD", shift: false, ctrl: false, alt: false, meta: false },
    audioPrev: { code: "KeyA", shift: false, ctrl: false, alt: false, meta: false },
    audioSelect: { code: "KeyS", shift: false, ctrl: false, alt: false, meta: false },
    audioPlay: { code: "KeyF", shift: false, ctrl: false, alt: false, meta: false },
    ttsPrev: { code: "KeyG", shift: false, ctrl: false, alt: false, meta: false },
    ttsSelect: { code: "KeyH", shift: false, ctrl: false, alt: false, meta: false },
    ttsNext: { code: "KeyJ", shift: false, ctrl: false, alt: false, meta: false },
    ttsPlay: { code: "KeyK", shift: false, ctrl: false, alt: false, meta: false },
    showOther: { code: "KeyV", shift: false, ctrl: false, alt: false, meta: false },
    showSentence: { code: "KeyB", shift: false, ctrl: false, alt: false, meta: false },
  };

  function normalizeShortcut(raw, fallback) {
    if (!raw || typeof raw !== "object" || !raw.code) return { ...fallback };
    return {
      code: raw.code,
      shift: !!raw.shift,
      ctrl: !!raw.ctrl,
      alt: !!raw.alt,
      meta: !!raw.meta,
    };
  }

  function isLegacyAddToAnkiShortcut(raw) {
    return (
      raw &&
      raw.code === "KeyE" &&
      !raw.shift &&
      !raw.ctrl &&
      !raw.alt &&
      !raw.meta
    );
  }

  function migrateLegacyShortcuts(input) {
    if (!input || typeof input !== "object") return input;
    const hasNewActions = !!input.updateCard || !!input.viewBrowser;
    if (!hasNewActions && isLegacyAddToAnkiShortcut(input.addToAnki)) {
      return {
        ...input,
        addToAnki: { code: "KeyR", shift: false, ctrl: false, alt: false, meta: false },
      };
    }
    return input;
  }

  function mergeWithDefaults(input) {
    const migrated = migrateLegacyShortcuts(input);
    const out = {};
    Object.keys(DEFAULT_SHORTCUTS).forEach((action) => {
      out[action] = normalizeShortcut(migrated?.[action], DEFAULT_SHORTCUTS[action]);
    });
    return out;
  }

  function loadShortcuts() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (res) => {
        resolve(mergeWithDefaults(res[STORAGE_KEY]));
      });
    });
  }

  function saveShortcuts(shortcuts) {
    const normalized = mergeWithDefaults(shortcuts);
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: normalized }, () => resolve(normalized));
    });
  }

  function resetShortcuts() {
    return saveShortcuts(DEFAULT_SHORTCUTS);
  }

  function isModifierOnly(code) {
    return ["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight"].includes(code);
  }

  function eventToShortcut(event) {
    return {
      code: event.code,
      shift: !!event.shiftKey,
      ctrl: !!event.ctrlKey,
      alt: !!event.altKey,
      meta: !!event.metaKey,
    };
  }

  function shortcutEquals(event, shortcut) {
    return (
      event.code === shortcut.code &&
      !!event.shiftKey === !!shortcut.shift &&
      !!event.ctrlKey === !!shortcut.ctrl &&
      !!event.altKey === !!shortcut.alt &&
      !!event.metaKey === !!shortcut.meta
    );
  }

  function formatShortcut(shortcut) {
    if (!shortcut || !shortcut.code) return "Unassigned";
    const parts = [];
    if (shortcut.ctrl) parts.push("Ctrl");
    if (shortcut.alt) parts.push("Alt");
    if (shortcut.shift) parts.push("Shift");
    if (shortcut.meta) parts.push("Meta");
    const key = shortcut.code.replace("Key", "").replace("Digit", "");
    parts.push(key);
    return parts.join("+");
  }

  window.ShortcutUtils = {
    STORAGE_KEY,
    ACTION_LABELS,
    DEFAULT_SHORTCUTS,
    loadShortcuts,
    saveShortcuts,
    resetShortcuts,
    eventToShortcut,
    shortcutEquals,
    formatShortcut,
    isModifierOnly,
  };
})();
