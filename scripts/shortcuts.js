(function () {
  const STORAGE_KEY = "oceanShortcuts";

  const ACTION_LABELS = {
    defPrev: "Definition up",
    defNext: "Definition down",
    defToggle: "Toggle definition select",
    addToAnki: "Add to Anki",
    imageNext: "Image next",
    imagePrev: "Image previous",
    imageSelect: "Select image",
    audioNext: "Audio next",
    audioPrev: "Audio previous",
    audioSelect: "Select audio",
    ttsSentence: "Play TTS sentence",
  };

  const DEFAULT_SHORTCUTS = {
    defPrev: { code: "KeyZ", shift: false, ctrl: false, alt: false, meta: false },
    defNext: { code: "KeyC", shift: false, ctrl: false, alt: false, meta: false },
    defToggle: { code: "KeyX", shift: false, ctrl: false, alt: false, meta: false },
    addToAnki: { code: "KeyE", shift: false, ctrl: false, alt: false, meta: false },
    imageNext: { code: "KeyQ", shift: false, ctrl: false, alt: false, meta: false },
    imagePrev: { code: "KeyE", shift: false, ctrl: false, alt: false, meta: false },
    imageSelect: { code: "KeyW", shift: false, ctrl: false, alt: false, meta: false },
    audioNext: { code: "KeyA", shift: false, ctrl: false, alt: false, meta: false },
    audioPrev: { code: "KeyD", shift: false, ctrl: false, alt: false, meta: false },
    audioSelect: { code: "KeyS", shift: false, ctrl: false, alt: false, meta: false },
    ttsSentence: { code: "KeyG", shift: false, ctrl: false, alt: false, meta: false },
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

  function mergeWithDefaults(input) {
    const out = {};
    Object.keys(DEFAULT_SHORTCUTS).forEach((action) => {
      out[action] = normalizeShortcut(input?.[action], DEFAULT_SHORTCUTS[action]);
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
