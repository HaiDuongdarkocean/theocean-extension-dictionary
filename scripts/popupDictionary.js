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
const ShortcutUtils = window.ShortcutUtils;
const POPUP_SIZE_KEY = "oceanPopupSize";

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
  chrome.runtime.sendMessage({
    action: "speakLocal",
    text,
    voiceName,
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
async function findLongestWord(text, index) {
  console.log("Finding longest word in text:", text, "at index:", index);
  let lookAhead = text.substring(index, index + 50);
  console.log("Look ahead text:", lookAhead);
  let words = lookAhead.split(/\s+/);
  console.log("Split words:", words);

  for (let i = words.length; i > 0; i--) {
    // 1. Lấy cụm từ
    let phrase = words.slice(0, i).join(" ");

    // 2. Làm sạch dấu câu và đưa về chữ thường
    let cleanPhrase = phrase.replace(/[\.,!?;"\(\):]+$/, "").toLowerCase();
    console.log("Checking phrase:", cleanPhrase);
    if (cleanPhrase.length === 0) continue;

    // --- BƯỚC 2: TRA TỪ GỐC TRỰC TIẾP (Nếu từ đó là nguyên thể) ---
    // Tra chính "flies" (nếu từ điển có từ flies thì hiện luôn)
    let directResult = await getDefinitionSendMessage(cleanPhrase);
    if (directResult) return directResult;

    // --- BƯỚC 1: TRA BẢNG BẤT QUY TẮC (O(1)) ---
    if (window.irregularMap.has(cleanPhrase)) {
      const irregularInfo = window.irregularMap.get(cleanPhrase);
      console.log(
        `Phát hiện từ bất quy tắc: ${cleanPhrase} -> ${irregularInfo.root}`,
      );

      // Gửi từ gốc (root) đi tra từ điển thay vì từ hiện tại
      // Ví dụ: Tra "go" thay vì "went"
      const result = await getDefinitionSendMessage(irregularInfo.root);

      if (result) {
        // Con có thể ghép thêm thông tin ngữ pháp vào kết quả để hiển thị
        // Ví dụ: "Go (Quá khứ đơn của Go)"
        result.grammarNote = irregularInfo.desc;
        return result;
      }
    }

    // --- BƯỚC 3: TỈA TỪ CÓ QUY TẮC (Regular Lemmatization) ---
    const regularInfo = await getRegularRoot(cleanPhrase);

    if (regularInfo) {
      // Nếu tỉa được (vd: flies -> fly), tra từ gốc "fly"
      console.log(`Đang tra từ gốc suy luận: ${regularInfo.root}`);
      const rootResult = await getDefinitionSendMessage(regularInfo.root);

      if (rootResult) {
        // Thêm thông tin ngữ pháp vào kết quả hiển thị
        // Ví dụ hiển thị: "Fly (Danh từ số nhiều / Động từ ngôi 3)"
        rootResult.originalWord = cleanPhrase; // Lưu lại từ gốc người dùng chỉ vào
        rootResult.grammarTag = regularInfo.tag;

        return rootResult;
      }
    }
  }
  return null;
}

function removePopupsAbove(level) {
  while (popupStack.length > level) {
    let p = popupStack.pop();
    if (p) {
      p.remove();
      if (activePopup === p) {
        activePopup = popupStack[popupStack.length - 1] || null;
      }
    }
  }
}

function playAudioByIndex(popup, index) {
  const btn = popup.querySelector(`.yomi-audio-btn[data-index="${index}"]`);
  if (btn) btn.click();
}

async function playMultipleAudios(popup, count) {
  const fullList = popup._audioFullList || [];
  const max = Math.min(count, fullList.length);

  stopAllAudios(popup);

  for (let i = 0; i < max; i++) {
    await playAudioWithUI(popup, i);
  }
}

function renderAudioGroup(popup) {
  const container = popup.querySelector(".yomi-audio-group");
  const fullList = popup._audioFullList || [];
  const visibleCount = popup._audioVisibleCount || AudioConfig.maxDisplay;

  const visibleList = fullList.slice(0, visibleCount);

  container.innerHTML = visibleList
    .map((audio, index) => {
      const countryTag = audio.country === "United States" ? "US" : "UK";
      return `<button class="yomi-audio-btn"
              data-url="${audio.url}"
              data-index="${index}"
              title="Play audio [${getShortcutLabel("audioNext")}/${getShortcutLabel("audioPrev")}] • Select [${getShortcutLabel("audioSelect")}]">
              ${countryTag} ${index + 1}
            </button>`;
    })
    .join("");

  // Nếu còn audio chưa hiển thị
  if (visibleCount < fullList.length) {
    const remain = fullList.length - visibleCount;

    container.innerHTML += `
      <button class="yomi-load-more" title="Load more audio [${getShortcutLabel("audioNext")}]">
        +${remain}
      </button>`;
  }

  attachAudioEvents(popup);
  attachLoadMoreEvent(popup);
  applyAudioFocus(popup);
}

function attachLoadMoreEvent(popup) {
  const btn = popup.querySelector(".yomi-load-more");
  if (!btn) return;

  btn.onclick = (e) => {
    e.stopPropagation();

    popup._audioVisibleCount += 3;

    renderAudioGroup(popup);
  };
}

function attachAudioEvents(popup) {
  popup.querySelectorAll(".yomi-audio-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const index = parseInt(btn.getAttribute("data-index"));
      popup._state.focusedAudioIndex = index;
      if (popup._state.selectedAudios.has(index)) {
        popup._state.selectedAudios.delete(index);
      } else {
        popup._state.selectedAudios.add(index);
      }
      playAudioWithUI(popup, index);
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
    } catch {}
  });

  popup._currentAudios = [];
}

async function playAudioWithUI(popup, index) {
  const btn = popup.querySelector(`.yomi-audio-btn[data-index="${index}"]`);
  if (!btn) return;

  const fullList = popup._audioFullList || [];
  const item = fullList[index];
  if (!item) return;

  // 🛑 Dừng audio cũ
  stopAllAudios(popup);

  const audio = new Audio(item.url);
  popup._currentAudios = [audio];

  const originalIcon = btn.innerText;

  try {
    await audio.play();

    await new Promise((resolve) => {
      audio.onended = resolve;
    });
  } catch {}

  // 🔄 Reset icon
  btn.innerText = originalIcon;
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
    nodes[state.focusedDefIndex].scrollIntoView({ block: "nearest", behavior: "smooth" });
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
  const container = popup.querySelector(".yomi-tts-group");
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

  container.innerHTML = visibleVoices
    .map((voice, index) => {
      const label = voice.voiceName || `Voice ${index + 1}`;
      return `<button class="yomi-tts-audio-btn" type="button" data-index="${index}" title="${label} [${getShortcutLabel("ttsSentence")}]">${label}</button>`;
    })
    .join("");

  const playAllBtn = section.querySelector(".yomi-tts-play-all");
  if (playAllBtn) {
    playAllBtn.onclick = () => {
      visibleVoices.forEach((voice, idx) => {
        setTimeout(() => playTtsSentence(sentence, voice.voiceName), idx * 350);
      });
    };
  }

  container.querySelectorAll(".yomi-tts-audio-btn").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.getAttribute("data-index"));
      popup._ttsFocused = Number.isNaN(idx) ? 0 : idx;
      const voice = visibleVoices[popup._ttsFocused];
      if (voice) playTtsSentence(sentence, voice.voiceName);
    };
  });

  if (autoplayCount > 0) {
    visibleVoices.slice(0, autoplayCount).forEach((voice, idx) => {
      setTimeout(() => playTtsSentence(sentence, voice.voiceName), 260 + idx * 350);
    });
  }

  section.style.display = "";
}

function renderDefinitionBlocks(popup, data) {
  const container = popup.querySelector(".definition-container");
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
  const nodes = popup.querySelectorAll(".yomi-thumb");
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
  const nodes = popup.querySelectorAll(".yomi-audio-btn");
  nodes.forEach((node, idx) => {
    node.classList.toggle("is-focused", idx === popup._state.focusedAudioIndex);
    node.classList.toggle("is-selected", popup._state.selectedAudios.has(idx));
  });
  if (nodes[popup._state.focusedAudioIndex]) {
    nodes[popup._state.focusedAudioIndex].scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }
}

function moveAudioFocus(popup, delta) {
  const nodes = popup.querySelectorAll(".yomi-audio-btn");
  if (nodes.length === 0) return;
  let idx = popup._state.focusedAudioIndex;

  if (delta > 0) {
    if (idx < nodes.length - 1) {
      idx += 1;
    } else {
      const moreBtn = popup.querySelector(".yomi-load-more");
      if (moreBtn) moreBtn.click();
    }
  } else if (delta < 0) {
    idx = Math.max(0, idx - 1);
  }

  popup._state.focusedAudioIndex = idx;
  applyAudioFocus(popup);
  playAudioWithUI(popup, idx);
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
  const action = Object.keys(ShortcutUtils.ACTION_LABELS).find((key) => {
    const shortcut = getShortcut(key);
    return shortcut && ShortcutUtils.shortcutEquals(event, shortcut);
  });
  if (!action) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if (action === "defPrev") moveDefinitionFocus(activePopup, -1);
  if (action === "defNext") moveDefinitionFocus(activePopup, 1);
  if (action === "defToggle") toggleFocusedDefinitionSelection(activePopup);
  if (action === "imageNext") moveImageFocus(activePopup, 1);
  if (action === "imagePrev") moveImageFocus(activePopup, -1);
  if (action === "imageSelect") toggleFocusedImageSelection(activePopup);
  if (action === "audioNext") moveAudioFocus(activePopup, 1);
  if (action === "audioPrev") moveAudioFocus(activePopup, -1);
  if (action === "audioSelect") toggleFocusedAudioSelection(activePopup);
  if (action === "ttsSentence") {
    const sentenceText = activePopup._cardData?.sentence || activePopup._cardData?.term || "";
    const ttsVoices = Array.isArray(activePopup._ttsVoices) ? activePopup._ttsVoices : [];
    const focus = Number(activePopup._ttsFocused || 0);
    const voice = ttsVoices[Math.max(0, Math.min(ttsVoices.length - 1, focus))];
    playTtsSentence(sentenceText, voice?.voiceName || "");
  }
  if (action === "viewBrowser") {
    const viewBtn = activePopup.querySelector(".yomi-view-browser-btn");
    if (viewBtn) viewBtn.click();
  }
  if (action === "updateCard") {
    const updateBtn = activePopup.querySelector(".yomi-update-anki-btn");
    if (updateBtn) updateBtn.click();
  }
  if (action === "addToAnki") {
    const payload = buildAnkiPayload(activePopup._cardData || {}, activePopup);
    addNoteToAnki(payload, activePopup);
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
        alert("😵 Không kết nối được Anki");
        return;
      }

      const addBtn = popup?.querySelector(".yomi-add-anki-btn");
      if (response.duplicate) {
        if (addBtn) {
          addBtn.textContent = "Added";
          addBtn.disabled = true;
          ensureUpdateButton(popup, () => updateExistingAnkiCard(dataOfCard, response.noteIds?.[0], popup));
        }
        if (uiCfg.showBrowserButton !== false) {
          showBrowserButton(popup, response.noteIds, false, "Already added in Anki");
        }
        return;
      }

      if (response.success) {
        if (uiCfg.showBrowserButton !== false) {
          if (addBtn) {
            addBtn.textContent = "View Browser";
            addBtn.onclick = () => showBrowserButton(popup, response.noteIds, true, "");
          }
          showBrowserButton(popup, response.noteIds, false, "");
        } else {
          alert("✅ Đã thêm vào Anki!");
        }
      } else {
        alert("😵 Lỗi: " + response.error);
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
    const header = popup.querySelector(".yomi-header > div");
    if (header) header.appendChild(viewBtn);
  }
  viewBtn.title = message ? `${message} [${getShortcutLabel("viewBrowser")}]` : `View Browser [${getShortcutLabel("viewBrowser")}]`;
  viewBtn.onclick = () => {
    chrome.runtime.sendMessage(
      { action: "openAnkiBrowser", query },
      () => {},
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
    const header = popup.querySelector(".yomi-header > div");
    if (header) header.appendChild(btn);
  }
  btn.title = `Update card [${getShortcutLabel("updateCard")}]`;
  btn.onclick = handler;
  btn.disabled = false;
}

function updateExistingAnkiCard(extensionData, noteId, popup) {
  if (!noteId) return;
  chrome.runtime.sendMessage(
    { action: "updateAnkiNote", noteId, data: extensionData },
    (res) => {
      if (!res || !res.success) {
        alert("Không cập nhật được card.");
      } else {
        const addBtn = popup?.querySelector(".yomi-add-anki-btn");
        if (addBtn) {
          addBtn.textContent = "Updated";
          addBtn.disabled = true;
        }
      }
    },
  );
}

async function showPopup(x, y, data, level) {
  console.log("showPopup called with:", { x, y, data, level });
  removePopupsAbove(level - 1);

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

  // 1. Tạo KHUNG XƯƠNG (Placeholder) - Không dùng biến audioButtonsHTML ở đây
  const showSentence = data._showSentence !== false;
  const showTranslation = data._showTranslation !== false;
  const showImages = data._imagesEnabled !== false;
  const sentenceHTML = showSentence
    ? `<div class="yomi-sentence-container" style="padding: 10px 16px; font-style: italic; font-size: 13px; color: #555; border-top: 1px solid #eee;">
          <div>${data.sentence || ""}</div>
          ${showTranslation && data.sentenceTranslation ? `<div style="color: #666; margin-top: 4px;">${data.sentenceTranslation}</div>` : ""}
        </div>`
    : "";

  const savedSize = await loadPopupSize();

  newPopup.innerHTML = `
        <div class="yomi-header">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                <div>
                  <div class="popup-ipa-line">/${data.pronunciation || "n/a"}/</div>
                  <span class="popup-term-title">${data.term}</span>
                </div>
                <button class="yomi-add-anki-btn" title="Add to Anki [${getShortcutLabel("addToAnki")}]" type="button">Add Anki</button>
            </div>
            
            ${data.originalWord ? `<div class="yomi-origin-note">(Gốc của: <span>${data.originalWord}</span>)</div>` : ""}

            <div class="yomi-pronunciation yomi-pronunciation-container" style="display: flex; align-items: center; margin-top: 5px; color: var(--yomi-primary)">
                <div class="yomi-audio-group">
                    <span style="opacity: 0.5">Audio pending...</span>
                </div>
            </div>
        </div>

        ${
          showImages
            ? `<div class="yomi-image-section" style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
          <div class="yomi-image-gallery">
            </div>
          <div class="yomi-image-controls">
            <button class="yomi-load-more-img" style="display: none;" title="Load more images [${getShortcutLabel("imageNext")}]">More images</button>
          </div>
        </div>`
            : ""
        }

        ${sentenceHTML}
        <div class="yomi-tts-section" style="padding: 8px 16px; border-top: 1px solid var(--yomi-border); display:none;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:11px; color: var(--yomi-text-sub);">TTS sentence</span>
            <button class="yomi-tts-play-all" type="button">Play all audios</button>
          </div>
          <div class="yomi-tts-group"></div>
        </div>


        <div class="definition-container">
            <div class="yomi-definition-loading">Loading definitions...</div>
        </div>

        <div style="padding: 6px 16px; background: var(--yomi-surface); font-size: 10px; color: var(--yomi-text-sub); display: flex; justify-content: space-between; border-top: 1px solid var(--yomi-border);">
            <span>Level ${level}</span>
        </div>
        <div class="yomi-resizer"></div>
    `;

  const targetContainer = document.fullscreenElement || document.body;
  targetContainer.appendChild(newPopup);

  if (savedSize?.width) newPopup.style.width = `${savedSize.width}px`;
  if (savedSize?.height) newPopup.style.height = `${savedSize.height}px`;

  const userCfgRes = await fetchUserConfig();
  const popupCfg = userCfgRes?.config || {};
  renderPopupTtsGroup(newPopup, data.sentence || "", popupCfg.tts || {});

  // Gắn sự kiện Add to Anki
  const addBtn = newPopup.querySelector(".yomi-add-anki-btn");

  if (addBtn) {
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const payload = buildAnkiPayload(data, newPopup);
      addNoteToAnki(payload, newPopup);
    });
  }

  renderDefinitionBlocks(newPopup, data);

  // 4. ĐI LẤY DỮ LIỆU THẬT (Bất đồng bộ)
  const audioContainer = newPopup.querySelector(".yomi-audio-group");

  function loadForvoAudio() {
    audioContainer.innerHTML = `<span style="font-size:10px; color:#999;">Loading...</span>`;

    fetchAudioFromForvo(data.term).then((realData) => {
      const processed = processAudioList(realData);

      if (processed.fullList && processed.fullList.length > 0) {
        newPopup._audioFullList = processed.fullList;

        data.audio = newPopup._audioFullList?.[0]?.url;

        newPopup._audioVisibleCount = AudioConfig.maxDisplay;
        renderAudioGroup(newPopup);

        const autoCount = Math.min(
          AudioConfig.autoPlayCount || 0,
          newPopup._audioVisibleCount || 0,
          newPopup._audioFullList.length || 0,
        );
        if (autoCount > 0) {
          setTimeout(() => {
            playMultipleAudios(newPopup, autoCount);
          }, 300);
        }
      } else {
        audioContainer.innerHTML = `<span style="font-size:10px; color:#ccc;">No audio</span>`;
      }
    });
  }

  if (!AudioConfig.forvoEnabled) {
    audioContainer.innerHTML = "";
    newPopup._audioFullList = [];
    newPopup._audioVisibleCount = 0;
  } else if (AudioConfig.forvoMode === "manual") {
    audioContainer.innerHTML = `<button class="yomi-forvo-load" style="border:1px solid #ddd;background:transparent;border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer;" title="Load audio [${getShortcutLabel("audioNext")}]">Load audio</button>`;
    const btn = audioContainer.querySelector(".yomi-forvo-load");
    if (btn) {
      btn.onclick = (e) => {
        e.stopPropagation();
        loadForvoAudio();
      };
    }
  } else {
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
  if (showImages) {
    let allImageUrls = [];
    let visibleImageCount = 0;
    const gallery = newPopup.querySelector(".yomi-image-gallery");
    const loadMoreBtn = newPopup.querySelector(".yomi-load-more-img");
    newPopup._allImageUrls = [];

    function reindexImages() {
      gallery.querySelectorAll(".yomi-thumb").forEach((img, idx) => {
        img.setAttribute("data-image-index", String(idx));
      });
    }

    function renderImages() {
      const nextBatch = allImageUrls.slice(
        visibleImageCount,
        visibleImageCount + 3,
      );
      nextBatch.forEach((url) => {
        const img = document.createElement("img");
        img.src = url;
        img.className = "yomi-thumb";
        img.title = `Image [${getShortcutLabel("imageNext")}/${getShortcutLabel("imagePrev")}] • Select [${getShortcutLabel("imageSelect")}]`;
        img.onerror = () => {
          allImageUrls = allImageUrls.filter((candidate) => candidate !== url);
          newPopup._allImageUrls = allImageUrls.slice();
          img.remove();
          visibleImageCount = Math.min(visibleImageCount, allImageUrls.length);
          reindexImages();
          applyImageFocus(newPopup);
        };

        // Sự kiện khi nhấn chọn ảnh
        img.onclick = () => {
          const index = Number(img.getAttribute("data-image-index"));
          newPopup._state.focusedImageIndex = index;
          toggleFocusedImageSelection(newPopup);
        };

        gallery.appendChild(img);
      });

      visibleImageCount += nextBatch.length;
      newPopup._allImageUrls = allImageUrls.slice();
      reindexImages();

      // Hiện/Ẩn nút "Xem thêm"
      if (visibleImageCount < allImageUrls.length) {
        const remaining = allImageUrls.length - visibleImageCount;
        loadMoreBtn.innerText = `More images (+${remaining})`;
        loadMoreBtn.style.display = "inline-flex";
      } else {
        loadMoreBtn.style.display = "none";
      }

      applyImageFocus(newPopup);
    }

    // Gọi lấy dữ liệu
    runtimeMessageWithTimeout({ action: "fetchImages", term: data.term }, 5000)
      .then((res) => {
        if (res && res.success && Array.isArray(res.urls) && res.urls.length > 0) {
          allImageUrls = res.urls.slice();
          renderImages(); // Hiện 3 cái đầu
        } else {
          gallery.innerHTML = "";
          loadMoreBtn.style.display = "none";
        }
      })
      .catch(() => {
        gallery.innerHTML = "";
        loadMoreBtn.style.display = "none";
      });

    loadMoreBtn.onclick = () => renderImages();
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

document.addEventListener("mousemove", (event) => {
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
        removePopupsAbove(0);
        globalCloseTimer = null;
      }, 150);
    }
  }

  // 2. QUẢN LÝ TRA TỪ (Lookup)
  clearTimeout(lookupTimer);
  lookupTimer = setTimeout(async () => {
    if (!isLookupTriggered(event)) return;
    let range = null;
    if (typeof document.caretRangeFromPoint === "function") {
      range = document.caretRangeFromPoint(event.clientX, event.clientY);
    } else if (typeof document.caretPositionFromPoint === "function") {
      const pos = document.caretPositionFromPoint(event.clientX, event.clientY);
      if (pos && pos.offsetNode) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }

    // DÒNG KIỂM TRA ĐÂY:
    if (range) {
      console.log("popupDictionary.js::Range:", range);
      console.log("Mouse đang chạm vào:", range.startContainer);
    } else {
      console.log("Range trả về NULL tại:", event.clientX, event.clientY);
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
      event.clientX >= rect.left - padding &&
      event.clientX <= rect.right + padding &&
      event.clientY >= rect.top - padding &&
      event.clientY <= rect.bottom + padding;

    // LOG ĐỂ KIỂM TRA: Nếu con thấy log này mà không thấy popup, nghĩa là padding vẫn hẹp
    if (!isOverText) {
      console.log("Chuột ở quá xa chữ:", event.clientX, rect.left); // Bật lên khi cần debug
      return;
    }

    const blockText = extractBlockTextFromRange(range);
    console.log("Block text:", blockText);
    const sentence = extractFinalSentence(range);
    console.log("Extracted sentence:", sentence);
    if (!sentence | (sentence.trim() == "")) return;
    // 1️⃣ Offset trong blockText
    const textNode = range.startContainer;
    const nodeText = textNode.textContent;

    const nodeStartIndex = blockText.indexOf(nodeText);
    if (nodeStartIndex === -1) return;

    let absoluteOffset = nodeStartIndex + range.startOffset;

    // 2️⃣ Tìm sentence start trong blockText
    const sentenceStartIndex = blockText.indexOf(sentence);
    if (sentenceStartIndex === -1) return;

    // 3️⃣ Offset trong sentence
    let relativeOffset = absoluteOffset - sentenceStartIndex;

    // 4️⃣ Bây giờ mới tìm đầu từ
    while (
      relativeOffset > 0 &&
      /[^\s\(\"\'\[\{\n]/.test(sentence[relativeOffset - 1])
    ) {
      relativeOffset--;
    }

    const infoOfSentenceAndWord = await findLongestWord(
      sentence,
      relativeOffset,
    );
    if (!infoOfSentenceAndWord) return;
    infoOfSentenceAndWord.sentence = sentence; // Lưu lại câu để hiển thị trong popup. phục vụ cho anki.
    console.log(
      "popupDictionary.js::infoOfSentenceAndWord:",
      infoOfSentenceAndWord,
    );

    console.log(
      "Word candidate:",
      sentence.substring(relativeOffset, relativeOffset + 20),
    );
    console.log("Calculated word relativeOffset:", relativeOffset);

    // --- ĐOẠN THÊM MỚI: DỊCH CÂU ---
    // 1. Load config để xem user có bật "enableTranslate" không
    const config = await new Promise((resolve) => {
      chrome.storage.sync.get(["userConfig"], (res) =>
        resolve(res.userConfig || {}),
      );
    });
    const showSentence = config.sentence?.showSentence !== false;
    const showTranslation = config.sentence?.showTranslation !== false;
    infoOfSentenceAndWord._showSentence = showSentence;
    infoOfSentenceAndWord._showTranslation = showTranslation;
    infoOfSentenceAndWord._imagesEnabled = config.image?.enabled !== false;

    if (showTranslation && config.translateEnabled && sentence) {
      // Gửi tin nhắn nhờ Background dịch hộ
      const translationResult = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: "translateSentence", text: sentence },
          resolve,
        );
      });

      if (translationResult && translationResult.success) {
        // Lưu bản dịch vào object để tý nữa hiển thị và lưu Anki
        infoOfSentenceAndWord.sentenceTranslation = translationResult.text;
      } else {
        infoOfSentenceAndWord.sentenceTranslation = "Xảy ra lỗi dịch";
      }
    }
    // ------------------------------

    // KIỂM TRA TRÙNG TỪ
    const isAlreadyShown = popupStack.some(
      (p) =>
        p.querySelector(".popup-term-title").innerText.trim().toLowerCase() ===
        infoOfSentenceAndWord.term.toLowerCase(),
    );
    if (isAlreadyShown) return;

    // Khi tìm thấy từ mới, hủy lệnh xóa để "Tiến lên" cấp cao hơn
    clearTimeout(globalCloseTimer);
    globalCloseTimer = null;

    let level = closestPopup ? parseInt(closestPopup.dataset.level) + 1 : 1;

    showPopup(event.clientX, event.clientY, infoOfSentenceAndWord, level);
  }, 150);
});
