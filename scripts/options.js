/**
 * options.js
 * Quản lý toàn bộ giao diện cài đặt của Yomitan Pro
 */
import { getConfig, saveConfig } from "./configManager.js";
import { TTSModule } from "./ttsModule.js";
import {
  loadAnkiConfig,
  saveAnkiConfig,
  getDeckNames,
  getModelNames,
  getModelFieldNames,
} from "./ankiSettings.js";
import { importFile } from "./importManager.js";
import {
  listResources,
  putResource,
  deleteResource,
  clearResourceData,
  lookupTermWithFreq,
} from "./storage.js";

// --- 1. KHỞI TẠO CÁC BIẾN CẤU CẤU HÌNH MẶC ĐỊNH ---
const EXTENSION_FIELDS = [
  "Target word",
  "Definition",
  "Sentence",
  "Sentence translation",
  "Images",
  "Word audio",
  "Sentence audio",
];
const ShortcutUtils = window.ShortcutUtils;

// --- 2. QUẢN LÝ TABS (SIDEBAR) ---
function initTabs() {
  const buttons = document.querySelectorAll(".nav__btn");
  const panels = document.querySelectorAll(".panel");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("is-active"));
      panels.forEach((p) => p.classList.remove("is-active"));

      btn.classList.add("is-active");
      const panelId = btn.getAttribute("data-panel");
      document.getElementById(panelId).classList.add("is-active");
    });
  });
}

// --- 3. QUẢN LÝ ANKI PANEL ---
async function setupAnkiPanel() {
  const ankiStatus = document.getElementById("ankiStatus");
  try {
    // Lấy dữ liệu từ Anki Connect
    const [decks, models] = await Promise.all([
      getDeckNames(),
      getModelNames(),
    ]);

    const deckSelect = document.getElementById("deckSelect");
    const modelSelect = document.getElementById("modelSelect");

    // Đổ dữ liệu vào Select
    deckSelect.innerHTML = decks
      .map((d) => `<option value="${d}">${d}</option>`)
      .join("");
    modelSelect.innerHTML = models
      .map((m) => `<option value="${m}">${m}</option>`)
      .join("");

    // Load cài đặt đã lưu
    const savedAnki = await loadAnkiConfig();
    deckSelect.value = savedAnki.deckName || "";
    modelSelect.value = savedAnki.modelName || "";
    document.getElementById("tagsInput").value = (savedAnki.tags || []).join(
      ",",
    );
    const allowDuplicateToggle = document.getElementById(
      "allowDuplicateToggle",
    );
    if (allowDuplicateToggle)
      allowDuplicateToggle.checked = savedAnki.allowDuplicate !== false;
    const showBrowserBtnToggle = document.getElementById(
      "showBrowserBtnToggle",
    );
    if (showBrowserBtnToggle)
      showBrowserBtnToggle.checked = savedAnki.showBrowserButton !== false;

    // Hiển thị bảng Mapping nếu đã chọn Model
    if (savedAnki.modelName) {
      const fields = await getModelFieldNames(savedAnki.modelName);
      renderFieldMappingTable(fields, savedAnki.fieldMapping || {});
    }

    // Sự kiện khi thay đổi Model thì phải load lại danh sách field của Model đó
    modelSelect.onchange = async (e) => {
      const fields = await getModelFieldNames(e.target.value);
      const autoMapping = autoMapFields(fields);
      renderFieldMappingTable(fields, autoMapping);
    };

    ankiStatus.innerText = "💚 Kết nối Anki thành công";
  } catch (err) {
    console.error("Anki Error:", err);
    ankiStatus.innerHTML =
      "<b style='color:red'>😵 Không kết nối được Anki. Hãy mở Anki Desktop và bật AnkiConnect.</b>";
  }
}

function renderFieldMappingTable(modelFields, savedMapping) {
  const container = document.getElementById("fieldMappingContainer");
  container.innerHTML = "<h4>Mapping Fields:</h4>";

  EXTENSION_FIELDS.forEach((extField) => {
    const row = document.createElement("div");
    row.className = "row";
    row.style.marginBottom = "10px";

    const label = document.createElement("label");
    label.innerText = extField;
    label.style.width = "160px";
    label.style.display = "inline-block";

    const select = document.createElement("select");
    select.dataset.extField = extField;
    select.innerHTML =
      `<option value="">-- Bỏ qua (Ignore) --</option>` +
      modelFields
        .map(
          (mf) =>
            `<option value="${mf}" ${savedMapping[extField] === mf ? "selected" : ""}>${mf}</option>`,
        )
        .join("");

    row.appendChild(label);
    row.appendChild(select);
    container.appendChild(row);
  });
}

// Auto-mapping function: match extension fields to Anki model fields
function autoMapFields(modelFields) {
  const mapping = {};
  
  // Mapping rules: extension field -> possible Anki field names (case-insensitive)
  const mappingRules = {
    "Target word": ["word", "target", "target word", "front", "expression", "vocabulary", "term"],
    "Definition": ["definition", "meaning", "back", "translation", "gloss"],
    "Sentence": ["sentence", "example", "context", "example sentence"],
    "Sentence translation": ["sentence translation", "translation", "sentence meaning", "example translation"],
    "Images": ["image", "images", "picture", "pictures", "photo"],
    "Word audio": ["word audio", "audio", "pronunciation", "sound", "word sound"],
    "Sentence audio": ["sentence audio", "example audio", "sentence sound"]
  };
  
  EXTENSION_FIELDS.forEach(extField => {
    const rules = mappingRules[extField] || [];
    
    // Try exact match first (case-insensitive)
    for (const rule of rules) {
      const match = modelFields.find(mf => mf.toLowerCase() === rule.toLowerCase());
      if (match) {
        mapping[extField] = match;
        return;
      }
    }
    
    // Try partial match (contains)
    for (const rule of rules) {
      const match = modelFields.find(mf => 
        mf.toLowerCase().includes(rule.toLowerCase()) || 
        rule.toLowerCase().includes(mf.toLowerCase())
      );
      if (match) {
        mapping[extField] = match;
        return;
      }
    }
  });
  
  return mapping;
}

// --- 4. QUẢN LÝ AUDIO & TTS PANEL ---
async function setupAudioPanel() {
  const config = await getConfig();
  const voices = await TTSModule.getAvailableVoices();

  document.getElementById("ttsEnabled").checked = config.tts?.enabled || false;
  document.getElementById("ttsMaxDisplay").value = String(
    config.tts?.maxDisplay || 1,
  );
  document.getElementById("ttsAutoplayCount").value = String(
    config.tts?.autoplayCount ?? 0,
  );

  document.getElementById("forvoEnabled").checked =
    config.forvo?.enabled ?? true;
  document.getElementById("forvoMode").value = config.forvo?.mode || "auto";
  document.getElementById("forvoMaxDisplay").value = String(
    config.forvo?.maxDisplay || 3,
  );
  document.getElementById("forvoAutoplayCount").value = String(
    config.forvo?.autoplayCount ?? 1,
  );
  const autoplayOnNavigateToggle = document.getElementById(
    "forvoAutoplayOnNavigate",
  );
  if (autoplayOnNavigateToggle)
    autoplayOnNavigateToggle.checked =
      config.forvo?.autoplayOnNavigate === true;

  const savedVoices = Array.isArray(config.tts?.savedVoices)
    ? config.tts.savedVoices
    : [];
  const savedVoiceMap = new Map(
    savedVoices.map((v, idx) => [
      v.voiceName,
      { ...v, order: Number(v.order) || idx + 1 },
    ]),
  );

  const alphabeticalVoices = voices
    .slice()
    .sort((a, b) => (a.voiceName || "").localeCompare(b.voiceName || ""));

  // Voice options for TTS slots should prioritize saved list.
  let voiceOptionsForSlots = (() => {
    const selected = alphabeticalVoices.filter((v) =>
      savedVoiceMap.has(v.voiceName),
    );
    return selected.length > 0 ? selected : alphabeticalVoices;
  })();

  // Get current voice selections from config
  const currentVoices = [
    config.tts?.voices?.[0] || "",
    config.tts?.voices?.[1] || "",
    config.tts?.voices?.[2] || ""
  ];

  const voiceSelectionEl = document.getElementById("ttsVoiceSelection");
  const audioSaveStatusEl = document.getElementById("audioSaveStatus");

  function renderVoiceSelection() {
    if (!voiceSelectionEl) return;
    
    if (voiceOptionsForSlots.length === 0) {
      voiceSelectionEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No voices available. Save voices in TTS Tester first.</div>';
      return;
    }

    voiceSelectionEl.innerHTML = voiceOptionsForSlots
      .map((v, idx) => {
        const slotIndex = currentVoices.indexOf(v.voiceName);
        const isSlot1 = slotIndex === 0;
        const isSlot2 = slotIndex === 1;
        const isSlot3 = slotIndex === 2;
        
        return `
          <div class="voice-selection-item">
            <button class="btn voice-play-btn" type="button" data-play-voice="${v.voiceName}">Play</button>
            <div class="voice-selection-slots">
              <label title="Voice 1">
                <input type="radio" name="voice-slot-1" value="${v.voiceName}" ${isSlot1 ? "checked" : ""}>
                <span>1</span>
              </label>
              <label title="Voice 2">
                <input type="radio" name="voice-slot-2" value="${v.voiceName}" ${isSlot2 ? "checked" : ""}>
                <span>2</span>
              </label>
              <label title="Voice 3">
                <input type="radio" name="voice-slot-3" value="${v.voiceName}" ${isSlot3 ? "checked" : ""}>
                <span>3</span>
              </label>
            </div>
            <div class="voice-selection-info">
              <span class="voice-selection-name">${v.voiceName}</span>
              <span class="voice-selection-lang">${v.lang}</span>
            </div>
          </div>
        `;
      })
      .join("");

    // Add event listeners for play buttons
    voiceSelectionEl.querySelectorAll(".voice-play-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const voiceName = btn.getAttribute("data-play-voice");
        const text = textInput?.value?.trim() || "Hello, this is a test.";
        await new Promise((resolve) => {
          chrome.tts.speak(text, {
            voiceName: voiceName,
            onEvent: (e) => {
              if (e.type === "end" || e.type === "error") resolve();
            },
          });
        });
      });
    });

    // Add event listeners for radio buttons
    voiceSelectionEl.querySelectorAll("input[type='radio']").forEach(radio => {
      radio.addEventListener("change", async () => {
        if (!radio.checked) return;
        
        // Get all selected voices
        const voice1 = document.querySelector("input[name='voice-slot-1']:checked")?.value || "";
        const voice2 = document.querySelector("input[name='voice-slot-2']:checked")?.value || "";
        const voice3 = document.querySelector("input[name='voice-slot-3']:checked")?.value || "";
        
        // Update config
        const current = await getConfig();
        const next = {
          ...current,
          tts: {
            ...(current.tts || {}),
            voices: [voice1, voice2, voice3].filter(v => v)
          },
        };
        await saveConfig(next);
        
        // Update current selections
        currentVoices[0] = voice1;
        currentVoices[1] = voice2;
        currentVoices[2] = voice3;
        
        if (audioSaveStatusEl) {
          audioSaveStatusEl.textContent = "Saved";
          audioSaveStatusEl.style.color = "green";
          setTimeout(() => {
            audioSaveStatusEl.textContent = "";
          }, 2000);
        }
      });
    });
  }

  renderVoiceSelection();

  const voiceListEl = document.getElementById("ttsVoiceList");
  const clearBtn = document.getElementById("ttsClearSelection");
  const playBtn = document.getElementById("ttsPlayBtn");
  const saveListBtn = document.getElementById("ttsSaveVoiceListBtn");
  const downloadEachBtn = document.getElementById("ttsDownloadEachBtn");
  const downloadZipBtn = document.getElementById("ttsDownloadZipBtn");
  const statusEl = document.getElementById("ttsTestStatus");
  const textInput = document.getElementById("ttsTestText");
  const countryFilter = document.getElementById("ttsCountryFilter");

  let testerVoices = alphabeticalVoices.map((voice, index) => {
    const saved = savedVoiceMap.get(voice.voiceName);
    return {
      voiceName: voice.voiceName,
      lang: voice.lang || "en-US",
      gender: voice.gender || "",
      selected: !!saved,
      order: saved ? saved.order : index + 1,
    };
  });

  // Extract unique countries from voices
  const countries = new Set();
  testerVoices.forEach(v => {
    const country = v.lang.split('-')[0]; // Extract language code (e.g., "en" from "en-US")
    countries.add(country);
  });

  // Populate country filter dropdown
  if (countryFilter) {
    const sortedCountries = Array.from(countries).sort();
    countryFilter.innerHTML = '<option value="">All countries</option>' +
      sortedCountries.map(country => {
        const countryName = getCountryName(country);
        return `<option value="${country}">${countryName} (${country})</option>`;
      }).join('');
  }

  let currentCountryFilter = "";

  function getCountryName(code) {
    const names = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'nl': 'Dutch',
      'pl': 'Polish',
      'tr': 'Turkish',
      'vi': 'Vietnamese',
      'th': 'Thai',
      'id': 'Indonesian',
      'sv': 'Swedish',
      'da': 'Danish',
      'no': 'Norwegian',
      'fi': 'Finnish',
      'cs': 'Czech',
      'el': 'Greek',
      'he': 'Hebrew',
      'hu': 'Hungarian',
      'ro': 'Romanian',
      'sk': 'Slovak',
      'uk': 'Ukrainian',
      'bg': 'Bulgarian',
      'hr': 'Croatian',
      'sr': 'Serbian',
      'ca': 'Catalan',
      'af': 'Afrikaans',
      'bn': 'Bengali',
      'ta': 'Tamil',
      'te': 'Telugu',
      'ml': 'Malayalam',
      'kn': 'Kannada',
      'mr': 'Marathi',
      'gu': 'Gujarati',
      'pa': 'Punjabi',
      'ur': 'Urdu',
      'fa': 'Persian',
      'ms': 'Malay',
      'fil': 'Filipino',
      'sw': 'Swahili',
      'am': 'Amharic',
      'my': 'Burmese',
      'km': 'Khmer',
      'lo': 'Lao',
      'si': 'Sinhala',
      'ne': 'Nepali'
    };
    return names[code] || code.toUpperCase();
  }

  function normalizeOrders() {
    testerVoices = testerVoices
      .slice()
      .sort(
        (a, b) => a.order - b.order || a.voiceName.localeCompare(b.voiceName),
      )
      .map((item, idx) => ({ ...item, order: idx + 1 }));
  }

  function getFilteredVoices() {
    if (!currentCountryFilter) return testerVoices;
    return testerVoices.filter(v => v.lang.startsWith(currentCountryFilter + '-') || v.lang === currentCountryFilter);
  }

  function renderTesterVoices() {
    if (!voiceListEl) return;
    normalizeOrders();
    const filteredVoices = getFilteredVoices();
    
    voiceListEl.innerHTML = filteredVoices
      .map(
        (v) => `
        <div class="voice-item" draggable="true" data-voice="${v.voiceName}">
        <span class="voice-drag" title="Drag to reorder">Drag</span>
          <input class="voice-order" type="number" min="1" value="${v.order}" data-order-voice="${v.voiceName}">
          <button class="btn voice-play-btn" type="button" data-play-voice="${v.voiceName}">Play</button>
            <label>
              <input type="checkbox" class="tts-voice-checkbox" data-voice="${v.voiceName}" ${v.selected ? "checked" : ""}>
              <span class="voice-meta">${v.lang}${v.gender ? " • " + v.gender : ""}</span>
              <span>${v.voiceName}</span>
            </label>
          </div>
        `,
      )
      .join("");
    
    if (filteredVoices.length === 0) {
      voiceListEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No voices found for this country</div>';
    }
    
    updateSelectionCount();
    bindVoiceDragDrop();
  }

  function getSelectedVoices() {
    const selected = testerVoices
      .filter((v) => v.selected)
      .slice()
      .sort((a, b) => a.order - b.order);
    return selected.length > 0 ? selected : testerVoices.slice(0, 1);
  }

  const updateSelectionCount = () => {
    const checked = testerVoices.filter((v) => v.selected).length;
    if (clearBtn) clearBtn.textContent = `Delete selection (${checked})`;
  };

  // Country filter change handler
  if (countryFilter) {
    countryFilter.addEventListener('change', (e) => {
      currentCountryFilter = e.target.value;
      renderTesterVoices();
    });
  }

  voiceListEl?.addEventListener("change", (event) => {
    const checkbox = event.target.closest(".tts-voice-checkbox");
    if (checkbox) {
      const voiceName = checkbox.getAttribute("data-voice");
      testerVoices = testerVoices.map((v) =>
        v.voiceName === voiceName ? { ...v, selected: checkbox.checked } : v,
      );
      updateSelectionCount();
      return;
    }
    const orderInput = event.target.closest(".voice-order");
    if (orderInput) {
      const voiceName = orderInput.getAttribute("data-order-voice");
      const newOrder = Number.parseInt(orderInput.value, 10);
      if (!Number.isNaN(newOrder)) {
        testerVoices = testerVoices.map((v) =>
          v.voiceName === voiceName ? { ...v, order: newOrder } : v,
        );
        renderTesterVoices();
      }
    }
  });

  voiceListEl?.addEventListener("click", async (event) => {
    const playBtnEl = event.target.closest(".voice-play-btn");
    if (!playBtnEl) return;
    const voiceName = playBtnEl.getAttribute("data-play-voice");
    const text = textInput?.value?.trim();
    if (!text) {
      if (statusEl) statusEl.textContent = "Enter text first";
      return;
    }
    await new Promise((resolve) => {
      chrome.tts.speak(text, {
        voiceName: voiceName || undefined,
        onEvent: (e) => {
          if (e.type === "end" || e.type === "error") resolve();
        },
      });
    });
  });

  clearBtn?.addEventListener("click", () => {
    testerVoices = testerVoices.map((v) => ({ ...v, selected: false }));
    renderTesterVoices();
    updateSelectionCount();
  });

  function bindVoiceDragDrop() {
    if (!voiceListEl) return;
    let draggingVoice = null;
    voiceListEl.querySelectorAll(".voice-item").forEach((item) => {
      item.addEventListener("dragstart", () => {
        draggingVoice = item.getAttribute("data-voice");
        item.classList.add("is-dragging");
      });
      item.addEventListener("dragend", () => {
        item.classList.remove("is-dragging");
      });
      item.addEventListener("dragover", (e) => e.preventDefault());
      item.addEventListener("drop", (e) => {
        e.preventDefault();
        const targetVoice = item.getAttribute("data-voice");
        if (!draggingVoice || !targetVoice || draggingVoice === targetVoice)
          return;
        const fromIdx = testerVoices.findIndex(
          (v) => v.voiceName === draggingVoice,
        );
        const toIdx = testerVoices.findIndex(
          (v) => v.voiceName === targetVoice,
        );
        if (fromIdx < 0 || toIdx < 0) return;
        const copy = testerVoices.slice();
        const [moved] = copy.splice(fromIdx, 1);
        copy.splice(toIdx, 0, moved);
        testerVoices = copy.map((v, idx) => ({ ...v, order: idx + 1 }));
        renderTesterVoices();
      });
    });
  }

  async function speakVoices(sequenceOnly) {
    const text = textInput?.value?.trim();
    if (!text) {
      if (statusEl) statusEl.textContent = "Enter text first";
      return;
    }
    const list = getSelectedVoices();
    for (const v of list) {
      await new Promise((resolve) => {
        chrome.tts.speak(text, {
          voiceName: v.voiceName || undefined,
          onEvent: (e) => {
            if (e.type === "end" || e.type === "error") resolve();
          },
        });
      });
    }
    if (statusEl)
      statusEl.textContent = sequenceOnly ? "Played selected voices" : "";
  }

  playBtn?.addEventListener("click", () => speakVoices(true));

  async function buildTtsUrl(text, lang) {
    return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      text,
    )}&tl=${encodeURIComponent(lang || "en-US")}&client=tw-ob`;
  }

  async function fetchWithTimeout(url, timeoutMs = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  saveListBtn?.addEventListener("click", async () => {
    const current = await getConfig();
    const selected = getSelectedVoices().map((v, idx) => ({
      voiceName: v.voiceName,
      lang: v.lang,
      order: idx + 1,
    }));
    const next = {
      ...current,
      tts: {
        ...(current.tts || {}),
        savedVoices: selected,
      },
    };
    await saveConfig(next);
    
    // Update voiceOptionsForSlots with new saved voices
    voiceOptionsForSlots = alphabeticalVoices.filter((v) =>
      selected.some(s => s.voiceName === v.voiceName)
    );
    
    // Re-render voice selection list
    renderVoiceSelection();
    
    if (statusEl) {
      statusEl.textContent = `Saved ${selected.length} voices`;
      statusEl.style.color = "green";
    }
  });

  downloadEachBtn?.addEventListener("click", async () => {
    const text = textInput?.value?.trim();
    if (!text) {
      if (statusEl) statusEl.textContent = "Enter text first";
      return;
    }
    const list = getSelectedVoices();
    for (const [idx, v] of list.entries()) {
      const url = await buildTtsUrl(text, v.lang);
      const res = await fetchWithTimeout(url, 5000);
      if (!res.ok) continue;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tts_${(v.voiceName || v.lang || "voice").replace(/[^a-z0-9_-]/gi, "_")}_${idx + 1}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      await new Promise((r) => setTimeout(r, 150));
    }
    if (statusEl) statusEl.textContent = "Downloaded files";
  });

  downloadZipBtn?.addEventListener("click", async () => {
    const text = textInput?.value?.trim();
    if (!text) {
      if (statusEl) statusEl.textContent = "Enter text first";
      return;
    }
    const list = getSelectedVoices();
    if (!window.JSZip) {
      statusEl.textContent = "JSZip not loaded";
      statusEl.style.color = "red";
      return;
    }
    statusEl.textContent = "Building zip...";
    const zip = new JSZip();
    for (const [idx, v] of list.entries()) {
      const url = await buildTtsUrl(text, v.lang);
      const res = await fetchWithTimeout(url, 5000);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const fname = `tts_${(v.voiceName || v.lang || "voice").replace(/[^a-z0-9_-]/gi, "_")}_${idx + 1}.mp3`;
      zip.file(fname, buf);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tts_voices.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    statusEl.textContent = "Zip downloaded";
  });

  renderTesterVoices();
}

async function setupDictionaryPanel() {
  const config = await getConfig();
  const lookupModeSelect = document.getElementById("lookupMode");
  if (lookupModeSelect) {
    lookupModeSelect.value = config.lookupMode || "hover";
  }
  const resultModeSelect = document.getElementById("lookupResultMode");
  if (resultModeSelect) {
    resultModeSelect.value = config.lookupResultMode || "stacked";
  }
  const popupDefaultFeatureSelect = document.getElementById(
    "popupDefaultFeature",
  );
  if (popupDefaultFeatureSelect) {
    popupDefaultFeatureSelect.value = config.popup?.defaultFeature || "forvo";
  }
}

async function setupSentencePanel() {
  const config = await getConfig();
  document
    .getElementById("showSentenceToggle")
    ?.setAttribute(
      "checked",
      config.sentence?.showSentence !== false ? "checked" : "",
    );
  const sentenceCheckbox = document.getElementById("showSentenceToggle");
  if (sentenceCheckbox)
    sentenceCheckbox.checked = config.sentence?.showSentence !== false;

  const translationCheckbox = document.getElementById(
    "showSentenceTranslationToggle",
  );
  if (translationCheckbox)
    translationCheckbox.checked = config.sentence?.showTranslation !== false;

  const translateEnable = document.getElementById("enableTranslate");
  if (translateEnable)
    translateEnable.checked = config.translateEnabled || false;
}

async function setupImagesPanel() {
  const config = await getConfig();
  const imgToggle = document.getElementById("imageEnabled");
  if (imgToggle) imgToggle.checked = config.image?.enabled !== false;
  const maxLinks = document.getElementById("imageMaxLinks");
  if (maxLinks) maxLinks.value = String(config.image?.maxLinks || 20);
  const autoLoad = document.getElementById("imageAutoLoadCount");
  if (autoLoad) autoLoad.value = String(config.image?.autoLoadCount || 3);
  const retryLimit = document.getElementById("imageRetryLimit");
  if (retryLimit) retryLimit.value = String(config.image?.retryLimit ?? 5);
}

async function setupOtherDictPanel() {
  const config = await getConfig();
  const otherDicts = config.otherDictionaries || [];
  const listEl = document.getElementById("otherDictList");
  const addBtn = document.getElementById("addOtherDictBtn");
  const statusEl = document.getElementById("otherDictStatus");

  function renderList() {
    if (!listEl) return;
    if (otherDicts.length === 0) {
      listEl.innerHTML = '<p class="hint">No external dictionaries added yet.</p>';
      return;
    }

    listEl.innerHTML = otherDicts
      .map(
        (dict, index) => `
        <div class="row" style="margin-bottom:12px;border:1px solid var(--border);padding:10px;border-radius:8px;">
          <div style="display:flex;flex-direction:column;gap:8px;flex:1;">
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="text" placeholder="Name (e.g. Cambridge)" value="${dict.name || ""}" data-index="${index}" data-field="name" style="flex:1;" />
              <button class="btn btn--danger" data-index="${index}" data-action="delete" type="button">Delete</button>
            </div>
            <input type="text" placeholder="URL with {term} or {sentence}" value="${dict.url || ""}" data-index="${index}" data-field="url" style="width:100%;" />
          </div>
        </div>
      `,
      )
      .join("");

    listEl.querySelectorAll('input[data-field]').forEach((input) => {
      input.addEventListener('input', debounce(async () => {
        const index = Number(input.dataset.index);
        const field = input.dataset.field;
        if (otherDicts[index]) {
          otherDicts[index][field] = input.value;
          await saveOtherDicts();
        }
      }, 350));
    });

    listEl.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const index = Number(btn.dataset.index);
        otherDicts.splice(index, 1);
        await saveOtherDicts();
        renderList();
      });
    });
  }

  async function saveOtherDicts() {
    const current = await getConfig();
    await saveConfig({
      ...current,
      otherDictionaries: otherDicts,
    });
    if (statusEl) {
      statusEl.textContent = 'Saved';
      statusEl.style.color = 'green';
      setTimeout(() => (statusEl.textContent = ''), 1200);
    }
  }

  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      otherDicts.push({ name: '', url: '' });
      await saveOtherDicts();
      renderList();
    });
  }

  renderList();
}

async function setupShortcutPanel() {
  if (!ShortcutUtils) return;
  const listEl = document.getElementById("shortcutList");
  const resetBtn = document.getElementById("resetShortcutsBtn");
  const statusEl = document.getElementById("shortcutStatus");
  if (!listEl) return;

  let shortcuts = await ShortcutUtils.loadShortcuts();
  let capturing = null;
  const actions = Object.keys(ShortcutUtils.ACTION_LABELS);
  const isDuplicateShortcut = (candidate, currentAction) =>
    actions.some(
      (act) =>
        act !== currentAction &&
        shortcuts[act] &&
        candidate &&
        candidate.code === shortcuts[act].code &&
        !!candidate.shift === !!shortcuts[act].shift &&
        !!candidate.ctrl === !!shortcuts[act].ctrl &&
        !!candidate.alt === !!shortcuts[act].alt &&
        !!candidate.meta === !!shortcuts[act].meta,
    );
  const captureHandler = async (event) => {
    if (!capturing) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (event.code === "Escape") {
      capturing.btn.textContent = ShortcutUtils.formatShortcut(
        shortcuts[capturing.action],
      );
      capturing.btn.classList.remove("is-duplicate");
      statusEl.textContent = "Canceled";
      statusEl.style.color = "";
      capturing = null;
      window.removeEventListener("keydown", captureHandler, true);
      return;
    }
    if (ShortcutUtils.isModifierOnly(event.code)) return;

    const candidate = ShortcutUtils.eventToShortcut(event);
    if (isDuplicateShortcut(candidate, capturing.action)) {
      capturing.btn.classList.add("is-duplicate");
      capturing.btn.textContent = ShortcutUtils.formatShortcut(candidate);
      statusEl.textContent = "Duplicate shortcut";
      statusEl.style.color = "red";
      return;
    }

    capturing.btn.classList.remove("is-duplicate");
    shortcuts[capturing.action] = candidate;
    shortcuts = await ShortcutUtils.saveShortcuts(shortcuts);

    capturing.btn.textContent = ShortcutUtils.formatShortcut(
      shortcuts[capturing.action],
    );
    statusEl.textContent = "Saved";
    statusEl.style.color = "green";
    setTimeout(() => {
      if (statusEl.textContent === "Saved") statusEl.textContent = "";
    }, 900);

    capturing = null;
    window.removeEventListener("keydown", captureHandler, true);
  };

  const render = () => {
    listEl.innerHTML = actions
      .map(
        (action) => `
      <div class="row">
        <div class="row__label">${ShortcutUtils.ACTION_LABELS[action]}</div>
        <div class="row__control">
          <button class="btn shortcut-capture-btn" type="button" data-action="${action}">
            ${ShortcutUtils.formatShortcut(shortcuts[action])}
          </button>
        </div>
      </div>
    `,
      )
      .join("");
  };

  render();

  listEl.addEventListener("click", (event) => {
    const btn = event.target.closest(".shortcut-capture-btn");
    if (!btn) return;

    if (capturing) {
      capturing.btn.textContent = ShortcutUtils.formatShortcut(
        shortcuts[capturing.action],
      );
      window.removeEventListener("keydown", captureHandler, true);
      capturing = null;
    }

    const action = btn.dataset.action;
    if (!action) return;
    capturing = { action, btn };
    btn.textContent = "Press key...";
    btn.classList.remove("is-duplicate");
    statusEl.textContent = "Press a key (Esc to cancel)";
    statusEl.style.color = "";
    window.addEventListener("keydown", captureHandler, true);
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      shortcuts = await ShortcutUtils.resetShortcuts();
      render();
      statusEl.textContent = "Reset to defaults";
      setTimeout(() => {
        if (statusEl.textContent === "Reset to defaults")
          statusEl.textContent = "";
      }, 900);
    });
  }
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function saveGeneralSettings(statusId) {
  try {
    const currentGeneralConfig = await getConfig();

    const maxDisplay = clampInt(
      document.getElementById("forvoMaxDisplay")?.value,
      1,
      3,
      3,
    );
    const autoplayCountRaw = clampInt(
      document.getElementById("forvoAutoplayCount")?.value,
      0,
      3,
      1,
    );
    const autoplayCount = Math.min(autoplayCountRaw, maxDisplay);
    const ttsMaxDisplay = clampInt(
      document.getElementById("ttsMaxDisplay")?.value,
      1,
      3,
      1,
    );
    const ttsAutoplayRaw = clampInt(
      document.getElementById("ttsAutoplayCount")?.value,
      0,
      3,
      0,
    );
    const ttsAutoplayCount = Math.min(ttsAutoplayRaw, ttsMaxDisplay);

    const newGeneralConfig = {
      ...currentGeneralConfig,
      lookupMode: document.getElementById("lookupMode")?.value || "hover",
      lookupResultMode:
        document.getElementById("lookupResultMode")?.value || "stacked",
      popup: {
        ...(currentGeneralConfig.popup || {}),
        defaultFeature:
          document.getElementById("popupDefaultFeature")?.value || "forvo",
      },
      translateEnabled:
        document.getElementById("enableTranslate")?.checked || false,
      sentence: {
        showSentence:
          document.getElementById("showSentenceToggle")?.checked ?? true,
        showTranslation:
          document.getElementById("showSentenceTranslationToggle")?.checked ??
          true,
      },
      forvo: {
        enabled: document.getElementById("forvoEnabled")?.checked ?? true,
        mode: document.getElementById("forvoMode")?.value || "auto",
        maxDisplay,
        autoplayCount,
        autoplayOnNavigate:
          document.getElementById("forvoAutoplayOnNavigate")?.checked ?? false,
      },
      image: {
        ...(currentGeneralConfig.image || {}),
        enabled: document.getElementById("imageEnabled")?.checked ?? true,
        maxLinks: clampInt(
          document.getElementById("imageMaxLinks")?.value,
          5,
          20,
          20,
        ),
        autoLoadCount: clampInt(
          document.getElementById("imageAutoLoadCount")?.value,
          1,
          5,
          3,
        ),
        retryLimit: clampInt(
          document.getElementById("imageRetryLimit")?.value,
          0,
          10,
          5,
        ),
      },
      tts: {
        enabled: document.getElementById("ttsEnabled")?.checked || false,
        voices: [
          document.getElementById("voice1")?.value,
          document.getElementById("voice2")?.value,
          document.getElementById("voice3")?.value,
        ],
        preferredLang: currentGeneralConfig.tts?.preferredLang || "en-US",
        maxDisplay: ttsMaxDisplay,
        autoplayCount: ttsAutoplayCount,
        savedVoices: Array.isArray(currentGeneralConfig.tts?.savedVoices)
          ? currentGeneralConfig.tts.savedVoices
          : [],
      },
    };
    await saveConfig(newGeneralConfig);

    const statusEl = document.getElementById(statusId);
    if (statusEl) {
      statusEl.innerText = "Saved";
      statusEl.style.color = "green";
      setTimeout(() => (statusEl.innerText = ""), 1200);
    }
  } catch (err) {
    alert("Có lỗi khi lưu: " + err.message);
  }
}

async function saveAnkiSettings(statusId) {
  try {
    const fieldMapping = {};
    document
      .querySelectorAll("#fieldMappingContainer select")
      .forEach((select) => {
        if (select.value) {
          fieldMapping[select.dataset.extField] = select.value;
        }
      });

    const ankiConfig = {
      deckName: document.getElementById("deckSelect")?.value || "",
      modelName: document.getElementById("modelSelect")?.value || "",
      tags: (document.getElementById("tagsInput")?.value || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      allowDuplicate:
        document.getElementById("allowDuplicateToggle")?.checked ?? true,
      showBrowserButton:
        document.getElementById("showBrowserBtnToggle")?.checked ?? true,
      fieldMapping,
    };

    await saveAnkiConfig(ankiConfig);

    const statusEl = document.getElementById(statusId);
    if (statusEl) {
      statusEl.innerText = "Saved";
      statusEl.style.color = "green";
      setTimeout(() => (statusEl.innerText = ""), 1200);
    }
  } catch (err) {
    alert("Có lỗi khi lưu Anki: " + err.message);
  }
}

function debounce(fn, waitMs) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

async function renderResources() {
  const container = document.getElementById("resourceList");
  if (!container) return;

  const resources = await listResources();
  resources.sort((a, b) => (a.priority || 0) - (b.priority || 0));

  const autoSaveTimers = new Map();
  const scheduleAutoSave = (resourceId) => {
    if (autoSaveTimers.has(resourceId)) {
      clearTimeout(autoSaveTimers.get(resourceId));
    }

    autoSaveTimers.set(
      resourceId,
      setTimeout(async () => {
        const row = container.querySelector(
          `.resource-row[data-id="${resourceId}"]`,
        );
        if (!row) return;

        const titleInput = row.querySelector('input[data-field="title"]');
        const enabledInput = row.querySelector('input[data-field="enabled"]');
        const priorityInput = row.querySelector('input[data-field="priority"]');

        const title = titleInput?.value || "";
        const enabled = enabledInput?.checked || false;
        const priority = Number(priorityInput?.value) || 0;

        const resourcesNow = await listResources();
        const existing = resourcesNow.find((r) => r.id === resourceId);
        if (!existing) return;

        await putResource({
          ...existing,
          title,
          enabled,
          priority,
          updatedAt: Date.now(),
        });
      }, 350),
    );
  };

  const renderGroup = (title, kind, list) => {
    const rows = list
      .map(
        (r) => `
        <div class="resource-row" data-id="${r.id}" data-kind="${kind}" draggable="true">
          <div class="resource-main">
            <div class="resource-left">
              <button class="btn resource-drag" type="button" title="Drag to reorder">Drag</button>
              <label style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" data-field="enabled" ${r.enabled ? "checked" : ""}/>
              </label>
              <div class="resource-title">
                <input type="text" data-field="title" value="${r.title || ""}" />
              </div>
              <div class="resource-meta">
                <input class="input--priority" type="number" data-field="priority" value="${r.priority ?? 1}" min="0"/>
                <button class="btn btn--danger resource-delete" data-action="delete" type="button">Delete</button>
              </div>
            </div>
          </div>
        </div>
      `,
      )
      .join("");
    return `
      <div style="margin-bottom:14px;">
        <div class="resource-header" style="margin:10px 0 8px 0;">${title}</div>
        <div class="resource-list">${rows || `<div class="status">No resources.</div>`}</div>
      </div>
    `;
  };

  const dicts = resources.filter((r) => r.kind === "dictionary");
  const freqs = resources.filter((r) => r.kind === "frequency");

  container.innerHTML =
    renderGroup("Dictionaries", "dictionary", dicts) +
    renderGroup("Frequencies", "frequency", freqs);

  async function persistOrderByKind(kind) {
    const ids = Array.from(
      container.querySelectorAll(`.resource-row[data-kind="${kind}"]`),
    ).map((row) => row.dataset.id);
    if (ids.length === 0) return;
    const resourcesNow = await listResources();
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      const existing = resourcesNow.find((r) => r.id === id);
      if (!existing) continue;
      await putResource({
        ...existing,
        priority: index + 1,
        updatedAt: Date.now(),
      });
    }
  }

  let draggingRowId = null;
  container.querySelectorAll(".resource-row").forEach((row) => {
    row.addEventListener("dragstart", () => {
      draggingRowId = row.dataset.id;
      row.classList.add("is-dragging");
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("is-dragging");
      draggingRowId = null;
    });
    row.addEventListener("dragover", (e) => e.preventDefault());
    row.addEventListener("drop", async (e) => {
      e.preventDefault();
      const targetId = row.dataset.id;
      const kind = row.dataset.kind;
      if (!draggingRowId || draggingRowId === targetId) return;
      const draggingRow = container.querySelector(
        `.resource-row[data-id="${draggingRowId}"]`,
      );
      const targetRow = container.querySelector(
        `.resource-row[data-id="${targetId}"]`,
      );
      if (
        !draggingRow ||
        !targetRow ||
        draggingRow.dataset.kind !== targetRow.dataset.kind
      )
        return;
      targetRow.parentNode.insertBefore(draggingRow, targetRow);
      await persistOrderByKind(kind);
      await renderResources();
    });
  });

  container.oninput = (e) => {
    const row = e.target.closest(".resource-row");
    if (!row) return;
    const resourceId = row.dataset.id;
    if (!resourceId) return;
    if (
      e.target.matches(
        'input[data-field="title"], input[data-field="priority"]',
      )
    ) {
      scheduleAutoSave(resourceId);
    }
  };

  container.onchange = (e) => {
    const row = e.target.closest(".resource-row");
    if (!row) return;
    const resourceId = row.dataset.id;
    if (!resourceId) return;
    if (e.target.matches('input[data-field="enabled"]')) {
      scheduleAutoSave(resourceId);
    }
  };

  container.onclick = async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const row = btn.closest(".resource-row");
    if (!row) return;
    const id = row.dataset.id;
    if (!id) return;

    if (btn.dataset.action === "delete") {
      if (!confirm("Xóa resource này?")) return;
      await clearResourceData(id);
      await deleteResource(id);
      await renderResources();
    }
  };
}

async function handleLookupTest() {
  const input = document.getElementById("lookupInput");
  const output = document.getElementById("lookupResult");
  if (!input || !output) return;
  const term = input.value.trim();
  if (!term) {
    output.innerText = "Nhập term trước.";
    return;
  }
  output.innerText = "Đang tra...";
  const config = await getConfig();
  const mode =
    config.lookupResultMode === "first_match" ? "first_match" : "stacked";
  const res = await lookupTermWithFreq(term, { mode, maxDictionaries: 10 });

  const freqText =
    res.freqs && res.freqs.length
      ? res.freqs
          .map(
            (f) =>
              `${f.resource.title || f.resource.id}: ${f.entries[0].value} (${f.entries[0].valueType})`,
          )
          .join(" | ")
      : "No frequency";

  if (res.results) {
    if (res.results.length === 0) {
      output.innerText = "Không tìm thấy.";
      return;
    }
    const blocks = res.results
      .map((b) => {
        const entry = b.entries[0];
        const atomsHtml = (entry.meaningAtoms || [])
          .map(
            (a, idx) =>
              `<div style="margin-bottom:6px;"><b>${a.head || `#${idx + 1}`}</b> ${a.glossHtml || ""}</div>`,
          )
          .join("");
        return `<div style="margin-bottom:10px;"><div><b>${b.resource.title || b.resource.id}</b></div>${atomsHtml}</div>`;
      })
      .join("");
    output.innerHTML = `
      <div><b>Mode:</b> stacked</div>
      <div>${blocks}</div>
      <div><b>Freq:</b> ${freqText}</div>
    `;
    return;
  }

  const entry = res.entry;
  const resource = res.resource;
  if (!entry) {
    output.innerText = "Không tìm thấy.";
    return;
  }
  const atomsHtml = (entry.meaningAtoms || [])
    .map(
      (a, idx) =>
        `<div style="margin-bottom:6px;"><b>${a.head || `#${idx + 1}`}</b> ${a.glossHtml || ""}</div>`,
    )
    .join("");
  output.innerHTML = `
    <div><b>Mode:</b> first_match</div>
    <div><b>Resource:</b> ${resource?.title || resource?.id}</div>
    <div><b>Term:</b> ${entry.displayTerm || entry.termKey}</div>
    <div>${atomsHtml}</div>
    <div><b>Freq:</b> ${freqText}</div>
  `;
}

// --- 6. QUẢN LÝ NHẬP TỪ ĐIỂN (DICTIONARY) ---
function initDictionaryPanel() {
  const importBtn = document.getElementById("importBtn");
  const dictFile = document.getElementById("dictFile");
  const status = document.getElementById("dictStatus");
  const fileName = document.getElementById("dictFileName");

  if (dictFile && fileName) {
    dictFile.addEventListener("change", () => {
      fileName.textContent = dictFile.files?.[0]?.name || "No file selected";
    });
  }

  importBtn.onclick = async () => {
    if (!dictFile.files.length) return alert("Chọn file JSON/ZIP trước.");

    const file = dictFile.files[0];
    status.innerText = "🔄 Đang nhập...";
    try {
      const result = await importFile(file);
      status.innerText = `✅ Nhập xong: ${result.kind}, ${result.count} records.`;
      await renderResources();
    } catch (err) {
      status.innerText = "😵 Lỗi nhập: " + err.message;
    }
  };
}

// --- 7. KHỞI CHẠY (MAIN ENTRY POINT) ---
document.addEventListener("DOMContentLoaded", async () => {
  // Chạy các thành phần giao diện
  initTabs();
  initDictionaryPanel();

  // Nạp dữ liệu vào các Panel
  // Sư phụ bọc trong try-catch để nếu Anki lỗi thì TTS vẫn load được
  await setupAnkiPanel().catch((e) => console.log("Anki Panel load fail"));
  await setupAudioPanel().catch((e) => console.log("Audio Panel load fail"));
  await setupDictionaryPanel().catch((e) =>
    console.log("Dictionary Panel load fail"),
  );
  await setupSentencePanel().catch((e) =>
    console.log("Sentence Panel load fail"),
  );
  await setupImagesPanel().catch((e) => console.log("Images Panel load fail"));
  await setupOtherDictPanel().catch((e) => console.log("Other Dict Panel load fail"));
  await setupShortcutPanel().catch((e) =>
    console.log("Shortcut Panel load fail"),
  );
  await renderResources().catch((e) => console.log("Resource render fail", e));
  await setupOceanTestPanel().catch((e) => console.log("OCEAN Test Panel load fail"));

  const autoSaveGeneral = debounce(
    () => saveGeneralSettings("dictionarySaveStatus"),
    350,
  );
  const autoSaveSentence = debounce(
    () => saveGeneralSettings("sentenceSaveStatus"),
    350,
  );
  const autoSaveImages = debounce(
    () => saveGeneralSettings("imagesSaveStatus"),
    350,
  );
  const autoSaveAudio = debounce(
    () => saveGeneralSettings("audioSaveStatus"),
    350,
  );

  document
    .getElementById("lookupMode")
    ?.addEventListener("change", autoSaveGeneral);
  document
    .getElementById("lookupResultMode")
    ?.addEventListener("change", autoSaveGeneral);
  document
    .getElementById("popupDefaultFeature")
    ?.addEventListener("change", autoSaveGeneral);

  document
    .getElementById("showSentenceToggle")
    ?.addEventListener("change", autoSaveSentence);
  document
    .getElementById("showSentenceTranslationToggle")
    ?.addEventListener("change", autoSaveSentence);
  document
    .getElementById("enableTranslate")
    ?.addEventListener("change", autoSaveSentence);

  document
    .getElementById("imageEnabled")
    ?.addEventListener("change", autoSaveImages);
  document
    .getElementById("imageMaxLinks")
    ?.addEventListener("change", autoSaveImages);
  document
    .getElementById("imageAutoLoadCount")
    ?.addEventListener("change", autoSaveImages);
  document
    .getElementById("imageRetryLimit")
    ?.addEventListener("change", autoSaveImages);

  document
    .getElementById("forvoEnabled")
    ?.addEventListener("change", autoSaveAudio);
  document
    .getElementById("forvoMode")
    ?.addEventListener("change", autoSaveAudio);
  document
    .getElementById("forvoMaxDisplay")
    ?.addEventListener("change", autoSaveAudio);
  document
    .getElementById("forvoAutoplayCount")
    ?.addEventListener("change", autoSaveAudio);
  document
    .getElementById("forvoAutoplayOnNavigate")
    ?.addEventListener("change", autoSaveAudio);
  document
    .getElementById("ttsEnabled")
    ?.addEventListener("change", autoSaveAudio);
  document
    .getElementById("ttsMaxDisplay")
    ?.addEventListener("change", autoSaveAudio);
  document
    .getElementById("ttsAutoplayCount")
    ?.addEventListener("change", autoSaveAudio);
  document.getElementById("voice1")?.addEventListener("change", autoSaveAudio);
  document.getElementById("voice2")?.addEventListener("change", autoSaveAudio);
  document.getElementById("voice3")?.addEventListener("change", autoSaveAudio);

  document
    .getElementById("ankiSaveBtn")
    ?.addEventListener("click", () => saveAnkiSettings("ankiSaveStatus"));

  const btnLookupTest = document.getElementById("lookupTestBtn");
  if (btnLookupTest) btnLookupTest.onclick = () => handleLookupTest();
});


// ============================================
// 🌊 OCEAN TEST PANEL
// ============================================

async function setupOceanTestPanel() {
  console.log("🌊 Setting up OCEAN Test Panel...");

  const testBtn = document.getElementById("oceanTestBtn");
  const clearBtn = document.getElementById("oceanClearBtn");
  const wordInput = document.getElementById("oceanTestWord");
  const sentenceInput = document.getElementById("oceanTestSentence");
  const resultDiv = document.getElementById("oceanTestResult");

  // Test button handler
  testBtn.addEventListener("click", async () => {
    const word = wordInput.value.trim();
    const sentence = sentenceInput.value.trim();

    if (!word || !sentence) {
      showOceanResult({
        status: "error",
        message: "Please enter both word and sentence"
      });
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = "Testing...";

    try {
      // Check if OCEAN is loaded
      if (!window.oceanMatcher) {
        showOceanResult({
          status: "error",
          message: "OCEAN Engine not loaded",
          details: "Make sure you've imported a dictionary with phrasal patterns."
        });
        return;
      }

      const { findPhrasalMatch } = window.oceanMatcher;
      const result = await findPhrasalMatch(word, sentence);

      if (result && result.status === "success") {
        showOceanResult({
          status: "success",
          word: word,
          sentence: sentence,
          match: result.data
        });
      } else {
        showOceanResult({
          status: "no_match",
          word: word,
          sentence: sentence,
          message: "No phrasal pattern matched"
        });
      }
    } catch (error) {
      console.error("OCEAN test error:", error);
      showOceanResult({
        status: "error",
        message: "Test failed",
        details: error.message
      });
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = "🔍 Test Match";
    }
  });

  // Clear button handler
  clearBtn.addEventListener("click", () => {
    wordInput.value = "";
    sentenceInput.value = "";
    resultDiv.classList.remove("show");
    resultDiv.innerHTML = "";
  });

  // Example click handlers
  const examples = document.querySelectorAll(".ocean-example");
  examples.forEach(example => {
    example.addEventListener("click", () => {
      const word = example.getAttribute("data-word");
      const sentence = example.getAttribute("data-sentence");
      wordInput.value = word;
      sentenceInput.value = sentence;
      
      // Scroll to test form
      document.querySelector(".ocean-test-card").scrollIntoView({ 
        behavior: "smooth", 
        block: "start" 
      });
    });
  });

  // Debug button handlers
  document.getElementById("oceanCheckStatusBtn").addEventListener("click", async () => {
    if (window.oceanDebug) {
      await window.oceanDebug.checkStatus();
      logToOceanConsole("✅ Check console (F12) for detailed status");
    } else {
      logToOceanConsole("❌ oceanDebug not available");
    }
  });

  document.getElementById("oceanTestBeBtn").addEventListener("click", async () => {
    if (window.oceanDebug && window.oceanDebug.testBeLemmatization) {
      await window.oceanDebug.testBeLemmatization();
      logToOceanConsole("✅ Check console (F12) for test results");
    } else {
      logToOceanConsole("❌ oceanDebug.testBeLemmatization not available");
    }
  });

  document.getElementById("oceanCheckAnchorBtn").addEventListener("click", async () => {
    if (window.oceanDebug) {
      await window.oceanDebug.checkAnchor("be");
      logToOceanConsole("✅ Check console (F12) for anchor patterns");
    } else {
      logToOceanConsole("❌ oceanDebug not available");
    }
  });

  document.getElementById("oceanRunAllTestsBtn").addEventListener("click", async () => {
    if (window.oceanDebug) {
      await window.oceanDebug.runTests();
      logToOceanConsole("✅ Check console (F12) for all test results");
    } else {
      logToOceanConsole("❌ oceanDebug not available");
    }
  });

  // Test compile button - test regex compilation directly
  document.getElementById("oceanTestCompileBtn")?.addEventListener("click", () => {
    if (!window.oceanCompiler) {
      logToOceanConsole("❌ oceanCompiler not available");
      return;
    }

    const testTerms = [
      "be (right) under your nose",
      "hand sth back",
      "a big/great girl's blouse"
    ];

    logToOceanConsole("🧪 Testing regex compilation:");
    testTerms.forEach(term => {
      const compiled = window.oceanCompiler.compilePhrasalPattern(term);
      logToOceanConsole(`\n📝 "${term}"`);
      logToOceanConsole(`   → ${compiled}`);
    });
  });

  console.log("✅ OCEAN Test Panel ready");
}

function showOceanResult(data) {
  const resultDiv = document.getElementById("oceanTestResult");
  resultDiv.classList.add("show");

  if (data.status === "success") {
    resultDiv.innerHTML = `
      <div class="ocean-result__header">
        <div class="ocean-result__status">✅</div>
        <div>
          <h3 class="ocean-result__title">Phrasal Pattern Matched!</h3>
          <p class="ocean-result__subtitle">OCEAN detected a phrasal verb or idiom</p>
        </div>
      </div>
      <div class="ocean-result__body">
        <div class="ocean-result__row">
          <div class="ocean-result__label">Target Word:</div>
          <div class="ocean-result__value"><code>${escapeHtml(data.word)}</code></div>
        </div>
        <div class="ocean-result__row">
          <div class="ocean-result__label">Matched Pattern:</div>
          <div class="ocean-result__value">
            <span class="ocean-result__badge">📘 PHRASAL</span>
            <strong>${escapeHtml(data.match.term)}</strong>
          </div>
        </div>
        <div class="ocean-result__row">
          <div class="ocean-result__label">Detected in Text:</div>
          <div class="ocean-result__value">
            <div class="ocean-result__detected">"${escapeHtml(data.match.detectedInSentence)}"</div>
          </div>
        </div>
        <div class="ocean-result__row">
          <div class="ocean-result__label">Definition:</div>
          <div class="ocean-result__value">
            <div class="ocean-result__definition">${data.match.definition || "No definition available"}</div>
          </div>
        </div>
        ${data.match.pronunciation ? `
        <div class="ocean-result__row">
          <div class="ocean-result__label">Pronunciation:</div>
          <div class="ocean-result__value">${escapeHtml(data.match.pronunciation)}</div>
        </div>
        ` : ''}
      </div>
    `;
  } else if (data.status === "no_match") {
    resultDiv.innerHTML = `
      <div class="ocean-result__header">
        <div class="ocean-result__status">ℹ️</div>
        <div>
          <h3 class="ocean-result__title">No Phrasal Pattern Found</h3>
          <p class="ocean-result__subtitle">This might be a single word or no pattern exists</p>
        </div>
      </div>
      <div class="ocean-result__body">
        <div class="ocean-result__row">
          <div class="ocean-result__label">Target Word:</div>
          <div class="ocean-result__value"><code>${escapeHtml(data.word)}</code></div>
        </div>
        <div class="ocean-result__row">
          <div class="ocean-result__label">Sentence:</div>
          <div class="ocean-result__value">"${escapeHtml(data.sentence)}"</div>
        </div>
        <div class="ocean-result__row">
          <div class="ocean-result__label">Suggestion:</div>
          <div class="ocean-result__value">
            • Check if the word is spelled correctly<br>
            • Try a different sentence context<br>
            • The pattern might not exist in your dictionary
          </div>
        </div>
      </div>
    `;
  } else if (data.status === "error") {
    resultDiv.innerHTML = `
      <div class="ocean-result__header">
        <div class="ocean-result__status">❌</div>
        <div>
          <h3 class="ocean-result__title">Error</h3>
          <p class="ocean-result__subtitle">${escapeHtml(data.message)}</p>
        </div>
      </div>
      ${data.details ? `
      <div class="ocean-result__body">
        <div class="ocean-result__row">
          <div class="ocean-result__label">Details:</div>
          <div class="ocean-result__value"><code>${escapeHtml(data.details)}</code></div>
        </div>
      </div>
      ` : ''}
    `;
  }
}

function logToOceanConsole(message) {
  const consoleDiv = document.getElementById("oceanConsoleOutput");
  const timestamp = new Date().toLocaleTimeString();
  const line = `[${timestamp}] ${message}\n`;
  consoleDiv.textContent += line;
  consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
