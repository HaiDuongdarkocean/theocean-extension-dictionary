console.log("popupDictionary.js loaded");

// Chuyển đổi thành Map để đạt tốc độ O(1)
const dictionary = new Map();

// Thêm biến này ở đầu file để quản lý toàn cục
let globalCloseTimer = null;
let lookupTimer = null;
let popupStack = [];
let lookupMode = "hover";
let activePopup = null;
let shortcutConfig = null;
let shortcutReady = false;
let lastEscTime = 0;
let lastMousePosition = { x: 0, y: 0 }; // Track last mouse position for keydown lookup
const ESC_DOUBLE_CLICK_THRESHOLD = 300;
const ShortcutUtils = window.ShortcutUtils;
const POPUP_SIZE_KEY = "oceanPopupSize";
const POPUP_FEATURES = ["forvo", "images", "tts", "sentence", "other"];

function loadPopupSize() {
  return new Promise((resolve) => {
    chrome.storage.local.get([POPUP_SIZE_KEY], (res) => {
      resolve(res[POPUP_SIZE_KEY] || { width: 320, height: null });
    });
  });
}

function savePopupSize(size) {
  chrome.storage.local.set({ [POPUP_SIZE_KEY]: size });
}

function loadAnkiUIConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["ankiConfig"], (res) =>
      resolve(res.ankiConfig || {}),
    );
  });
}

// 2. Tạo phần tử Popup (như bài trước)
const popup = document.createElement("div");
popup.id = "yomitan-popup";
document.body.appendChild(popup);

function loadLookupMode() {
  chrome.storage.sync.get(["userConfig"], (result) => {
    lookupMode = result.userConfig?.lookupMode || "hover";
  });
}

function isLookupTriggered(event) {
  switch (lookupMode) {
    case "ctrl":
      return event.ctrlKey;
    case "alt":
      return event.altKey;
    case "shift":
      return event.shiftKey;
    case "hover":
    default:
      return true;
  }
}

loadLookupMode();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.userConfig) {
    lookupMode = changes.userConfig.newValue?.lookupMode || "hover";
  }
});

async function loadShortcutConfig() {
  if (!ShortcutUtils) return;
  shortcutConfig = await ShortcutUtils.loadShortcuts();
  shortcutReady = true;
}

loadShortcutConfig();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && ShortcutUtils && changes[ShortcutUtils.STORAGE_KEY]) {
    shortcutConfig = ShortcutUtils.DEFAULT_SHORTCUTS;
    shortcutReady = false;
    loadShortcutConfig();
  }
});

function getShortcut(action) {
  if (!ShortcutUtils) return null;
  if (!shortcutReady || !shortcutConfig) return ShortcutUtils.DEFAULT_SHORTCUTS[action] || null;
  return shortcutConfig[action] || ShortcutUtils.DEFAULT_SHORTCUTS[action] || null;
}

function getShortcutLabel(action) {
  if (!ShortcutUtils) return "";
  return ShortcutUtils.formatShortcut(getShortcut(action));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Feedback Bar Functions
function showFeedback(popup, message, type = "info") {
  if (!popup) return;
  const feedbackBar = popup.querySelector(".yomi-feedback-bar");
  if (!feedbackBar) return;

  feedbackBar.innerHTML = `
    <div class="yomi-feedback-content yomi-feedback-${type}">
      <span class="yomi-feedback-message">${escapeHtml(message)}</span>
    </div>
  `;

  feedbackBar.classList.add("is-visible");

  if (type === "error") {
    setTimeout(() => dismissFeedback(popup), 5000);
  }
}

function showViewLink(popup, noteIds) {
  if (!popup || !noteIds || noteIds.length === 0) return;
  const feedbackBar = popup.querySelector(".yomi-feedback-bar");
  if (!feedbackBar) return;

  const content = feedbackBar.querySelector(".yomi-feedback-content");
  if (!content) return;

  const link = document.createElement("a");
  link.href = "#";
  link.className = "yomi-feedback-link";
  link.textContent = "View";
  link.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const query = Array.isArray(noteIds) && noteIds.length > 0
      ? noteIds.map((id) => `nid:${id}`).join(" OR ")
      : "";
    chrome.runtime.sendMessage({
      action: "guiBrowse",
      query: query
    });
  };

  content.appendChild(link);
}

function showFeedbackWithModal(popup, noteIds, cardData) {
  if (!popup || !noteIds || noteIds.length === 0) return;

  const feedbackBar = popup.querySelector(".yomi-feedback-bar");
  if (!feedbackBar) return;

  // Show feedback with clickable message
  showFeedback(popup, `Found ${noteIds.length} existing notes`, "info");

  const content = feedbackBar.querySelector(".yomi-feedback-content");
  const message = content?.querySelector(".yomi-feedback-message");

  if (message) {
    // Make message clickable
    message.style.cursor = "pointer";
    message.style.textDecoration = "underline";
    message.title = "Click to select notes for update";

    message.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Get detailed note info
      const notesInfoResponse = await runtimeMessageWithTimeout({
        action: "getNotesInfo",
        noteIds: noteIds
      }, 3000);

      if (notesInfoResponse?.success && notesInfoResponse?.notes) {
        showNoteSelectionModal(popup, notesInfoResponse.notes, cardData);
      }
    };
  }

  // Store all noteIds for "Update all" functionality
  popup._selectedNotesForUpdate = null; // null means update all
}

function updateFeedbackWithSelection(popup, totalNotes, selectedCount) {
  if (!popup) return;

  const feedbackBar = popup.querySelector(".yomi-feedback-bar");
  if (!feedbackBar) return;

  const message = feedbackBar.querySelector(".yomi-feedback-message");
  if (!message) return;

  // Update message text to show selection
  if (selectedCount > 0) {
    message.textContent = `Found ${totalNotes} existing notes (${selectedCount})`;
  } else {
    message.textContent = `Found ${totalNotes} existing notes`;
  }
}

function showNoteSelectionModal(popup, notes, cardData) {
  if (!popup || !notes || notes.length === 0) return;

  // Sort notes alphabetically by deckName
  const sortedNotes = notes.slice().sort((a, b) => {
    const deckA = String(a.deckName || "");
    const deckB = String(b.deckName || "");
    return deckA.localeCompare(deckB);
  });

  // Get previously selected notes
  const previousSelection = popup._selectedNotesForUpdate || [];
  const previousSelectionSet = new Set(previousSelection);

  // Create modal backdrop
  const backdrop = document.createElement("div");
  backdrop.className = "yomi-modal-backdrop";

  // Create modal
  const modal = document.createElement("div");
  modal.className = "yomi-modal-container";
  modal.innerHTML = `
    <div class="yomi-modal-header">
      <span class="yomi-modal-title">Select notes to update (0 selected)</span>
      <div class="yomi-modal-actions">
        <button class="yomi-modal-btn yomi-select-all-btn">Select All</button>
        <button class="yomi-modal-btn yomi-clear-all-btn">Clear All</button>
      </div>
    </div>
    <div class="yomi-modal-body">
      ${sortedNotes.map(note => {
    const isChecked = previousSelectionSet.has(note.noteId);
    return `
          <label class="yomi-note-item">
            <input type="checkbox" class="yomi-note-checkbox" data-noteid="${note.noteId}" ${isChecked ? 'checked' : ''}>
            <div class="yomi-note-info">
              <div class="yomi-note-id" data-noteid="${note.noteId}" title="Click to view in Anki Browser">ID: ${note.noteId}</div>
              <div class="yomi-note-deck">Deck: ${escapeHtml(String(note.deckName || "Unknown"))}</div>
              <div class="yomi-note-date">Created: ${escapeHtml(String(note.created || "Unknown"))}</div>
            </div>
          </label>
        `;
  }).join("")}
    </div>
    <div class="yomi-modal-footer">
      <button class="yomi-modal-btn yomi-modal-cancel">Cancel</button>
      <button class="yomi-modal-btn yomi-modal-select">Chọn</button>
      <button class="yomi-modal-btn yomi-modal-confirm" disabled>Confirm (0 notes)</button>
    </div>
  `;

  backdrop.appendChild(modal);
  popup.appendChild(backdrop);

  // Store selected notes - initialize with previous selection
  const selectedNotes = new Set(previousSelection);

  // Update title and confirm button text
  const updateUI = () => {
    const title = modal.querySelector(".yomi-modal-title");
    const confirmBtn = modal.querySelector(".yomi-modal-confirm");
    const count = selectedNotes.size;

    title.textContent = `Select notes to update (${count} selected)`;
    confirmBtn.textContent = `Confirm`;
    confirmBtn.disabled = count === 0;
  };

  // Initial UI update to reflect previous selection
  updateUI();

  // Checkbox change handler
  modal.querySelectorAll(".yomi-note-checkbox").forEach(checkbox => {
    checkbox.onchange = () => {
      const noteId = Number(checkbox.getAttribute("data-noteid"));
      if (checkbox.checked) {
        selectedNotes.add(noteId);
      } else {
        selectedNotes.delete(noteId);
      }
      updateUI();
    };
  });

  // NoteID click handler - open in Anki Browser
  modal.querySelectorAll(".yomi-note-id").forEach(noteIdEl => {
    noteIdEl.style.cursor = "pointer";
    noteIdEl.style.color = "var(--yomi-primary)";
    noteIdEl.style.textDecoration = "underline";

    noteIdEl.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const noteId = noteIdEl.getAttribute("data-noteid");
      chrome.runtime.sendMessage({
        action: "guiBrowse",
        query: `nid:${noteId}`
      });
    };
  });

  // Select All button
  modal.querySelector(".yomi-select-all-btn").onclick = () => {
    modal.querySelectorAll(".yomi-note-checkbox").forEach(checkbox => {
      checkbox.checked = true;
      const noteId = Number(checkbox.getAttribute("data-noteid"));
      selectedNotes.add(noteId);
    });
    updateUI();
  };

  // Clear All button
  modal.querySelector(".yomi-clear-all-btn").onclick = () => {
    modal.querySelectorAll(".yomi-note-checkbox").forEach(checkbox => {
      checkbox.checked = false;
    });
    selectedNotes.clear();
    updateUI();
  };

  // Cancel button - clear selection and close
  const cancelModal = () => {
    popup._selectedNotesForUpdate = null;
    backdrop.remove();
  };

  modal.querySelector(".yomi-modal-cancel").onclick = cancelModal;

  // Chọn button - save selection and close (like backdrop click)
  const selectAndClose = () => {
    if (selectedNotes.size > 0) {
      popup._selectedNotesForUpdate = Array.from(selectedNotes);
      // Update feedback message to show selection count
      updateFeedbackWithSelection(popup, popup._ankiNoteIds.length, selectedNotes.size);
    } else {
      popup._selectedNotesForUpdate = null; // null = update all
      // Update feedback message to show no selection (will update all)
      updateFeedbackWithSelection(popup, popup._ankiNoteIds.length, 0);
    }
    backdrop.remove();
  };

  modal.querySelector(".yomi-modal-select").onclick = selectAndClose;

  // Click backdrop to close (same as Chọn button)
  backdrop.onclick = (e) => {
    if (e.target === backdrop) {
      selectAndClose();
    }
  };

  // Confirm button - update immediately
  modal.querySelector(".yomi-modal-confirm").onclick = async () => {
    const count = selectedNotes.size;
    if (count === 0) return;

    // Show confirmation modal inside popup
    showConfirmationModal(popup, count, async () => {
      backdrop.remove();

      // Update selected notes
      const payload = buildAnkiPayload(cardData, popup);
      const noteIdsArray = Array.from(selectedNotes);

      await updateMultipleNotes(popup, noteIdsArray, payload);
    });
  };

  // Auto-close on navigation events (same as Chọn button)
  const autoCloseHandler = () => {
    if (backdrop.parentNode) {
      selectAndClose();
    }
  };

  // Listen to various navigation events
  popup.addEventListener("scroll", autoCloseHandler, { once: true });
  popup.querySelectorAll(".yomi-feature-btn").forEach(btn => {
    btn.addEventListener("click", autoCloseHandler, { once: true });
  });
}

function showConfirmationModal(popup, count, onConfirm) {
  // Create modal backdrop
  const backdrop = document.createElement("div");
  backdrop.className = "yomi-modal-backdrop";

  // Create modal
  const modal = document.createElement("div");
  modal.className = "yomi-modal-container";
  modal.innerHTML = `
    <div class="yomi-modal-header">
      <span class="yomi-modal-title">Confirm Update</span>
    </div>
    <div class="yomi-modal-body">
      <p>Bạn có chắc muốn update ${count} note${count !== 1 ? "s" : ""}?</p>
    </div>
    <div class="yomi-modal-footer">
      <button class="yomi-modal-btn yomi-modal-cancel">Cancel</button>
      <button class="yomi-modal-btn yomi-modal-confirm" style="background: var(--yomi-primary); color: white; border-color: var(--yomi-primary);">Confirm</button>
    </div>
  `;

  backdrop.appendChild(modal);
  popup.appendChild(backdrop);

  // Cancel button
  const closeModal = () => {
    backdrop.remove();
  };

  modal.querySelector(".yomi-modal-cancel").onclick = closeModal;

  // Click backdrop to close
  backdrop.onclick = (e) => {
    if (e.target === backdrop) {
      closeModal();
    }
  };

  // Confirm button
  modal.querySelector(".yomi-modal-confirm").onclick = () => {
    closeModal();
    onConfirm();
  };
}

async function updateMultipleNotes(popup, noteIds, payload) {
  const count = noteIds.length;
  showFeedback(popup, `Updating ${count} note${count !== 1 ? "s" : ""}...`, "info");

  const results = await Promise.allSettled(
    noteIds.map(noteId =>
      new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: "updateAnkiNote", noteId, data: payload },
          (res) => {
            if (res?.success) {
              resolve(noteId);
            } else {
              reject(new Error(res?.error || "Failed"));
            }
          }
        );
      })
    )
  );

  const successful = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;

  if (failed === 0) {
    showFeedback(popup, `Updated ${successful} note${successful !== 1 ? "s" : ""} successfully`, "success");
  } else {
    showFeedback(popup, `Updated ${successful}/${count} notes (${failed} failed)`, "error");
  }

  showViewLink(popup, noteIds);
}

function dismissFeedback(popup) {
  if (!popup) return;
  const feedbackBar = popup.querySelector(".yomi-feedback-bar");
  if (!feedbackBar) return;

  feedbackBar.innerHTML = "";
  feedbackBar.classList.remove("is-visible");
}

async function checkAnkiConnection() {
  try {
    const response = await runtimeMessageWithTimeout({
      action: "checkAnkiConnection"
    }, 2000);
    return response?.connected === true;
  } catch (err) {
    console.error("Anki connection check failed:", err);
    return false;
  }
}

async function autoCheckAnkiOnOpen(popup, data, ankiConfig) {
  if (!popup || !data) return { shouldShowAddButton: true, shouldEnableAddButton: true, shouldShowUpdateButton: false };

  // Check if allowDuplicate is enabled
  const allowDuplicate = ankiConfig?.allowDuplicate !== false;

  // If allowDuplicate is true, always show and enable Add button
  if (allowDuplicate) {
    return { shouldShowAddButton: true, shouldEnableAddButton: true, shouldShowUpdateButton: false };
  }

  // If allowDuplicate is false, check if note exists
  try {
    const response = await runtimeMessageWithTimeout({
      action: "checkNoteExists",
      word: data.term
    }, 2000);

    if (response?.exists && response?.noteIds) {
      // Note exists - hide Add button
      const noteIds = response.noteIds;

      if (noteIds.length === 1) {
        // Single note - auto-select and show Update button
        showFeedback(popup, `Note already in Anki`, "info");
        showViewLink(popup, noteIds);
        popup._ankiNoteIds = noteIds;
        popup._selectedNoteId = noteIds[0];
        return { shouldShowAddButton: false, shouldEnableAddButton: false, shouldShowUpdateButton: true, noteIds };
      } else {
        // Multiple notes - make feedback message clickable to open modal
        showFeedbackWithModal(popup, noteIds, data);
        showViewLink(popup, noteIds);
        popup._ankiNoteIds = noteIds;

        return { shouldShowAddButton: false, shouldEnableAddButton: false, shouldShowUpdateButton: false, noteIds };
      }
    }

    // Note doesn't exist - enable Add button
    return { shouldShowAddButton: true, shouldEnableAddButton: true, shouldShowUpdateButton: false };
  } catch (err) {
    console.error("Auto-check failed:", err);
    // On error, allow adding
    return { shouldShowAddButton: true, shouldEnableAddButton: true, shouldShowUpdateButton: false };
  }
}

function resolvePopupFeatures(cardData, popupCfg) {
  const available = [];
  const sentenceVisible =
    (cardData?._showSentence !== false && !!cardData?.sentence) ||
    (cardData?._showTranslation !== false && !!cardData?.sentenceTranslation);
  const forvoVisible = popupCfg?.forvo?.enabled !== false;
  const imageVisible = popupCfg?.image?.enabled !== false && cardData?._imagesEnabled !== false;
  const ttsVisible = popupCfg?.tts?.enabled !== false && !!(cardData?.sentence || cardData?.term);
  const otherVisible = Array.isArray(popupCfg?.otherDictionaries) && popupCfg.otherDictionaries.length > 0;

  if (forvoVisible) available.push("forvo");
  if (imageVisible) available.push("images");
  if (ttsVisible) available.push("tts");
  if (sentenceVisible) available.push("sentence");
  if (otherVisible) available.push("other");

  const preferred = popupCfg?.popup?.defaultFeature || "forvo";
  let initial = null;
  if (preferred !== "none" && available.includes(preferred)) {
    initial = preferred;
  } else if (preferred !== "none") {
    initial = available[0] || null;
  }

  return {
    available,
    initial,
    sentenceVisible,
    forvoVisible,
    imageVisible,
    ttsVisible,
    otherVisible,
  };
}

function renderFeatureToolbar(popup) {
  const toolbar = popup.querySelector(".yomi-feature-toolbar");
  if (!toolbar) return;
  const labels = {
    forvo: "Forvo",
    images: "Images",
    tts: "TTS",
    sentence: "Sentence",
    other: "Other",
  };

  const buttons = popup._availableFeatures
    .map(
      (feature) =>
        `<button class="yomi-feature-btn" type="button" data-feature="${feature}">${labels[feature] || feature}</button>`,
    )
    .join("");

  // Add "None" button to close all tabs
  const noneButton = `<button class="yomi-feature-btn" type="button" data-feature="none" title="Close tabs">None</button>`;

  toolbar.innerHTML = buttons + noneButton;

  toolbar.querySelectorAll(".yomi-feature-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const feature = button.getAttribute("data-feature");
      if (feature === "none") {
        setActiveFeature(popup, null);
      } else {
        setActiveFeature(popup, feature);
      }
    });
  });
}

function setActiveFeature(popup, feature) {
  if (!popup) return;
  if (feature !== null && !popup._availableFeatures.includes(feature)) return;
  popup._activeFeature = feature;

  popup.querySelectorAll(".yomi-feature-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-feature") === feature);
  });

  popup.querySelectorAll(".yomi-feature-pane").forEach((pane) => {
    const paneFeature = pane.getAttribute("data-feature");
    pane.classList.toggle("is-active", paneFeature === feature);
  });

  const body = popup.querySelector(".yomi-feature-body");
  if (body) {
    body.classList.toggle("is-empty", !feature);
    body.scrollTop = 0;
  }

  // Scroll the feature-shell into view to ensure toolbar and content are visible
  const featureShell = popup.querySelector(".yomi-feature-shell");
  if (featureShell && feature) {
    featureShell.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function closeFeatureTab(popup) {
  // Close current feature tab to show definition
  setActiveFeature(popup, null);

  // Scroll definition into view
  const defContainer = popup.querySelector(".definition-container");
  if (defContainer) {
    defContainer.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function activateFeatureForAction(popup, action) {
  if (!popup) return;
  const actionMap = {
    audioNext: "forvo",
    audioPrev: "forvo",
    audioSelect: "forvo",
    audioPlay: "forvo",
    imageNext: "images",
    imagePrev: "images",
    imageSelect: "images",
    ttsPrev: "tts",
    ttsSelect: "tts",
    ttsNext: "tts",
    ttsPlay: "tts",
    showOther: "other",
    showSentence: "sentence",
  };
  const feature = actionMap[action];
  if (feature && popup._availableFeatures.includes(feature)) {
    setActiveFeature(popup, feature);
  }
}

async function fetchUserConfig() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getUserConfig" }, resolve);
  });
}

async function playTtsSentence(text, overrideVoiceName = "") {
  if (!text) return;
  const res = await fetchUserConfig();
  const cfg = res?.config || {};
  const ttsCfg = cfg.tts || {};
  if (ttsCfg.enabled === false) return;
  const voiceName =
    overrideVoiceName ||
    (ttsCfg.voices || []).find((v) => v) ||
    ttsCfg.preferredLang ||
    undefined;

  // For sequential playback, wait for TTS to complete
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: "speakLocal",
      text,
      voiceName,
    });
    // Wait for TTS to complete (adjust timeout as needed)
    setTimeout(resolve, 2000);
  });
}

// Sửa lại hàm này: Thay vì tự mở DB, ta gửi tin nhắn cho Background
async function getDefinitionSendMessage(word) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: "search_word", word: word },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Lỗi gửi tin nhắn:", chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(response);
        }
      },
    );
  });
}

// 4. Hàm tìm từ dài nhất xung quanh vị trí offset

// 🌊 OCEAN ENGINE: Match phrasal verbs using OCEAN regex patterns
// Receives complete sentence from Ocean Context
// Returns: { phrasal, singleWord, hasBoth } or null
async function matchPhrasalVerbWithOcean(targetWord, completeSentence) {

  if (!targetWord || !completeSentence) {
    console.warn("input data is empty");
  }
  console.log("🌊 matchPhrasalVerbWithOcean: Starting phrasal verb matching");
  console.log(`   matchPhrasalVerbWithOcean::Target word: "${targetWord}"`);
  console.log(`   matchPhrasalVerbWithOcean::Complete sentence: "${completeSentence}"`);

  // Save original target word before lemmatization
  const originalTargetWord = targetWord.toLowerCase();

  try {
    // Step 1: Lemmatize target word via background service worker
    const lemmatizeResponse = await runtimeMessageWithTimeout({
      action: "lemmatizeWord",
      word: targetWord
    }, 2000);

    if (!lemmatizeResponse || !lemmatizeResponse.success) {
      console.log("🌊 matchPhrasalVerbWithOcean: Lemmatization failed, using original word");
      var lemmatizedWord = targetWord.toLowerCase();
    } else {
      var lemmatizedWord = lemmatizeResponse.lemmatized;
      console.log(`🔄 Lemmatized: "${targetWord}" → "${lemmatizedWord}"`);
    }

    // Step 2: Send message to background service worker with lemmatized word
    const response = await runtimeMessageWithTimeout({
      action: "matchPhrasalVerb",
      targetWord: targetWord,
      lemmaWord: lemmatizedWord,
      contextSentence: completeSentence
    }, 5000);

    if (!response || !response.success) {
      console.log("🌊 matchPhrasalVerbWithOcean: No phrasal match found, returning single word only");
      
      // No phrasal verb, but still return single word data
      const singleWordResult = await getDefinitionSendMessage(lemmatizedWord);
      
      if (!singleWordResult) {
        console.log("🌊 matchPhrasalVerbWithOcean: No single word found either");
        return null;
      }
      
      console.log(`📚 Returning single word data for: "${lemmatizedWord}"`);
      
      // Format frequency once
      let formattedFrequency = null;
      if (singleWordResult.freqs && Array.isArray(singleWordResult.freqs) && singleWordResult.freqs.length > 0) {
        formattedFrequency = singleWordResult.freqs
          .map(f => `${f.resource?.title || f.resource?.id || 'Unknown'}: ${f.entries?.[0]?.value || 'N/A'}`)
          .join(" | ");
      }
      
      // Build term options with inflected and lemma forms
      const termOptions = [];
      
      // Add inflected form if different from lemma
      if (originalTargetWord !== lemmatizedWord) {
        termOptions.push({
          type: 'single',
          term: originalTargetWord,
          index: 1,
          data: {
            ...singleWordResult,
            term: originalTargetWord,
            originalWord: lemmatizedWord,
            sentence: completeSentence,
            frequency: formattedFrequency,
            freqs: singleWordResult.freqs || [],
            _showSentence: true,
            _showTranslation: true,
            _imagesEnabled: true
          }
        });
      }
      
      // Add lemma form
      termOptions.push({
        type: 'single',
        term: lemmatizedWord,
        index: termOptions.length + 1,
        data: {
          ...singleWordResult,
          term: lemmatizedWord,
          sentence: completeSentence,
          frequency: formattedFrequency,
          freqs: singleWordResult.freqs || [],
          _showSentence: true,
          _showTranslation: true,
          _imagesEnabled: true
        }
      });
      
      // Return single word result with term options
      return {
        term: originalTargetWord !== lemmatizedWord ? originalTargetWord : lemmatizedWord,
        pronunciation: singleWordResult.pronunciation || "",
        definition: singleWordResult.definition || "",
        sentence: completeSentence,
        frequency: formattedFrequency,
        freqs: singleWordResult.freqs || [],
        originalWord: originalTargetWord !== lemmatizedWord ? lemmatizedWord : null,
        _showSentence: true,
        _showTranslation: true,
        _imagesEnabled: true,
        termOptions: termOptions,
        hasMultipleTerms: termOptions.length > 1
      };
    }

    const phrasalMatch = response.result;
    if (!phrasalMatch) {
      console.log("🌊 matchPhrasalVerbWithOcean: No phrasal match found, returning single word only");
      
      // No phrasal verb, but still return single word data
      const singleWordResult = await getDefinitionSendMessage(lemmatizedWord);
      
      if (!singleWordResult) {
        console.log("🌊 matchPhrasalVerbWithOcean: No single word found either");
        return null;
      }
      
      console.log(`📚 Returning single word data for: "${lemmatizedWord}"`);
      
      // Format frequency once
      let formattedFrequency = null;
      if (singleWordResult.freqs && Array.isArray(singleWordResult.freqs) && singleWordResult.freqs.length > 0) {
        formattedFrequency = singleWordResult.freqs
          .map(f => `${f.resource?.title || f.resource?.id || 'Unknown'}: ${f.entries?.[0]?.value || 'N/A'}`)
          .join(" | ");
      }
      
      // Build term options with inflected and lemma forms
      const termOptions = [];
      
      // Add inflected form if different from lemma
      if (originalTargetWord !== lemmatizedWord) {
        termOptions.push({
          type: 'single',
          term: originalTargetWord,
          index: 1,
          data: {
            ...singleWordResult,
            term: originalTargetWord,
            originalWord: lemmatizedWord,
            sentence: completeSentence,
            frequency: formattedFrequency,
            freqs: singleWordResult.freqs || [],
            _showSentence: true,
            _showTranslation: true,
            _imagesEnabled: true
          }
        });
      }
      
      // Add lemma form
      termOptions.push({
        type: 'single',
        term: lemmatizedWord,
        index: termOptions.length + 1,
        data: {
          ...singleWordResult,
          term: lemmatizedWord,
          sentence: completeSentence,
          frequency: formattedFrequency,
          freqs: singleWordResult.freqs || [],
          _showSentence: true,
          _showTranslation: true,
          _imagesEnabled: true
        }
      });
      
      // Return single word result with term options
      return {
        term: originalTargetWord !== lemmatizedWord ? originalTargetWord : lemmatizedWord,
        pronunciation: singleWordResult.pronunciation || "",
        definition: singleWordResult.definition || "",
        sentence: completeSentence,
        frequency: formattedFrequency,
        freqs: singleWordResult.freqs || [],
        originalWord: originalTargetWord !== lemmatizedWord ? lemmatizedWord : null,
        _showSentence: true,
        _showTranslation: true,
        _imagesEnabled: true,
        termOptions: termOptions,
        hasMultipleTerms: termOptions.length > 1
      };
    }

    console.log(`🌊 matchPhrasalVerbWithOcean: ✓ Match found: "${phrasalMatch.data.term}"`);

    // Format the result using the same logic as oceanMatcher
    const data = phrasalMatch.data;
    let definitionHtml = "";

    if (data.meaningAtoms && data.meaningAtoms.length > 0) {
      definitionHtml = data.meaningAtoms
        .map((atom, idx) =>
          `<div class="ocean-atom"><b>${atom.head || `#${idx + 1}`}</b> ${atom.glossHtml || ""}</div>`
        )
        .join("");
    } else if (data.definition) {
      definitionHtml = `<div class="ocean-atom">${data.definition}</div>`;
    }

    // Build comprehensive phrasal verb display with proper structure for parseDefinitionBlocks
    const phrasalTerm = `<div class="ocean-phrasal-term">
      <span class="ocean-phrasal-label">📘 Phrasal Verb/Idiom</span>
      <span class="ocean-phrasal-name">${escapeHtml(data.term)}</span>
    </div>`;
    
    // Wrap definition in ocean-atom for proper parsing
    const phrasalDefinition = `<div class="ocean-phrasal-definition">
      <div class="ocean-definition-label">Definition:</div>
      <div class="ocean-atom">${definitionHtml}</div>
    </div>`;

    const contextInfo = `<div class="ocean-context-info">💡 Detected in context: "<i>${escapeHtml(data.detectedInSentence)}</i>"</div>`;
    
    let scoreInfo = "";
    if (data.score !== undefined) {
      scoreInfo = `<div class="ocean-score-info">🎯 Match Score: ${data.score}</div>`;
    }

    const fullPhrasalHtml = phrasalTerm + phrasalDefinition + contextInfo + scoreInfo;

    // Also get single word definition for comparison (use lemmatized word)
    const singleWordResult = await getDefinitionSendMessage(lemmatizedWord);
    
    console.log(`📊 singleWordResult for "${lemmatizedWord}":`, singleWordResult);
    console.log(`📊 freqs data:`, singleWordResult?.freqs);

    // Build term options array for term selector
    const termOptions = [];
    
    // Add phrasal verb as first option
    termOptions.push({
      type: 'phrasal',
      term: data.displayTerm || data.term,
      index: 1,
      data: {
        term: data.displayTerm || data.term,
        pronunciation: data.pronunciation || "",
        definition: fullPhrasalHtml,
        isPhrasal: true,
        originalTerm: data.term,
        detectedPhrase: data.detectedInSentence,
        meaningAtoms: data.meaningAtoms,
        pos: data.pos,
        sentence: completeSentence,
        frequency: null,  // Phrasal verbs don't have frequency
        _showSentence: true,
        _showTranslation: true,
        _imagesEnabled: true
      }
    });
    
    // Add single word options if available
    if (singleWordResult) {
      console.log(`📚 Building term options: original="${originalTargetWord}", lemma="${lemmatizedWord}"`);
      
      // Format frequency once for reuse
      let formattedFrequency = null;
      if (singleWordResult.freqs && Array.isArray(singleWordResult.freqs) && singleWordResult.freqs.length > 0) {
        formattedFrequency = singleWordResult.freqs
          .map(f => `${f.resource?.title || f.resource?.id || 'Unknown'}: ${f.entries?.[0]?.value || 'N/A'}`)
          .join(" | ");
        console.log(`📊 Formatted frequency: "${formattedFrequency}"`);
      } else {
        console.log(`📊 No frequency data available for "${lemmatizedWord}"`);
      }
      
      // Add inflected form if different from lemma (e.g., "cheered" vs "cheer")
      if (originalTargetWord !== lemmatizedWord) {
        console.log(`  ✓ Adding inflected form: "${originalTargetWord}"`);
        termOptions.push({
          type: 'single',
          term: originalTargetWord,
          index: termOptions.length + 1,
          data: {
            ...singleWordResult,
            term: originalTargetWord,
            originalWord: lemmatizedWord,  // Show lemma as root
            sentence: completeSentence,
            frequency: formattedFrequency,
            freqs: singleWordResult.freqs || [],
            _showSentence: true,
            _showTranslation: true,
            _imagesEnabled: true
          }
        });
      }
      
      // Add lemma form (e.g., "cheer")
      console.log(`  ✓ Adding lemma form: "${lemmatizedWord}"`);
      termOptions.push({
        type: 'single',
        term: lemmatizedWord,
        index: termOptions.length + 1,
        data: {
          ...singleWordResult,
          term: lemmatizedWord,
          sentence: completeSentence,
          frequency: formattedFrequency,
          freqs: singleWordResult.freqs || [],
          _showSentence: true,
          _showTranslation: true,
          _imagesEnabled: true
        }
      });
    }

    // Return combined result with proper structure for showPopup
    return {
      term: data.displayTerm || data.term,
      pronunciation: data.pronunciation || "",
      definition: fullPhrasalHtml,
      isPhrasal: true,
      originalTerm: data.term,
      detectedPhrase: data.detectedInSentence,
      sentence: completeSentence,
      frequency: null,  // Phrasal verbs don't have frequency
      _showSentence: true,
      _showTranslation: true,
      _imagesEnabled: true,
      // Term options for term selector
      termOptions: termOptions,
      hasMultipleTerms: termOptions.length > 1
    };

  } catch (oceanError) {
    console.error("⚠️ matchPhrasalVerbWithOcean: Error during phrasal matching:", oceanError);
    return null;
  }
}


async function findLongestWord(text, index) {
  console.log("popupdictionary.js::findLongestWord -> Finding longest word in text:", text, "at index:", index);

  // FALLBACK: Existing longest word logic
  let lookAhead = text.substring(index, index + 50);
  console.log("Look ahead text:", lookAhead);
  let words = lookAhead.split(/\s+/);
  console.log("Split words:", words);

  // --- LEMMATIZE FIRST WORD (target word) ---
  if (words.length > 0) {
    const firstWord = words[0].toLowerCase().replace(/[\.,!?;"\(\):]+$/, "");
    let lemmatizedFirstWord = firstWord;

    // Check irregular map
    if (window.irregularMap && window.irregularMap.has(firstWord)) {
      const irregularInfo = window.irregularMap.get(firstWord);
      lemmatizedFirstWord = irregularInfo.root;
      console.log(`🔄 Lemmatize first word: "${firstWord}" → "${lemmatizedFirstWord}"`);
    }
    // Try regular lemmatization
    else if (typeof window.getRegularRoot === 'function') {
      const regularInfo = await window.getRegularRoot(firstWord);
      if (regularInfo && regularInfo.root) {
        lemmatizedFirstWord = regularInfo.root;
        console.log(`🔄 Lemmatize first word: "${firstWord}" → "${lemmatizedFirstWord}"`);
      }
    }

    // Replace first word with lemmatized version
    words[0] = lemmatizedFirstWord;
    console.log("Words after lemmatization:", words);
  }

  for (let i = words.length; i > 0; i--) {
    // 1. Lấy cụm từ
    let phrase = words.slice(0, i).join(" ");

    // 2. Làm sạch dấu câu và đưa về chữ thường
    let cleanPhrase = phrase.replace(/[\.,!?;"\(\):]+$/, "").toLowerCase();
    console.log("Checking phrase:", cleanPhrase);
    if (cleanPhrase.length === 0) continue;

    // --- TRY OCEAN REGEX MATCHING FIRST (for phrasal verbs) ---
    if (words[0]) {
      try {
        console.log(`🌊 FALLBACK: Trying OCEAN regex matching for "${words[0]}" in "${cleanPhrase}"`);

        // Use message passing to background for OCEAN matching
        // Note: words[0] is already lemmatized from earlier step
        const response = await runtimeMessageWithTimeout({
          action: "matchPhrasalVerb",
          targetWord: words[0],
          contextSentence: cleanPhrase
        }, 3000);

        if (response && response.success && response.result) {
          const phrasalMatch = response.result;
          console.log(`✓ FALLBACK: OCEAN regex match found: "${phrasalMatch.data.term}"`);

          // Format the result
          const data = phrasalMatch.data;
          let definitionHtml = "";

          if (data.meaningAtoms && data.meaningAtoms.length > 0) {
            definitionHtml = data.meaningAtoms
              .map((atom, idx) =>
                `<div class="ocean-atom"><b>${atom.head || `#${idx + 1}`}</b> ${atom.glossHtml || ""}</div>`
              )
              .join("");
          } else if (data.definition) {
            definitionHtml = `<div class="ocean-atom">${data.definition}</div>`;
          }

          const phrasalIndicator = `<div class="ocean-phrasal-indicator">📘 Phrasal Verb/Idiom: <b>${data.term}</b></div>`;
          definitionHtml = phrasalIndicator + definitionHtml;

          const contextInfo = `<div class="ocean-context-info">💡 Detected in context: "<i>${data.detectedInSentence}</i>"</div>`;
          definitionHtml += contextInfo;

          if (data.score !== undefined) {
            const scoreInfo = `<div class="ocean-score-info" style="font-size: 0.85em; color: #666; margin-top: 8px;">🎯 Match Score: ${data.score}</div>`;
            definitionHtml += scoreInfo;
          }

          const formattedPhrasal = {
            term: data.displayTerm || data.term,
            pronunciation: data.pronunciation || "",
            definition: definitionHtml,
            isPhrasal: true,
            originalTerm: data.term,
            detectedPhrase: data.detectedInSentence
          };

          // Also get single word definition for comparison
          const singleWordResult = await getDefinitionSendMessage(words[0].toLowerCase());

          return {
            phrasal: formattedPhrasal,
            singleWord: singleWordResult,
            hasBoth: true
          };
        }
      } catch (oceanError) {
        console.log(`🌊 FALLBACK: OCEAN regex matching failed:`, oceanError);
        // Continue to dictionary lookup
      }
    }

    // --- TRA TỪ ĐIỂN VỚI PHRASE ĐÃ LEMMATIZE ---
    const result = await getDefinitionSendMessage(cleanPhrase);

    if (result) {
      return result;
    }
  }
  return null;
}

function removePopupsAbove(level) {
  while (popupStack.length > level) {
    let p = popupStack.pop();
    if (p) {
      // Stop all audio before removing popup
      stopAllAudios(p);
      p.remove();
      if (activePopup === p) {
        activePopup = popupStack[popupStack.length - 1] || null;
      }
    }
  }
}

function playAudioByIndex(popup, index) {
  playAudioWithUI(popup, index);
}

async function playAudioSequentially(popup, indices) {
  if (!indices || indices.length === 0) return;

  stopAllAudios(popup);
  popup._isPlayingSequence = true;
  popup._audioQueue = indices.slice();

  for (const index of indices) {
    if (!popup._isPlayingSequence) break; // Stop if user cancelled

    const fullList = popup._audioFullList || [];
    const item = fullList[index];

    if (!item) continue;

    // Handle TTS voice
    if (!item.url && item.ttsVoiceName) {
      // Use sentence text if available (from TTS tab), otherwise use sentence or term from cardData
      const text = popup._ttsSentence || popup?._cardData?.sentence || popup?._cardData?.term || "";
      if (text) {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: "speakLocal",
            text,
            voiceName: item.ttsVoiceName,
          });
          // Wait for TTS to complete (adjust timeout as needed)
          setTimeout(resolve, 2000);
        });
      }
      continue;
    }

    // Handle audio file (Forvo)
    const row = popup.querySelector(`.yomi-audio-item[data-index="${index}"]`);
    const playBtn = row?.querySelector(".yomi-audio-play");

    if (!item.url) continue;

    const audio = new Audio(item.url);
    popup._currentAudios = [audio];
    popup._currentPlayingAudio = audio;
    if (playBtn) playBtn.classList.add("is-playing");

    try {
      await audio.play();
      await new Promise((resolve) => {
        audio.onended = resolve;
      });
    } catch (err) {
      console.error("Audio playback error:", err);
    }

    if (playBtn) playBtn.classList.remove("is-playing");
    popup._currentPlayingAudio = null;
  }

  popup._isPlayingSequence = false;
  popup._audioQueue = [];
}

function renderAudioGroup(popup) {
  const container = popup.querySelector(".yomi-audio-list");
  if (!container) return;
  
  const fullList = popup._audioFullList || [];
  
  // If no audio, show placeholder
  if (fullList.length === 0) {
    container.innerHTML = `<div class="yomi-feature-placeholder">No audio</div>`;
    return;
  }
  
  const visibleCount = 3;
  const maxStart = Math.max(0, fullList.length - visibleCount);
  const start = Math.max(0, Math.min(popup._audioWindowStart || 0, maxStart));
  popup._audioWindowStart = start;
  const visibleList = fullList.slice(start, start + visibleCount);

  // Clear any placeholder before rendering
  container.innerHTML = visibleList
    .map((audio, offset) => {
      const index = start + offset;
      const speaker = escapeHtml(audio.speaker || `Speaker ${index + 1}`);
      const region = escapeHtml(audio.region || audio.country || "Unknown");
      return `
        <div class="yomi-audio-item" data-index="${index}">
          <button class="yomi-audio-play" type="button" data-index="${index}" title="Play">
            Play
          </button>
          <button class="yomi-audio-body" type="button" data-index="${index}" title="Select [${getShortcutLabel("audioSelect")}]">
            <span class="yomi-audio-name">${speaker}</span>
            <span class="yomi-audio-region">${region}</span>
          </button>
        </div>
      `;
    })
    .join("");

  attachAudioEvents(popup);
  applyAudioFocus(popup);
  updateForvoMore(popup);
}

function updateForvoMore(popup) {
  const total = popup._audioFullList?.length || 0;
  const moreBtn = popup.querySelector(".yomi-forvo-more");
  const moreRow = popup.querySelector(".yomi-forvo-more-row");
  if (!moreBtn || !moreRow) return;
  const hasMore = total > 3;
  if (!hasMore) {
    moreRow.style.display = "none";
    return;
  }
  const start = popup._audioWindowStart || 0;
  const remaining = Math.max(0, total - (start + 3));
  moreBtn.textContent = remaining > 0 ? `(+${remaining})` : "";
  moreRow.style.display = "flex";
}

function attachAudioEvents(popup) {
  popup.querySelectorAll(".yomi-audio-play").forEach((button) => {
    button.onclick = (e) => {
      e.stopPropagation();
      const index = Number(button.getAttribute("data-index"));
      popup._state.focusedAudioIndex = Number.isNaN(index) ? 0 : index;
      playAudioWithUI(popup, popup._state.focusedAudioIndex);
      applyAudioFocus(popup);
    };
  });

  popup.querySelectorAll(".yomi-audio-body").forEach((button) => {
    button.onclick = (e) => {
      e.stopPropagation();
      const index = Number(button.getAttribute("data-index"));
      if (Number.isNaN(index)) return;
      popup._state.focusedAudioIndex = index;
      if (popup._state.selectedAudios.has(index)) {
        popup._state.selectedAudios.delete(index);
      } else {
        popup._state.selectedAudios.add(index);
      }
      applyAudioFocus(popup);
    };
  });
}

async function runtimeMessageWithTimeout(message, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error("timeout"));
    }, timeoutMs);
    chrome.runtime.sendMessage(message, (response) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

function stopAllAudios(popup) {
  if (!popup._currentAudios) return;

  popup._currentAudios.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch { }
  });

  popup._currentAudios = [];
  popup._isPlayingSequence = false;
  popup._audioQueue = [];
  popup._currentPlayingAudio = null;
}

async function playAudioWithUI(popup, index) {
  const row = popup.querySelector(`.yomi-audio-item[data-index="${index}"]`);
  if (!row) return;
  const playBtn = row.querySelector(".yomi-audio-play");

  const fullList = popup._audioFullList || [];
  const item = fullList[index];
  if (!item) return;

  // Stop all other audios when clicking a specific one
  stopAllAudios(popup);

  if (!item.url && item.ttsVoiceName) {
    // For Forvo section, use term; for TTS section, use sentence
    const text = popup?._cardData?.term || popup?._cardData?.sentence || "";
    if (text) playTtsSentence(text, item.ttsVoiceName);
    return;
  }

  const audio = new Audio(item.url);
  popup._currentAudios = [audio];
  popup._currentPlayingAudio = audio;
  if (playBtn) playBtn.classList.add("is-playing");

  try {
    await audio.play();

    await new Promise((resolve) => {
      audio.onended = resolve;
    });
  } catch { }

  if (playBtn) playBtn.classList.remove("is-playing");
  popup._currentPlayingAudio = null;
}

function parseDefinitionBlocks(data) {
  const blocks = [];

  // Preferred: meaningAtoms from background payload.
  if (Array.isArray(data.meaningAtoms) && data.meaningAtoms.length > 0) {
    data.meaningAtoms.forEach((atom, index) => {
      blocks.push({
        source: data.resourceTitle || "",
        html: `<b>${atom.head || `#${index + 1}`}</b> ${atom.glossHtml || ""}`,
      });
    });
    return blocks;
  }

  const temp = document.createElement("div");
  temp.innerHTML = data.definition || "";

  const sourceBlocks = temp.querySelectorAll(".ocean-dict-block");
  if (sourceBlocks.length > 0) {
    sourceBlocks.forEach((sourceEl) => {
      const sourceTitle =
        sourceEl.querySelector(".ocean-dict-title")?.textContent?.trim() || "";
      const atoms = sourceEl.querySelectorAll(".ocean-atom");
      if (atoms.length > 0) {
        atoms.forEach((atomEl) => {
          blocks.push({
            source: sourceTitle,
            html: atomEl.innerHTML,
          });
        });
      } else {
        blocks.push({
          source: sourceTitle,
          html: sourceEl.querySelector(".ocean-dict-body")?.innerHTML || sourceEl.innerHTML,
        });
      }
    });
    return blocks;
  }

  const atoms = temp.querySelectorAll(".ocean-atom");
  if (atoms.length > 0) {
    atoms.forEach((atomEl) => {
      blocks.push({ source: data.resourceTitle || "", html: atomEl.innerHTML });
    });
    return blocks;
  }

  // Fallback split by double line break blocks.
  const fallback = (data.definition || "")
    .split(/<br\s*\/?>\s*<br\s*\/?>|\n\n/i)
    .map((item) => item.trim())
    .filter(Boolean);
  fallback.forEach((item) => blocks.push({ source: data.resourceTitle || "", html: item }));
  return blocks;
}

function applyDefinitionUIState(popup) {
  const state = popup._state;
  const nodes = popup.querySelectorAll(".yomi-definition-block");
  nodes.forEach((node, idx) => {
    node.classList.toggle("is-focused", idx === state.focusedDefIndex);
    node.classList.toggle("is-selected", state.selectedDefinitions.has(idx));
  });
  if (nodes[state.focusedDefIndex]) {
    nodes[state.focusedDefIndex].scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

function getTtsVoiceRows(ttsCfg) {
  const saved = Array.isArray(ttsCfg?.savedVoices) ? ttsCfg.savedVoices.slice() : [];
  if (saved.length > 0) {
    return saved
      .slice()
      .sort((a, b) => (Number(a.order) || 9999) - (Number(b.order) || 9999))
      .map((item) => ({
        voiceName: item.voiceName || "",
        lang: item.lang || "",
      }))
      .filter((item) => item.voiceName);
  }
  const fallback = Array.isArray(ttsCfg?.voices) ? ttsCfg.voices : [];
  return fallback
    .filter(Boolean)
    .map((voiceName) => ({ voiceName, lang: "" }));
}

function renderPopupTtsGroup(popup, sentence, ttsCfg) {
  const section = popup.querySelector(".yomi-tts-section");
  const container = popup.querySelector(".yomi-tts-list");
  if (!section || !container) return;
  if (!sentence || ttsCfg?.enabled === false) {
    section.style.display = "none";
    container.innerHTML = "";
    return;
  }

  const voices = getTtsVoiceRows(ttsCfg);
  if (voices.length === 0) {
    section.style.display = "none";
    container.innerHTML = "";
    return;
  }

  const maxDisplay = Math.max(1, Math.min(3, Number(ttsCfg?.maxDisplay) || 1));
  const autoplayCount = Math.max(0, Math.min(maxDisplay, Number(ttsCfg?.autoplayCount) || 0));
  const visibleVoices = voices.slice(0, maxDisplay);
  popup._ttsVoices = visibleVoices;
  popup._ttsFocused = 0;
  popup._state.selectedTts = popup._state.selectedTts || new Set();
  popup._ttsSentence = sentence;

  container.innerHTML = visibleVoices
    .map((voice, index) => {
      const label = escapeHtml(voice.voiceName || `Voice ${index + 1}`);
      const lang = escapeHtml(voice.lang || "");
      return `
        <div class="yomi-tts-item" data-index="${index}">
          <button class="yomi-tts-play" type="button" data-index="${index}" title="Play [${getShortcutLabel("ttsPlay")}]">Play</button>
          <button class="yomi-tts-body" type="button" data-index="${index}" title="Select [${getShortcutLabel("ttsSelect")}]">
            <span class="yomi-tts-name">${label}</span>
            <span class="yomi-tts-lang">${lang}</span>
          </button>
        </div>
      `;
    })
    .join("");

  const playAllBtn = section.querySelector(".yomi-tts-play-all");
  if (playAllBtn) {
    playAllBtn.onclick = async () => {
      if (popup._isPlayingSequence) {
        // Stop playback
        stopAllAudios(popup);
        playAllBtn.textContent = "Play all audios";
      } else {
        // Start sequential playback of TTS voices
        playAllBtn.textContent = "Stop audios";
        popup._isPlayingSequence = true;

        for (const voice of visibleVoices) {
          if (!popup._isPlayingSequence) break;
          await playTtsSentence(sentence, voice.voiceName);
        }

        popup._isPlayingSequence = false;
        playAllBtn.textContent = "Play all audios";
      }
    };
  }

  container.querySelectorAll(".yomi-tts-play").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.getAttribute("data-index"));
      popup._ttsFocused = Number.isNaN(idx) ? 0 : idx;
      const voice = visibleVoices[popup._ttsFocused];
      applyTtsFocus(popup);
      if (voice) playTtsSentence(sentence, voice.voiceName);
    };
  });

  container.querySelectorAll(".yomi-tts-body").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.getAttribute("data-index"));
      if (Number.isNaN(idx)) return;
      popup._ttsFocused = idx;
      if (popup._state.selectedTts.has(idx)) {
        popup._state.selectedTts.delete(idx);
      } else {
        popup._state.selectedTts.add(idx);
      }
      applyTtsFocus(popup);
    };
  });

  if (autoplayCount > 0) {
    visibleVoices.slice(0, autoplayCount).forEach((voice, idx) => {
      setTimeout(() => playTtsSentence(sentence, voice.voiceName), 260 + idx * 350);
    });
  }

  applyTtsFocus(popup);
  section.style.display = "";
}

function applyTtsFocus(popup) {
  const nodes = popup.querySelectorAll(".yomi-tts-item");
  nodes.forEach((node, idx) => {
    node.classList.toggle("is-focused", idx === Number(popup._ttsFocused || 0));
    node.classList.toggle("is-selected", popup._state.selectedTts?.has(idx));
  });
  const focused = nodes[Number(popup._ttsFocused || 0)];
  if (focused) {
    focused.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }
}

function moveTtsFocus(popup, delta) {
  const total = popup._ttsVoices?.length || 0;
  if (total === 0) return;
  let idx = Number(popup._ttsFocused || 0);
  if (delta > 0) idx = (idx + 1) % total;
  if (delta < 0) idx = (idx - 1 + total) % total;
  popup._ttsFocused = idx;
  applyTtsFocus(popup);
}

function toggleFocusedTtsSelection(popup) {
  const idx = Number(popup._ttsFocused || 0);
  if (popup._state.selectedTts.has(idx)) {
    popup._state.selectedTts.delete(idx);
  } else {
    popup._state.selectedTts.add(idx);
  }
  applyTtsFocus(popup);
}

function renderDefinitionBlocks(popup, data) {
  const container = popup.querySelector(".definition-container");

  // Standard definition rendering (no more combined phrasal + single word)
  const blocks = parseDefinitionBlocks(data);
  popup._definitionBlocks = blocks;

  container.innerHTML = blocks
    .map(
      (block, index) => `
      <div class="yomi-definition-block" data-def-index="${index}">
        ${block.source ? `<div class="yomi-definition-source">${block.source}</div>` : ""}
        <div class="yomi-definition-html">${block.html}</div>
      </div>
    `,
    )
    .join("");

  popup._state = popup._state || {};
  popup._state.focusedDefIndex = 0;
  popup._state.selectedDefinitions = popup._state.selectedDefinitions || new Set();

  container.querySelectorAll(".yomi-definition-block").forEach((node) => {
    node.addEventListener("click", () => {
      const index = Number(node.getAttribute("data-def-index"));
      popup._state.focusedDefIndex = index;
      if (popup._state.selectedDefinitions.has(index)) {
        popup._state.selectedDefinitions.delete(index);
      } else {
        popup._state.selectedDefinitions.add(index);
      }
      applyDefinitionUIState(popup);
    });
  });

  applyDefinitionUIState(popup);
}

function moveDefinitionFocus(popup, delta) {
  const state = popup._state;
  const total = popup._definitionBlocks?.length || 0;
  if (total === 0) return;
  let next = state.focusedDefIndex + delta;
  if (next < 0) next = total - 1;
  if (next >= total) next = 0;
  state.focusedDefIndex = next;
  applyDefinitionUIState(popup);
}

function toggleFocusedDefinitionSelection(popup) {
  const state = popup._state;
  const idx = state.focusedDefIndex || 0;
  if (state.selectedDefinitions.has(idx)) {
    state.selectedDefinitions.delete(idx);
  } else {
    state.selectedDefinitions.add(idx);
  }
  applyDefinitionUIState(popup);
}

function applyImageFocus(popup) {
  const nodes = popup.querySelectorAll(".yomi-thumb-wrap");
  nodes.forEach((node, idx) => {
    node.classList.toggle("is-focused", idx === popup._state.focusedImageIndex);
    node.classList.toggle("is-selected", popup._state.selectedImages.has(idx));
  });
  if (nodes[popup._state.focusedImageIndex]) {
    nodes[popup._state.focusedImageIndex].scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }
}

function moveImageFocus(popup, delta) {
  const nodes = popup.querySelectorAll(".yomi-thumb");
  if (nodes.length === 0) return;
  let idx = popup._state.focusedImageIndex;

  if (delta > 0) {
    if (idx < nodes.length - 1) {
      idx += 1;
    } else {
      const moreBtn = popup.querySelector(".yomi-load-more-img");
      if (moreBtn && moreBtn.style.display !== "none") {
        moreBtn.click();
      }
    }
  } else if (delta < 0) {
    idx = Math.max(0, idx - 1);
  }

  popup._state.focusedImageIndex = idx;
  applyImageFocus(popup);
}

function toggleFocusedAudioSelection(popup) {
  const idx = popup._state.focusedAudioIndex;
  if (popup._state.selectedAudios.has(idx)) {
    popup._state.selectedAudios.delete(idx);
  } else {
    popup._state.selectedAudios.add(idx);
  }
  applyAudioFocus(popup);
}

function toggleFocusedImageSelection(popup) {
  const idx = popup._state.focusedImageIndex;
  if (popup._state.selectedImages.has(idx)) {
    popup._state.selectedImages.delete(idx);
  } else {
    popup._state.selectedImages.add(idx);
  }
  applyImageFocus(popup);
}

function applyAudioFocus(popup) {
  const nodes = popup.querySelectorAll(".yomi-audio-item");
  nodes.forEach((node) => {
    const idx = Number(node.getAttribute("data-index"));
    node.classList.toggle("is-focused", idx === popup._state.focusedAudioIndex);
    node.classList.toggle("is-selected", popup._state.selectedAudios.has(idx));
  });
  const focusedNode = Array.from(nodes).find(
    (node) => Number(node.getAttribute("data-index")) === popup._state.focusedAudioIndex,
  );
  if (focusedNode) {
    focusedNode.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }
}

function moveAudioFocus(popup, delta) {
  const total = popup._audioFullList?.length || 0;
  if (total === 0) return;

  let idx = popup._state.focusedAudioIndex || 0;
  if (delta > 0) {
    idx = (idx + 1) % total;
  } else if (delta < 0) {
    idx = (idx - 1 + total) % total;
  }

  popup._state.focusedAudioIndex = idx;
  popup._audioWindowStart = Math.max(0, Math.min(idx - 1, Math.max(0, total - 3)));
  renderAudioGroup(popup);
  if (popup._audioAutoPlayOnNavigate) {
    playAudioWithUI(popup, idx);
  }
}

function renderOtherDictionaries(popup, data, popupCfg) {
  const container = popup.querySelector(".yomi-other-list");
  if (!container) return;

  const otherDicts = popupCfg?.otherDictionaries || [];
  if (otherDicts.length === 0) {
    container.innerHTML = '<div class="yomi-feature-placeholder">No external dictionaries configured</div>';
    return;
  }

  const term = encodeURIComponent(data.term || "");
  const sentence = encodeURIComponent(data.sentence || "");

  container.innerHTML = otherDicts
    .map((dict) => {
      const url = (dict.url || "")
        .replace(/\{term\}/g, term)
        .replace(/\{sentence\}/g, sentence);
      const name = escapeHtml(dict.name || "Dictionary");
      return `
        <div style="margin-bottom:8px;">
          <a href="${url}" target="_blank" rel="noopener noreferrer" 
             style="display:block;padding:8px 10px;background:var(--yomi-surface);border:1px solid var(--yomi-border);border-radius:8px;color:var(--yomi-primary);text-decoration:none;font-size:13px;font-weight:600;">
            ${name} →
          </a>
        </div>
      `;
    })
    .join("");
}

function buildAnkiPayload(dataOfCard, popup) {
  const payload = { ...dataOfCard };
  const blocks = popup?._definitionBlocks || [];
  const selectedDefIdx = popup?._state?.selectedDefinitions
    ? Array.from(popup._state.selectedDefinitions.values()).sort((a, b) => a - b)
    : [];

  const finalDefIdx = selectedDefIdx.length > 0
    ? selectedDefIdx
    : blocks.map((_, idx) => idx);
  const definitionHtml = finalDefIdx
    .map((idx) => blocks[idx]?.html || "")
    .filter(Boolean)
    .join("<br>");
  if (definitionHtml) payload.definition = definitionHtml;

  const selectedImageIdx = popup?._state?.selectedImages
    ? Array.from(popup._state.selectedImages.values()).sort((a, b) => a - b)
    : [];
  const imageUrls = selectedImageIdx.length > 0
    ? selectedImageIdx.map((idx) => popup._allImageUrls?.[idx]).filter(Boolean)
    : (() => {
      const focus = popup?._state?.focusedImageIndex ?? 0;
      const url = popup?._allImageUrls?.[focus];
      return url ? [url] : [];
    })();
  if (imageUrls.length > 0) {
    payload.images = imageUrls;
    payload.image = imageUrls[0];
  }

  const selectedAudioIdx = popup?._state?.selectedAudios
    ? Array.from(popup._state.selectedAudios.values()).sort((a, b) => a - b)
    : [];
  const audioUrls = selectedAudioIdx.length > 0
    ? selectedAudioIdx.map((idx) => popup._audioFullList?.[idx]?.url).filter(Boolean)
    : (() => {
      const focus = popup?._state?.focusedAudioIndex ?? 0;
      const url = popup?._audioFullList?.[focus]?.url;
      return url ? [url] : [];
    })();
  if (audioUrls.length > 0) {
    payload.audioList = audioUrls;
    payload.audio = audioUrls[0];
  }

  return payload;
}

function handlePopupShortcutKeydown(event) {
  if (!activePopup || !ShortcutUtils) return;

  // Handle number keys (1-9) for term switching
  if (event.key >= '1' && event.key <= '9' && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
    const termIndex = parseInt(event.key) - 1;
    if (activePopup._termOptions && termIndex < activePopup._termOptions.length) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      switchToTerm(activePopup, termIndex);
      return;
    }
  }

  // Handle ESC key separately
  if (event.code === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const now = Date.now();
    if (now - lastEscTime < ESC_DOUBLE_CLICK_THRESHOLD) {
      // Double ESC - close all popups
      removePopupsAbove(0);
      lastEscTime = 0;
    } else {
      // Single ESC - close topmost popup
      if (popupStack.length > 0) {
        const topPopup = popupStack[popupStack.length - 1];
        if (topPopup) {
          stopAllAudios(topPopup);
          topPopup.remove();
          popupStack.pop();
          activePopup = popupStack[popupStack.length - 1] || null;
        }
      }
      lastEscTime = now;
    }
    return;
  }

  const action = Object.keys(ShortcutUtils.ACTION_LABELS).find((key) => {
    const shortcut = getShortcut(key);
    return shortcut && ShortcutUtils.shortcutEquals(event, shortcut);
  });
  if (!action) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  // Definition shortcuts (Z, X, C) -> close feature tab and show definition
  if (["defPrev", "defNext", "defToggle"].includes(action)) {
    closeFeatureTab(activePopup);
    if (action === "defPrev") moveDefinitionFocus(activePopup, -1);
    if (action === "defNext") moveDefinitionFocus(activePopup, 1);
    if (action === "defToggle") toggleFocusedDefinitionSelection(activePopup);
    return;
  }

  // Image shortcuts (Q, E, W)
  if (action === "imageNext") {
    const wasTabClosed = activePopup._activeFeature !== "images";
    setActiveFeature(activePopup, "images");
    if (!wasTabClosed) {
      moveImageFocus(activePopup, 1);
    }
    return;
  }
  if (action === "imagePrev") {
    const wasTabClosed = activePopup._activeFeature !== "images";
    setActiveFeature(activePopup, "images");
    if (!wasTabClosed) {
      moveImageFocus(activePopup, -1);
    }
    return;
  }
  if (action === "imageSelect") {
    const wasTabClosed = activePopup._activeFeature !== "images";
    setActiveFeature(activePopup, "images");
    if (!wasTabClosed) {
      toggleFocusedImageSelection(activePopup);
    }
    return;
  }

  // Audio/Forvo shortcuts (A, D, S, F)
  if (action === "audioNext") {
    if (activePopup._availableFeatures?.includes("forvo")) {
      const wasTabClosed = activePopup._activeFeature !== "forvo";
      setActiveFeature(activePopup, "forvo");

      if (wasTabClosed) {
        activePopup._state.focusedAudioIndex = 0;
        activePopup._audioWindowStart = 0;
        if ((activePopup._audioFullList?.length || 0) > 0) {
          renderAudioGroup(activePopup);
          if (activePopup._audioAutoPlayOnNavigate) {
            playAudioWithUI(activePopup, 0);
          }
        }
      } else {
        moveAudioFocus(activePopup, 1);
      }
    }
    return;
  }

  if (action === "audioPrev") {
    if (activePopup._availableFeatures?.includes("forvo")) {
      const wasTabClosed = activePopup._activeFeature !== "forvo";
      setActiveFeature(activePopup, "forvo");

      if (wasTabClosed) {
        activePopup._state.focusedAudioIndex = 0;
        activePopup._audioWindowStart = 0;
        if ((activePopup._audioFullList?.length || 0) > 0) {
          renderAudioGroup(activePopup);
          if (activePopup._audioAutoPlayOnNavigate) {
            playAudioWithUI(activePopup, 0);
          }
        }
      } else {
        moveAudioFocus(activePopup, -1);
      }
    }
    return;
  }

  if (action === "audioSelect") {
    setActiveFeature(activePopup, "forvo");
    toggleFocusedAudioSelection(activePopup);
    return;
  }

  if (action === "audioPlay") {
    setActiveFeature(activePopup, "forvo");
    const focus = activePopup?._state?.focusedAudioIndex ?? 0;
    playAudioWithUI(activePopup, focus);
    return;
  }

  // TTS shortcuts (G, J, H, K)
  if (action === "ttsNext") {
    if (activePopup._availableFeatures?.includes("tts")) {
      const wasTabClosed = activePopup._activeFeature !== "tts";
      setActiveFeature(activePopup, "tts");

      if (wasTabClosed) {
        activePopup._ttsFocused = 0;
        applyTtsFocus(activePopup);
        if (activePopup._ttsVoices?.length > 0 && activePopup._ttsAutoPlayOnNavigate) {
          const voice = activePopup._ttsVoices[0];
          const sentenceText = activePopup._cardData?.sentence || activePopup._cardData?.term || "";
          playTtsSentence(sentenceText, voice?.voiceName || "");
        }
      } else {
        moveTtsFocus(activePopup, 1);
      }
    }
    return;
  }

  if (action === "ttsPrev") {
    if (activePopup._availableFeatures?.includes("tts")) {
      const wasTabClosed = activePopup._activeFeature !== "tts";
      setActiveFeature(activePopup, "tts");

      if (wasTabClosed) {
        activePopup._ttsFocused = 0;
        applyTtsFocus(activePopup);
        if (activePopup._ttsVoices?.length > 0 && activePopup._ttsAutoPlayOnNavigate) {
          const voice = activePopup._ttsVoices[0];
          const sentenceText = activePopup._cardData?.sentence || activePopup._cardData?.term || "";
          playTtsSentence(sentenceText, voice?.voiceName || "");
        }
      } else {
        moveTtsFocus(activePopup, -1);
      }
    }
    return;
  }

  if (action === "ttsSelect") {
    setActiveFeature(activePopup, "tts");
    toggleFocusedTtsSelection(activePopup);
    return;
  }

  if (action === "ttsPlay") {
    setActiveFeature(activePopup, "tts");
    const sentenceText = activePopup._cardData?.sentence || activePopup._cardData?.term || "";
    const ttsVoices = Array.isArray(activePopup._ttsVoices) ? activePopup._ttsVoices : [];
    const focus = Number(activePopup._ttsFocused || 0);
    const voice = ttsVoices[Math.max(0, Math.min(ttsVoices.length - 1, focus))];
    playTtsSentence(sentenceText, voice?.voiceName || "");
    return;
  }

  // Other dictionaries shortcut (V)
  if (action === "showOther") {
    setActiveFeature(activePopup, "other");
    return;
  }

  // Sentence shortcut (B)
  if (action === "showSentence") {
    setActiveFeature(activePopup, "sentence");
    return;
  }

  // Anki shortcuts
  if (action === "viewBrowser") {
    const viewBtn = activePopup.querySelector(".yomi-view-browser-btn");
    if (viewBtn) viewBtn.click();
    return;
  }

  if (action === "updateCard") {
    const updateBtn = activePopup.querySelector(".yomi-update-anki-btn");
    if (updateBtn) updateBtn.click();
    return;
  }

  if (action === "addToAnki") {
    const payload = buildAnkiPayload(activePopup._cardData || {}, activePopup);
    addNoteToAnki(payload, activePopup);
    return;
  }
}

document.addEventListener("keydown", handlePopupShortcutKeydown, true);

async function addNoteToAnki(dataOfCard, popup) {
  const uiCfg = await loadAnkiUIConfig();
  console.log("PopupDrictionary.js::Adding note to Anki:", dataOfCard);
  chrome.runtime.sendMessage(
    {
      action: "addNoteToAnki",
      data: dataOfCard,
    },
    async (response) => {
      console.log("PopupDrictionary.js::addNoteToAnki responed:", response);
      if (!response) {
        showFeedback(popup, "Error: Could not connect to Anki", "error");
        return;
      }

      const addBtn = popup?.querySelector(".yomi-add-anki-btn");

      // Handle duplicate case
      if (response.duplicate) {
        showFeedback(popup, `Note already in Anki`, "info");
        showViewLink(popup, response.noteIds);
        popup._ankiNoteIds = response.noteIds;

        if (addBtn) {
          addBtn.disabled = true;
        }

        // Show Update button after Add action (even if duplicate)
        ensureUpdateButton(popup, () => {
          const payload = buildAnkiPayload(dataOfCard, popup);
          updateExistingAnkiCard(payload, response.noteIds?.[0], popup);
        });
        return;
      }

      // Handle success case
      if (response.success) {
        showFeedback(popup, `Added ${dataOfCard.term || "word"} to Anki`, "success");
        showViewLink(popup, response.noteIds);
        popup._ankiNoteIds = response.noteIds;

        if (addBtn) {
          addBtn.disabled = true;
        }

        // Show Update button after successful Add
        ensureUpdateButton(popup, () => {
          const payload = buildAnkiPayload(dataOfCard, popup);
          updateExistingAnkiCard(payload, response.noteIds?.[0], popup);
        });
      } else {
        showFeedback(popup, `Error: ${response.error || "Failed to add note"}`, "error");
      }
    },
  );
}

function showBrowserButton(popup, noteIds = [], forceClick = false, message = "") {
  if (!popup) return;
  popup._ankiNoteIds = noteIds;
  const query =
    Array.isArray(noteIds) && noteIds.length
      ? noteIds.map((id) => `nid:${id}`).join(" OR ")
      : "";
  let viewBtn = popup.querySelector(".yomi-view-browser-btn");
  if (!viewBtn) {
    viewBtn = document.createElement("button");
    viewBtn.className = "yomi-view-browser-btn";
    viewBtn.textContent = "View Browser";
    const header = popup.querySelector(".yomi-header-main");
    if (header) header.appendChild(viewBtn);
  }
  viewBtn.title = message ? `${message} [${getShortcutLabel("viewBrowser")}]` : `View Browser [${getShortcutLabel("viewBrowser")}]`;
  viewBtn.onclick = () => {
    chrome.runtime.sendMessage(
      { action: "guiBrowse", query },
      () => { },
    );
  };
  if (forceClick) viewBtn.click();
}

function ensureUpdateButton(popup, handler) {
  if (!popup) return;
  let btn = popup.querySelector(".yomi-update-anki-btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.className = "yomi-update-anki-btn";
    btn.textContent = "Update card";
    const header = popup.querySelector(".yomi-header-actions");
    if (header) header.appendChild(btn);
  }
  btn.style.display = "inline-block";
  btn.title = `Update card [${getShortcutLabel("updateCard")}]`;
  btn.onclick = handler;
  btn.disabled = false;
}

function updateExistingAnkiCard(extensionData, noteId, popup) {
  if (!noteId) return;
  console.log("Updating Anki note:", noteId, extensionData);
  chrome.runtime.sendMessage(
    { action: "updateAnkiNote", noteId, data: extensionData },
    (res) => {
      if (!res || !res.success) {
        showFeedback(popup, "Failed to update card", "error");
      } else {
        showFeedback(popup, "Card updated successfully", "success");
        showViewLink(popup, [noteId]);
        // Keep Update button enabled for multiple updates
      }
    },
  );
}

async function showPopup(x, y, data, level) {
  console.log("showPopup called with:", { x, y, data, level });
  console.log("Frequency data in data.freqs:", data.freqs);
  removePopupsAbove(level - 1);

  // Extract and format frequency data if available
  if (!data.frequency && data.freqs && data.freqs.length > 0) {
    data.frequency = data.freqs
      .map(f => `${f.resource.title || f.resource.id}: ${f.entries[0].value}`)
      .join(" | ");
    console.log("Formatted frequency:", data.frequency);
  }

  const newPopup = document.createElement("div");
  newPopup.className = "yomitan-popup-stack";
  newPopup.dataset.level = level;
  newPopup._state = {
    focusedDefIndex: 0,
    focusedImageIndex: 0,
    focusedAudioIndex: 0,
    selectedDefinitions: new Set(),
    selectedImages: new Set(),
    selectedAudios: new Set(),
  };
  newPopup._cardData = data;
  const userCfgRes = await fetchUserConfig();
  const popupCfg = userCfgRes?.config || {};
  const featureState = resolvePopupFeatures(data, popupCfg);
  newPopup._availableFeatures = featureState.available.slice();
  newPopup._activeFeature = featureState.initial;
  newPopup._audioAutoPlayOnNavigate = popupCfg?.forvo?.autoplayOnNavigate === true;
  newPopup._ttsAutoPlayOnNavigate = (popupCfg?.tts?.autoplayCount || 0) > 0;
  newPopup._state.selectedTts = new Set();
  const savedSize = await loadPopupSize();
  const sentenceHtml = featureState.sentenceVisible
    ? `<div class="yomi-sentence-text">${escapeHtml(data.sentence || "")}</div>
       ${data._showTranslation !== false && data.sentenceTranslation
      ? `<div class="yomi-sentence-translation">${escapeHtml(data.sentenceTranslation)}</div>`
      : ""
    }`
    : `<div class="yomi-feature-placeholder">Sentence disabled</div>`;

  newPopup.innerHTML = `
        <div class="yomi-header">
            <!-- Row 1: Meta & Action -->
            <div class="yomi-header-row-1">
                <span class="yomi-pronunciation">/${data.pronunciation || "n/a"}/</span>
                <div class="yomi-header-actions">
                  <button class="yomi-update-anki-btn" style="display: none;" title="Update card [${getShortcutLabel("updateCard")}]" type="button">Update (U)</button>
                  <button class="yomi-add-anki-btn" title="Add to Anki [${getShortcutLabel("addToAnki")}]" type="button">Add (R)</button>
                </div>
            </div>
            
            <!-- Row 2: Target Word -->
            <div class="yomi-header-row-2">
                <span class="popup-term-title">${escapeHtml(data.term || "")}</span>
            </div>
            
            <!-- Row 3: Information -->
            <div class="yomi-header-row-3">
                <span class="yomi-frequency" style="display: ${data.frequency ? 'inline' : 'none'};">frequency: ${escapeHtml(String(data.frequency || ""))}</span>
                <span class="yomi-origin-note" style="display: ${data.originalWord ? 'inline' : 'none'};">(root: <span>${escapeHtml(data.originalWord || "")}</span>)</span>
            </div>
            
            <!-- Row 4: Feedback Bar -->
            <div class="yomi-feedback-bar"></div>
        </div>

        <!-- Term Selector (NEW) -->
        <div class="yomi-term-selector" style="display: none;"></div>

        <section class="yomi-feature-shell">
          <section class="yomi-feature-toolbar"></section>
          <section class="yomi-feature-body">
            <div class="yomi-feature-pane yomi-forvo-section" data-feature="forvo">
              <div class="yomi-forvo-head">
                <section class="flex title-forvo">
                  <span style="color: var(--yomi-text-sub); fonr">Forvo audio</span>
                  <div class="yomi-forvo-more-row">
                    <button class="yomi-load-more yomi-forvo-more" type="button">(0)</button>
                  </div>
                </section>
                <div class="yomi-forvo-actions">
                  <button class="yomi-forvo-play" type="button">Play</button>
                  <button class="yomi-forvo-play-all" type="button">Play all</button>
                </div>
              </div>
              <div class="yomi-audio-list">
                <div class="yomi-feature-placeholder">Audio pending...</div>
              </div>
            </div>

            <div class="yomi-feature-pane yomi-image-section" data-feature="images">
              <div class="yomi-image-gallery"><div class="ocean-image-gallery"></div></div>
              <div class="yomi-image-controls">
                <button class="yomi-load-more-img" title="Load more images [${getShortcutLabel("imageNext")}]">More images</button>
              </div>
            </div>

            <div class="yomi-feature-pane yomi-tts-section" data-feature="tts">
              <div class="yomi-tts-head">
                <span>TTS sentence</span>
                <button class="yomi-tts-play-all" type="button">Play all audios</button>
              </div>
              <div class="yomi-tts-list"></div>
            </div>

            <div class="yomi-feature-pane yomi-sentence-section" data-feature="sentence">
              ${sentenceHtml}
            </div>

            <div class="yomi-feature-pane yomi-other-section" data-feature="other">
              <div class="yomi-other-list"></div>
            </div>
          </section>
        </section>

        <div class="definition-container">
            <div class="yomi-definition-loading">Loading definitions...</div>
        </div>
        <div class="yomi-resizer"></div>
    `;

  const targetContainer = document.fullscreenElement || document.body;
  targetContainer.appendChild(newPopup);

  if (savedSize?.width) newPopup.style.width = `${savedSize.width}px`;
  if (savedSize?.height) newPopup.style.height = `${savedSize.height}px`;

  // Get button references
  const addBtn = newPopup.querySelector(".yomi-add-anki-btn");
  const updateBtn = newPopup.querySelector(".yomi-update-anki-btn");

  // Gắn sự kiện Add to Anki TRƯỚC KHI disable
  if (addBtn) {
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const payload = buildAnkiPayload(data, newPopup);
      addNoteToAnki(payload, newPopup);
    });
  }

  // Check Anki connection and configure Add button
  const ankiConnected = await checkAnkiConnection();

  // Hide Update button initially (only show after successful Add or when note exists)
  if (updateBtn) {
    updateBtn.style.display = "none";
  }

  if (!ankiConnected) {
    // Anki not connected - hide Add button
    if (addBtn) {
      addBtn.style.display = "none";
    }
  } else {
    // Anki connected - check allowDuplicate and existing notes
    const ankiConfig = await loadAnkiUIConfig();
    const checkResult = await autoCheckAnkiOnOpen(newPopup, data, ankiConfig);

    if (addBtn) {
      if (!checkResult.shouldShowAddButton) {
        addBtn.style.display = "none";
      } else {
        addBtn.disabled = !checkResult.shouldEnableAddButton;
        if (!checkResult.shouldEnableAddButton) {
          addBtn.title = "Note already exists in Anki";
        }
      }
    }

    // Show Update button if note exists (single note case)
    if (checkResult.shouldShowUpdateButton && updateBtn) {
      ensureUpdateButton(newPopup, () => {
        const payload = buildAnkiPayload(data, newPopup);
        updateExistingAnkiCard(payload, newPopup._selectedNoteId, newPopup);
      });
    }

    // Show Update button for multiple notes case
    if (checkResult.noteIds && checkResult.noteIds.length > 1 && updateBtn) {
      ensureUpdateButton(newPopup, async () => {
        const payload = buildAnkiPayload(data, newPopup);

        // Check if user selected specific notes
        if (newPopup._selectedNotesForUpdate && newPopup._selectedNotesForUpdate.length > 0) {
          // Update only selected notes
          const count = newPopup._selectedNotesForUpdate.length;
          if (confirm(`Bạn có chắc muốn update ${count} note${count !== 1 ? "s" : ""} đã chọn?`)) {
            await updateMultipleNotes(newPopup, newPopup._selectedNotesForUpdate, payload);
          }
        } else {
          // Update all notes
          const count = checkResult.noteIds.length;
          if (confirm(`Bạn có chắc muốn update tất cả ${count} notes?`)) {
            await updateMultipleNotes(newPopup, checkResult.noteIds, payload);
          }
        }
      });
    }
  }

  renderFeatureToolbar(newPopup);
  setActiveFeature(newPopup, newPopup._activeFeature);

  renderPopupTtsGroup(newPopup, data.sentence || "", popupCfg.tts || {});
  if (!newPopup._availableFeatures.includes("tts")) {
    const ttsPane = newPopup.querySelector('.yomi-feature-pane[data-feature="tts"]');
    if (ttsPane) ttsPane.style.display = "none";
  }

  // Render Other Dictionaries
  renderOtherDictionaries(newPopup, data, popupCfg);

  renderDefinitionBlocks(newPopup, data);

  // Render term selector if multiple terms available
  if (data.termOptions && data.termOptions.length > 0) {
    newPopup._termOptions = data.termOptions;
    newPopup._activeTermIndex = 0;
    renderTermSelector(newPopup, data.termOptions);
  }

  // 4. ĐI LẤY DỮ LIỆU THẬT (Bất đồng bộ)
  const audioContainer = newPopup.querySelector(".yomi-audio-list");
  const forvoHead = newPopup.querySelector(".yomi-forvo-head");
  const forvoActions = newPopup.querySelector(".yomi-forvo-actions");
  const moreRow = newPopup.querySelector(".yomi-forvo-more-row");
  const playFocusBtn = newPopup.querySelector(".yomi-forvo-play");
  const playAllBtn = newPopup.querySelector(".yomi-forvo-play-all");
  const moreBtn = newPopup.querySelector(".yomi-forvo-more");
  if (playFocusBtn) {
    playFocusBtn.onclick = () => {
      const idx = Number(newPopup._state.focusedAudioIndex || 0);
      playAudioWithUI(newPopup, idx);
    };
  }
  if (playAllBtn) {
    playAllBtn.onclick = async () => {
      if (newPopup._isPlayingSequence) {
        // Stop playback
        stopAllAudios(newPopup);
        playAllBtn.textContent = "Play all";
      } else {
        // Start sequential playback
        playAllBtn.textContent = "Stop";
        const total = newPopup._audioFullList?.length || 0;
        const count = Math.min(3, total);
        const indices = Array.from({ length: count }, (_, i) => i);
        await playAudioSequentially(newPopup, indices);
        playAllBtn.textContent = "Play all";
      }
    };
  }
  if (moreBtn) {
    moreBtn.onclick = (e) => {
      e.stopPropagation();
      const total = newPopup._audioFullList?.length || 0;
      if (total <= 3) return;
      const next = (newPopup._audioWindowStart || 0) + 3;
      newPopup._audioWindowStart = next >= total ? 0 : next;
      renderAudioGroup(newPopup);
    };
  }

  function loadForvoAudio() {
    if (!audioContainer) return;
    audioContainer.innerHTML = `<div class="yomi-feature-placeholder">Loading...</div>`;

    fetchAudioFromForvo(data.term).then((realData) => {
      const processed = processAudioList(realData);

      if (processed.fullList && processed.fullList.length > 0) {
        newPopup._audioFullList = processed.fullList;
        data.audio = newPopup._audioFullList?.[0]?.url;
        newPopup._audioWindowStart = 0;
        renderAudioGroup(newPopup);

        // Cache audio data for initial term (index 0)
        if (newPopup._termDataCache && newPopup._termDataCache[0]) {
          newPopup._termDataCache[0].audioList = processed.fullList;
        }

        const autoCount = Math.min(
          AudioConfig.autoPlayCount || 0,
          3,
          newPopup._audioFullList.length || 0,
        );
        if (autoCount > 0) {
          setTimeout(() => {
            playMultipleAudios(newPopup, autoCount);
          }, 260);
        }
      } else {
        // Try to get TTS voices from config first
        const ttsRows = getTtsVoiceRows(popupCfg.tts || {});

        if (ttsRows.length > 0) {
          // Use configured TTS voices
          newPopup._audioFullList = ttsRows.map((row) => ({
            url: "",
            ttsVoiceName: row.voiceName,
            speaker: row.voiceName,
            region: row.lang || "TTS",
          }));
          newPopup._audioWindowStart = 0;
          renderAudioGroup(newPopup);

          // Auto-play first TTS voice as fallback
          setTimeout(() => {
            const text = data.term || "";
            if (text && ttsRows[0]?.voiceName) {
              chrome.runtime.sendMessage({
                action: "speakLocal",
                text,
                voiceName: ttsRows[0].voiceName,
              });
            }
          }, 260);
        } else {
          // Fallback: Use browser's built-in TTS voices
          chrome.runtime.sendMessage({ action: "getAvailableVoices" }, (response) => {
            const voices = response?.voices || [];
            const englishVoices = voices.filter(v => v.lang && v.lang.startsWith('en'));

            if (englishVoices.length > 0) {
              // Use first English voice
              const voice = englishVoices[0];
              newPopup._audioFullList = [{
                url: "",
                ttsVoiceName: voice.name,
                speaker: voice.name,
                region: voice.lang || "TTS",
              }];
              newPopup._audioWindowStart = 0;
              renderAudioGroup(newPopup);

              // Auto-play
              setTimeout(() => {
                const text = data.term || "";
                if (text) {
                  chrome.runtime.sendMessage({
                    action: "speakLocal",
                    text,
                    voiceName: voice.name,
                  });
                }
              }, 260);
            } else {
              // No voices available at all
              audioContainer.innerHTML = `<div class="yomi-feature-placeholder">No audio</div>`;
            }
          });
        }
      }
    });
  }

  if (!featureState.forvoVisible || !AudioConfig.forvoEnabled) {
    if (audioContainer) audioContainer.innerHTML = `<div class="yomi-feature-placeholder">Forvo disabled</div>`;
    if (forvoHead) forvoHead.style.display = "none";
    if (moreRow) moreRow.style.display = "none";
    newPopup._audioFullList = [];
    newPopup._audioVisibleCount = 0;
  } else if (AudioConfig.forvoMode === "manual") {
    if (forvoHead) forvoHead.style.display = "flex";
    if (moreRow) moreRow.style.display = "none";
    if (audioContainer) {
      audioContainer.innerHTML = `<button class="yomi-forvo-load yomi-load-more" title="Load audio [${getShortcutLabel("audioNext")}]">Load audio</button>`;
      const btn = audioContainer.querySelector(".yomi-forvo-load");
      if (btn) {
        btn.onclick = (e) => {
          e.stopPropagation();
          loadForvoAudio();
        };
      }
    }
  } else {
    if (forvoHead) forvoHead.style.display = "flex";
    if (moreRow) moreRow.style.display = "flex";
    loadForvoAudio();
  }

  // --- GIẢI THUẬT TÍNH VỊ TRÍ CHỐNG TRÀN (viewport, fixed) ---
  const popupWidth = 320;
  const popupHeight = newPopup.offsetHeight || 400;
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;

  let finalX = x + 10; // lệch phải 10px so với điểm trỏ
  let finalY = y + 20; // lệch xuống 20px

  // Tràn phải -> lật sang trái
  if (finalX + popupWidth > viewWidth) {
    finalX = x - popupWidth - 10;
  }
  // Tràn trái
  if (finalX < 5) finalX = 5;

  // Tràn dưới -> lật lên trên
  if (finalY + popupHeight > viewHeight) {
    finalY = y - popupHeight - 20;
  }
  // Tràn trên
  if (finalY < 5) finalY = 5;

  newPopup.style.left = `${finalX}px`;
  newPopup.style.top = `${finalY}px`;
  newPopup.style.visibility = "visible"; // Hiển thị lại sau khi đã căn chỉnh
  newPopup.style.zIndex = (10000 + level).toString();

  //-----------------------
  // --- ĐOẠN THÊM MỚI: Ảnh ---
  if (featureState.imageVisible) {
    let allImageUrls = [];
    let remainingUrls = [];
    let loadedUrls = [];
    let failedAttempts = 0;
    const gallery = newPopup.querySelector(".yomi-image-gallery");
    const loadMoreBtn = newPopup.querySelector(".yomi-load-more-img");
    newPopup._allImageUrls = [];
    const maxLinks = Math.min(20, Math.max(5, Number(popupCfg?.image?.maxLinks) || 20));
    const autoLoadCount = Math.min(5, Math.max(1, Number(popupCfg?.image?.autoLoadCount) || 3));
    const retryLimit = Math.min(10, Math.max(0, Number(popupCfg?.image?.retryLimit) ?? 5));

    function reindexImages() {
      gallery.querySelectorAll(".yomi-thumb-wrap").forEach((wrap, idx) => {
        wrap.setAttribute("data-image-index", String(idx));
      });
    }

    function updateMoreButton() {
      if (!loadMoreBtn) return;
      const remaining = remainingUrls.length;
      if (remaining > 0) {
        loadMoreBtn.textContent = `More images (+${remaining})`;
        loadMoreBtn.style.display = "inline-flex";
      } else {
        loadMoreBtn.style.display = "none";
      }
    }

    function appendImage(url, targetCount) {
      const wrap = document.createElement("div");
      wrap.className = "yomi-thumb-wrap";
      const img = document.createElement("img");
      img.src = url;
      img.className = "yomi-thumb";
      img.title = `Image [${getShortcutLabel("imageNext")}/${getShortcutLabel("imagePrev")}] • Select [${getShortcutLabel("imageSelect")}]`;

      wrap.onclick = () => {
        const index = Number(wrap.getAttribute("data-image-index"));
        newPopup._state.focusedImageIndex = index;
        toggleFocusedImageSelection(newPopup);
      };

      img.onload = () => {
        loadedUrls.push(url);
        newPopup._allImageUrls = loadedUrls.slice();
        wrap.appendChild(img);
        gallery.appendChild(wrap);
        reindexImages();
        applyImageFocus(newPopup);
        
        // Cache image data for initial term (index 0)
        if (newPopup._termDataCache && newPopup._termDataCache[0]) {
          newPopup._termDataCache[0].imageUrls = loadedUrls.slice();
        }
        
        loadUntil(targetCount);
      };

      img.onerror = () => {
        failedAttempts += 1;
        loadUntil(targetCount);
      };
    }

    function loadUntil(targetCount) {
      if (loadedUrls.length >= targetCount) {
        updateMoreButton();
        return;
      }
      if (remainingUrls.length === 0) {
        updateMoreButton();
        return;
      }
      if (failedAttempts >= retryLimit) {
        updateMoreButton();
        return;
      }
      const url = remainingUrls.shift();
      appendImage(url, targetCount);
    }

    runtimeMessageWithTimeout({ action: "fetchImages", term: data.term, maxLinks }, 5000)
      .then((res) => {
        if (res && res.success && Array.isArray(res.urls) && res.urls.length > 0) {
          allImageUrls = res.urls.slice(0, maxLinks);
          remainingUrls = allImageUrls.slice();
          loadUntil(autoLoadCount);
        } else {
          gallery.innerHTML = "";
          updateMoreButton();
        }
      })
      .catch(() => {
        gallery.innerHTML = "";
        updateMoreButton();
      });

    if (loadMoreBtn) {
      loadMoreBtn.onclick = () => loadUntil(loadedUrls.length + autoLoadCount);
    }
  } else {
    newPopup._allImageUrls = [];
  }

  // Resize handle
  const resizer = newPopup.querySelector(".yomi-resizer");
  if (resizer) {
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;
    const minW = 260;
    const minH = 180;
    const onMouseMove = (e) => {
      const newW = Math.max(minW, startW + (e.clientX - startX));
      const newH = Math.max(minH, startH + (e.clientY - startY));
      newPopup.style.width = `${newW}px`;
      newPopup.style.height = `${newH}px`;
    };
    const onMouseUp = (e) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      savePopupSize({
        width: parseInt(newPopup.style.width || "320", 10),
        height: parseInt(newPopup.style.height || "0", 10) || null,
      });
    };
    resizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      startW = newPopup.offsetWidth;
      startH = newPopup.offsetHeight;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }

  popupStack.push(newPopup);
  activePopup = newPopup;
}

/**
 * Render term selector tabs
 */
function renderTermSelector(popup, termOptions) {
  if (!termOptions || termOptions.length <= 1) {
    // Hide term selector if only one term
    const selector = popup.querySelector(".yomi-term-selector");
    if (selector) selector.style.display = "none";
    return;
  }

  const selector = popup.querySelector(".yomi-term-selector");
  if (!selector) return;

  const activeIndex = popup._activeTermIndex || 0;

  selector.innerHTML = termOptions
    .map((option, idx) => {
      const isActive = idx === activeIndex;
      return `
        <div class="yomi-term-tab ${isActive ? 'is-active' : ''}" data-term-index="${idx}">
          <div class="yomi-term-tab-name" title="${escapeHtml(option.term)}">${escapeHtml(option.term)}</div>
        </div>
      `;
    })
    .join("");

  // Attach click handlers
  selector.querySelectorAll(".yomi-term-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const termIndex = Number(tab.getAttribute("data-term-index"));
      switchToTerm(popup, termIndex);
    });
  });

  selector.style.display = "flex";
}

/**
 * Switch to a different term
 */
async function switchToTerm(popup, termIndex) {
  const termOptions = popup._termOptions;
  if (!termOptions || termIndex < 0 || termIndex >= termOptions.length) {
    return;
  }

  const option = termOptions[termIndex];
  const termData = option.data;

  console.log(`🔄 Switching to term: "${option.term}" (index: ${termIndex})`);

  // Update active index
  popup._activeTermIndex = termIndex;

  // Update term selector visual state
  renderTermSelector(popup, termOptions);

  // Re-resolve features for the new term data
  const userCfgRes = await fetchUserConfig();
  const popupCfg = userCfgRes?.config || {};
  const featureState = resolvePopupFeatures(termData, popupCfg);
  popup._availableFeatures = featureState.available.slice();
  
  // Keep current active feature if still available, otherwise switch to first available
  if (!popup._availableFeatures.includes(popup._activeFeature)) {
    popup._activeFeature = featureState.initial;
  }
  
  // Re-render feature toolbar with updated features
  renderFeatureToolbar(popup);
  
  // Update popup with new term data
  await updatePopupWithTermData(popup, termData);
}

/**
 * Update popup content with new term data
 */
async function updatePopupWithTermData(popup, termData) {
  const termIndex = popup._activeTermIndex;
  
  // Initialize cache if needed
  if (popup._termDataCache === undefined) {
    popup._termDataCache = {};
  }
  
  // Cache the full term data for this term
  if (!popup._termDataCache[termIndex]) {
    popup._termDataCache[termIndex] = {
      termData: termData,
      audioList: null,
      imageUrls: null
    };
  } else {
    // Update term data in cache
    popup._termDataCache[termIndex].termData = termData;
  }
  
  // Update header
  const termTitle = popup.querySelector(".popup-term-title");
  const pronunciation = popup.querySelector(".yomi-pronunciation");
  const frequency = popup.querySelector(".yomi-frequency");
  const originNote = popup.querySelector(".yomi-origin-note");

  if (termTitle) termTitle.textContent = termData.term || "";
  if (pronunciation) pronunciation.textContent = `/${termData.pronunciation || "n/a"}/`;
  
  if (frequency) {
    // Try to format frequency from freqs array if frequency field is not set
    let frequencyText = termData.frequency;
    if (!frequencyText && termData.freqs && Array.isArray(termData.freqs) && termData.freqs.length > 0) {
      try {
        frequencyText = termData.freqs
          .map(f => `${f.resource?.title || f.resource?.id || 'Unknown'}: ${f.entries?.[0]?.value || 'N/A'}`)
          .join(" | ");
      } catch (err) {
        console.error(`📊 Error formatting frequency:`, err, termData.freqs);
      }
    }
    
    if (frequencyText) {
      frequency.textContent = `frequency: ${frequencyText}`;
      frequency.style.display = "inline";
      console.log(`📊 Frequency displayed: ${frequencyText}`);
    } else {
      frequency.style.display = "none";
      console.log(`📊 No frequency data for term: ${termData.term}`);
    }
  }
  
  if (originNote) {
    if (termData.originalWord) {
      originNote.innerHTML = `(root: <span>${escapeHtml(termData.originalWord)}</span>)`;
      originNote.style.display = "inline";
    } else {
      originNote.style.display = "none";
    }
  }

  // Update card data
  popup._cardData = termData;

  // Reload definitions
  renderDefinitionBlocks(popup, termData);

  // Get cached data for this term
  const cachedData = popup._termDataCache[termIndex];
  
  // Handle audio (Forvo) - same for both phrasal and single words
  const audioContainer = popup.querySelector(".yomi-audio-list");
  const forvoHead = popup.querySelector(".yomi-forvo-head");
  const moreRow = popup.querySelector(".yomi-forvo-more-row");
  
  // Show forvo section
  if (forvoHead) forvoHead.style.display = "flex";
  if (moreRow) moreRow.style.display = "flex";
  
  if (cachedData && cachedData.audioList) {
    // Restore cached audio - CLEAR placeholder first
    if (audioContainer) audioContainer.innerHTML = "";
    popup._audioFullList = cachedData.audioList;
    popup._audioWindowStart = 0;
    renderAudioGroup(popup);
  } else {
    // Load new audio
    if (audioContainer) audioContainer.innerHTML = `<div class="yomi-feature-placeholder">Loading...</div>`;
    
    fetchAudioFromForvo(termData.term).then(async (realData) => {
      const processed = processAudioList(realData);
      if (processed.fullList && processed.fullList.length > 0) {
        // CLEAR placeholder before rendering
        if (audioContainer) audioContainer.innerHTML = "";
        popup._audioFullList = processed.fullList;
        popup._audioWindowStart = 0;
        renderAudioGroup(popup);
        
        // Cache audio data
        popup._termDataCache[termIndex].audioList = processed.fullList;
      } else {
        // No Forvo audio - use TTS as fallback
        console.log(`🔊 No Forvo audio for "${termData.term}", using TTS fallback`);
        
        const userCfgRes = await fetchUserConfig();
        const popupCfg = userCfgRes?.config || {};
        const ttsRows = getTtsVoiceRows(popupCfg.tts || {});

        if (ttsRows.length > 0) {
          // Use configured TTS voices as audio list
          popup._audioFullList = ttsRows.map((row) => ({
            url: "",
            ttsVoiceName: row.voiceName,
            speaker: row.voiceName,
            region: row.lang || "TTS",
          }));
          popup._audioWindowStart = 0;
          
          // CLEAR placeholder before rendering
          if (audioContainer) audioContainer.innerHTML = "";
          renderAudioGroup(popup);
          
          // Cache TTS audio data
          popup._termDataCache[termIndex].audioList = popup._audioFullList;

          // Auto-play first TTS voice as fallback
          setTimeout(() => {
            const text = termData.term || "";
            if (text && ttsRows[0]?.voiceName) {
              playTtsSentence(text, ttsRows[0].voiceName);
            }
          }, 260);
        } else {
          // Fallback: Use browser's built-in TTS voices
          chrome.runtime.sendMessage({ action: "getAvailableVoices" }, (response) => {
            const voices = response?.voices || [];
            const englishVoices = voices.filter(v => v.lang && v.lang.startsWith('en'));

            if (englishVoices.length > 0) {
              // Use first English voice
              const voice = englishVoices[0];
              popup._audioFullList = [{
                url: "",
                ttsVoiceName: voice.name,
                speaker: voice.name,
                region: voice.lang || "TTS",
              }];
              popup._audioWindowStart = 0;
              
              // CLEAR placeholder before rendering
              if (audioContainer) audioContainer.innerHTML = "";
              renderAudioGroup(popup);
              
              // Cache TTS audio data
              popup._termDataCache[termIndex].audioList = popup._audioFullList;

              // Auto-play
              setTimeout(() => {
                playTtsSentence(termData.term || "", voice.name);
              }, 260);
            } else {
              if (audioContainer) audioContainer.innerHTML = `<div class="yomi-feature-placeholder">No audio or TTS available</div>`;
            }
          });
        }
      }
    });
  }

  // Handle images - same for both phrasal and single words
  const imageGalleryContainer = popup.querySelector(".yomi-image-gallery");
  
  if (cachedData && cachedData.imageUrls) {
    // Restore cached images - CLEAR both containers first
    if (imageGalleryContainer) imageGalleryContainer.innerHTML = '<div class="ocean-image-gallery"></div>';
    const newGallery = popup.querySelector(".ocean-image-gallery");
    popup._allImageUrls = cachedData.imageUrls;
    
    // Re-render cached images
    cachedData.imageUrls.forEach((url, idx) => {
      const wrap = document.createElement("div");
      wrap.className = "yomi-thumb-wrap";
      wrap.setAttribute("data-image-index", String(idx));
      
      const img = document.createElement("img");
      img.src = url;
      img.className = "yomi-thumb";
      img.title = `Image [${getShortcutLabel("imageNext")}/${getShortcutLabel("imagePrev")}] • Select [${getShortcutLabel("imageSelect")}]`;
      
      wrap.onclick = () => {
        popup._state.focusedImageIndex = idx;
        toggleFocusedImageSelection(popup);
      };
      
      wrap.appendChild(img);
      if (newGallery) newGallery.appendChild(wrap);
    });
    
    applyImageFocus(popup);
  } else {
    // Load new images - CLEAR both containers first
    if (imageGalleryContainer) imageGalleryContainer.innerHTML = '<div class="ocean-image-gallery"></div>';
    const newGallery = popup.querySelector(".ocean-image-gallery");
    
    const userCfgRes = await fetchUserConfig();
    const popupCfg = userCfgRes?.config || {};
    const maxLinks = Math.min(20, Math.max(5, Number(popupCfg?.image?.maxLinks) || 20));
    const autoLoadCount = Math.min(5, Math.max(1, Number(popupCfg?.image?.autoLoadCount) || 3));
    
    runtimeMessageWithTimeout({ action: "fetchImages", term: termData.term, maxLinks }, 5000)
      .then((res) => {
        if (res && res.success && Array.isArray(res.urls) && res.urls.length > 0) {
          const imageUrls = res.urls.slice(0, maxLinks);
          
          // Load first few images - CLEAR placeholder first
          const currentGallery = popup.querySelector(".ocean-image-gallery");
          if (currentGallery) currentGallery.innerHTML = "";
          const loadedUrls = [];
          
          imageUrls.slice(0, autoLoadCount).forEach((url, idx) => {
            const wrap = document.createElement("div");
            wrap.className = "yomi-thumb-wrap";
            wrap.setAttribute("data-image-index", String(idx));
            
            const img = document.createElement("img");
            img.src = url;
            img.className = "yomi-thumb";
            img.title = `Image [${getShortcutLabel("imageNext")}/${getShortcutLabel("imagePrev")}] • Select [${getShortcutLabel("imageSelect")}]`;
            
            wrap.onclick = () => {
              popup._state.focusedImageIndex = idx;
              toggleFocusedImageSelection(popup);
            };
            
            img.onload = () => {
              loadedUrls.push(url);
              wrap.appendChild(img);
              if (currentGallery) currentGallery.appendChild(wrap);
              applyImageFocus(popup);
            };
          });
          
          popup._allImageUrls = loadedUrls;
          
          // Cache image data
          popup._termDataCache[termIndex].imageUrls = loadedUrls;
        } else {
          const currentGallery = popup.querySelector(".ocean-image-gallery");
          if (currentGallery) currentGallery.innerHTML = "";
        }
      });
  }

  // Handle TTS - always available for both phrasal and single word
  const ttsContainer = popup.querySelector(".yomi-tts-list");
  if (ttsContainer) {
    const userCfgRes = await fetchUserConfig();
    const popupCfg = userCfgRes?.config || {};
    const ttsText = termData.sentence || termData.term || "";
    console.log(`🔊 Rendering TTS with text: "${ttsText}"`);
    renderPopupTtsGroup(popup, ttsText, popupCfg.tts || {});
  }

  // Handle Sentence section - update with current term's sentence and translation
  const sentenceSection = popup.querySelector(".yomi-sentence-section");
  if (sentenceSection) {
    const showSentence = termData._showSentence !== false;
    const showTranslation = termData._showTranslation !== false;
    const hasSentence = !!termData.sentence;
    const hasTranslation = !!termData.sentenceTranslation;
    
    if (showSentence && hasSentence) {
      let sentenceHtml = `<div class="yomi-sentence-text">${escapeHtml(termData.sentence)}</div>`;
      if (showTranslation && hasTranslation) {
        sentenceHtml += `<div class="yomi-sentence-translation">${escapeHtml(termData.sentenceTranslation)}</div>`;
      }
      sentenceSection.innerHTML = sentenceHtml;
      console.log(`📝 Updated sentence section with: "${termData.sentence}"`);
    } else {
      sentenceSection.innerHTML = `<div class="yomi-feature-placeholder">Sentence disabled</div>`;
    }
  }

  // Handle Other Dictionaries
  renderOtherDictionaries(popup, termData, await fetchUserConfig().then(r => r?.config || {}));

  console.log(`✓ Updated popup with term: "${termData.term}"`);
}

/**
 * Perform lookup at specified coordinates
 * @param {number} clientX - X coordinate
 * @param {number} clientY - Y coordinate
 * @param {Element|null} closestPopup - Closest popup element (for level calculation)
 */
async function performLookup(clientX, clientY, closestPopup = null) {
  let range = null;
  if (typeof document.caretRangeFromPoint === "function") {
    range = document.caretRangeFromPoint(clientX, clientY);
  } else if (typeof document.caretPositionFromPoint === "function") {
    const pos = document.caretPositionFromPoint(clientX, clientY);
    if (pos && pos.offsetNode) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }

  // Debug logging
  if (range) {
    console.log("popupDictionary.js::Range:", range);
    console.log("Mouse đang chạm vào:", range.startContainer);
  } else {
    console.log("Range trả về NULL tại:", clientX, clientY);
  }

  // Kiểm tra an toàn cho range
  if (
    !range ||
    !range.startContainer ||
    range.startContainer.nodeType !== Node.TEXT_NODE
  )
    return;

  // --- MÀI LẠI ĐỘ NHẠY TẠI ĐÂY ---
  const rect = range.getBoundingClientRect();

  // Tăng padding lên 5-8px để dễ trúng hơn trên các dòng chữ thưa
  const padding = 8;

  const isOverText =
    clientX >= rect.left - padding &&
    clientX <= rect.right + padding &&
    clientY >= rect.top - padding &&
    clientY <= rect.bottom + padding;

  // LOG ĐỂ KIỂM TRA: Nếu con thấy log này mà không thấy popup, nghĩa là padding vẫn hẹp
  if (!isOverText) {
    console.log("Chuột ở quá xa chữ:", clientX, rect.left);
    return;
  }

  // Use Ocean Context Engine to get clean context
  const oceanContext = getOceanContext(range);

  if (!oceanContext || !oceanContext.sentence || !oceanContext.word) {
    console.log("Ocean Context Engine returned null or incomplete");
    return;
  }

  console.log("Ocean Context:", oceanContext);

  const sentence = oceanContext.sentence.toLowerCase();
  const targetWord = oceanContext.word.toLowerCase();

  if (!sentence || sentence.trim() === "") return;

  // 🌊 OCEAN ENGINE: Match phrasal verb or single word with complete sentence
  const oceanResult = await matchPhrasalVerbWithOcean(targetWord, sentence);
  console.log("❤️ oceanResult:", oceanResult);

  if (!oceanResult) {
    console.log("⚠️ No result from Ocean Engine");
    return;
  }

  console.log("🌊 OCEAN result found, processing...");
  oceanResult.sentence = sentence;
  
  // Load config for sentence translation
  const config = await new Promise((resolve) => {
    chrome.storage.sync.get(["userConfig"], (res) =>
      resolve(res.userConfig || {}),
    );
  });
  const showSentence = config.sentence?.showSentence !== false;
  const showTranslation = config.sentence?.showTranslation !== false;
  oceanResult._showSentence = showSentence;
  oceanResult._showTranslation = showTranslation;
  oceanResult._imagesEnabled = config.image?.enabled !== false;

  // Translate sentence if enabled
  if (showTranslation && config.translateEnabled && sentence) {
    const translationResult = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: "translateSentence", text: sentence },
        resolve,
      );
    });

    if (translationResult && translationResult.success) {
      oceanResult.sentenceTranslation = translationResult.text;
      
      // Also add to all term options
      if (oceanResult.termOptions) {
        oceanResult.termOptions.forEach(option => {
          option.data.sentenceTranslation = translationResult.text;
          option.data._showSentence = showSentence;
          option.data._showTranslation = showTranslation;
          option.data._imagesEnabled = config.image?.enabled !== false;
        });
      }
    } else {
      oceanResult.sentenceTranslation = "Xảy ra lỗi dịch";
    }
  }
  
  // KIỂM TRA TRÙNG TỪ
  const isAlreadyShown = popupStack.some(
    (p) =>
      p.querySelector(".popup-term-title").innerText.trim().toLowerCase() ===
      oceanResult.term.toLowerCase(),
  );
  if (isAlreadyShown) return;

  // Khi tìm thấy từ mới, hủy lệnh xóa để "Tiến lên" cấp cao hơn
  clearTimeout(globalCloseTimer);
  globalCloseTimer = null;

  let level = closestPopup ? parseInt(closestPopup.dataset.level) + 1 : 1;

  showPopup(clientX, clientY, oceanResult, level);
}

document.addEventListener("mousemove", (event) => {
  // Update last mouse position for keydown lookup
  lastMousePosition.x = event.clientX;
  lastMousePosition.y = event.clientY;

  const closestPopup = event.target.closest(".yomitan-popup-stack");
  // console.log("Mouse moved. Closest popup:", closestPopup);
  // 1. QUẢN LÝ ĐÓNG (Sửa lỗi const và logic delay)
  if (closestPopup) {
    clearTimeout(globalCloseTimer); // Hủy lệnh đóng từ vùng trống
    globalCloseTimer = null;

    let currentLevel = parseInt(closestPopup.dataset.level);

    // Nếu chuột lùi về cấp thấp hơn, đợi 1s rồi mới xóa cấp cao (cho thong thả)
    if (currentLevel < popupStack.length) {
      if (!globalCloseTimer) {
        globalCloseTimer = setTimeout(() => {
          removePopupsAbove(currentLevel);
          globalCloseTimer = null;
        }, 150);
      }
    }
  } else {
    // Nếu chuột ra vùng trống, đợi 0.5s rồi dọn sạch chiến trường
    if (!globalCloseTimer) {
      globalCloseTimer = setTimeout(() => {
        // removePopupsAbove(0);  
        globalCloseTimer = null;
      }, 150);
    }
  }

  // 2. QUẢN LÝ TRA TỪ (Lookup)
  clearTimeout(lookupTimer);
  lookupTimer = setTimeout(async () => {
    if (!isLookupTriggered(event)) return;
    await performLookup(event.clientX, event.clientY, closestPopup);
  }, 150);
});

// Keydown listener for instant lookup when pressing lookup mode key
document.addEventListener("keydown", async (event) => {
  // Only trigger if we're in a modifier key lookup mode (not hover)
  if (lookupMode === "hover") return;

  // Check if the pressed key matches the lookup mode
  const shouldTrigger =
    (lookupMode === "ctrl" && event.ctrlKey && event.code === "ControlLeft" || event.code === "ControlRight") ||
    (lookupMode === "alt" && event.altKey && (event.code === "AltLeft" || event.code === "AltRight")) ||
    (lookupMode === "shift" && event.shiftKey && (event.code === "ShiftLeft" || event.code === "ShiftRight"));

  if (!shouldTrigger) return;

  // Prevent default behavior
  event.preventDefault();

  // Find closest popup at last mouse position
  const elementAtPoint = document.elementFromPoint(lastMousePosition.x, lastMousePosition.y);
  const closestPopup = elementAtPoint?.closest(".yomitan-popup-stack");

  console.log("Keydown instant lookup triggered at:", lastMousePosition);

  // Perform lookup at last mouse position
  await performLookup(lastMousePosition.x, lastMousePosition.y, closestPopup);
});
