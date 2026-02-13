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
    const [decks, models] = await Promise.all([getDeckNames(), getModelNames()]);

    const deckSelect = document.getElementById("deckSelect");
    const modelSelect = document.getElementById("modelSelect");

    // Đổ dữ liệu vào Select
    deckSelect.innerHTML = decks.map(d => `<option value="${d}">${d}</option>`).join("");
    modelSelect.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join("");

    // Load cài đặt đã lưu
    const savedAnki = await loadAnkiConfig();
    deckSelect.value = savedAnki.deckName || "";
    modelSelect.value = savedAnki.modelName || "";
    document.getElementById("tagsInput").value = (savedAnki.tags || []).join(",");

    // Hiển thị bảng Mapping nếu đã chọn Model
    if (savedAnki.modelName) {
      const fields = await getModelFieldNames(savedAnki.modelName);
      renderFieldMappingTable(fields, savedAnki.fieldMapping || {});
    }

    // Sự kiện khi thay đổi Model thì phải load lại danh sách field của Model đó
    modelSelect.onchange = async (e) => {
      const fields = await getModelFieldNames(e.target.value);
      renderFieldMappingTable(fields, {});
    };

    ankiStatus.innerText = "💚 Kết nối Anki thành công";
  } catch (err) {
    console.error("Anki Error:", err);
    ankiStatus.innerHTML = "<b style='color:red'>😵 Không kết nối được Anki. Hãy mở Anki Desktop và bật AnkiConnect.</b>";
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
    select.innerHTML = `<option value="">-- Bỏ qua (Ignore) --</option>` +
      modelFields.map(mf => `<option value="${mf}" ${savedMapping[extField] === mf ? 'selected' : ''}>${mf}</option>`).join("");

    row.appendChild(label);
    row.appendChild(select);
    container.appendChild(row);
  });
}

// --- 4. QUẢN LÝ AUDIO & TTS PANEL ---
async function setupAudioPanel() {
  const config = await getConfig();
  const voices = await TTSModule.getAvailableVoices();

  document.getElementById("ttsEnabled").checked = config.tts?.enabled || false;

  document.getElementById("forvoEnabled").checked = config.forvo?.enabled ?? true;
  document.getElementById("forvoMode").value = config.forvo?.mode || "auto";
  document.getElementById("forvoMaxDisplay").value = String(config.forvo?.maxDisplay || 3);
  document.getElementById("forvoAutoplayCount").value = String(config.forvo?.autoplayCount ?? 1);

  // Hàm đổ giọng đọc vào 3 Slot
  const populateVoice = (selectId, currentVoice) => {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">-- Mặc định hệ thống --</option>' +
      voices.map(v => `<option value="${v.voiceName}" ${v.voiceName === currentVoice ? 'selected' : ''}>${v.voiceName} (${v.lang})</option>`).join("");
  };

  populateVoice("voice1", config.tts?.voices?.[0]);
  populateVoice("voice2", config.tts?.voices?.[1]);
  populateVoice("voice3", config.tts?.voices?.[2]);
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
}

async function setupTranslationPanel() {
  const config = await getConfig();
  const checkbox = document.getElementById("enableTranslate");
  if (checkbox) checkbox.checked = config.translateEnabled || false;
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function saveGeneralSettings(statusId) {
  try {
    const currentGeneralConfig = await getConfig();

    const maxDisplay = clampInt(document.getElementById("forvoMaxDisplay")?.value, 1, 3, 3);
    const autoplayCountRaw = clampInt(document.getElementById("forvoAutoplayCount")?.value, 0, 3, 1);
    const autoplayCount = Math.min(autoplayCountRaw, maxDisplay);

    const newGeneralConfig = {
      ...currentGeneralConfig,
      lookupMode: document.getElementById("lookupMode")?.value || "hover",
      lookupResultMode:
        document.getElementById("lookupResultMode")?.value || "stacked",
      translateEnabled: document.getElementById("enableTranslate")?.checked || false,
      forvo: {
        enabled: document.getElementById("forvoEnabled")?.checked ?? true,
        mode: document.getElementById("forvoMode")?.value || "auto",
        maxDisplay,
        autoplayCount,
      },
      tts: {
        enabled: document.getElementById("ttsEnabled")?.checked || false,
        voices: [
          document.getElementById("voice1").value,
          document.getElementById("voice2").value,
          document.getElementById("voice3").value,
        ]
      }
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
    document.querySelectorAll("#fieldMappingContainer select").forEach((select) => {
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

  const renderGroup = (title, list) => {
    const rows = list
      .map(
        (r) => `
        <div class="resource-row" data-id="${r.id}">
          <div class="resource-main">
            <div class="resource-left">
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
    renderGroup("Dictionaries", dicts) + renderGroup("Frequencies", freqs);

  container.oninput = (e) => {
    const row = e.target.closest(".resource-row");
    if (!row) return;
    const resourceId = row.dataset.id;
    if (!resourceId) return;
    if (e.target.matches('input[data-field="title"], input[data-field="priority"]')) {
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
  const mode = config.lookupResultMode === "first_match" ? "first_match" : "stacked";
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
  await setupAnkiPanel().catch(e => console.log("Anki Panel load fail"));
  await setupAudioPanel().catch(e => console.log("Audio Panel load fail"));
  await setupDictionaryPanel().catch(e => console.log("Dictionary Panel load fail"));
  await setupTranslationPanel().catch(e => console.log("Translation Panel load fail"));
  await renderResources().catch(e => console.log("Resource render fail", e));

  const autoSaveGeneral = debounce(
    () => saveGeneralSettings("dictionarySaveStatus"),
    350,
  );
  const autoSaveTranslation = debounce(
    () => saveGeneralSettings("translationSaveStatus"),
    350,
  );
  const autoSaveAudio = debounce(() => saveGeneralSettings("audioSaveStatus"), 350);
  const autoSaveAnki = debounce(() => saveAnkiSettings("ankiSaveStatus"), 500);

  document.getElementById("lookupMode")?.addEventListener("change", autoSaveGeneral);
  document.getElementById("lookupResultMode")?.addEventListener("change", autoSaveGeneral);

  document.getElementById("enableTranslate")?.addEventListener("change", autoSaveTranslation);

  document.getElementById("forvoEnabled")?.addEventListener("change", autoSaveAudio);
  document.getElementById("forvoMode")?.addEventListener("change", autoSaveAudio);
  document.getElementById("forvoMaxDisplay")?.addEventListener("change", autoSaveAudio);
  document.getElementById("forvoAutoplayCount")?.addEventListener("change", autoSaveAudio);
  document.getElementById("ttsEnabled")?.addEventListener("change", autoSaveAudio);
  document.getElementById("voice1")?.addEventListener("change", autoSaveAudio);
  document.getElementById("voice2")?.addEventListener("change", autoSaveAudio);
  document.getElementById("voice3")?.addEventListener("change", autoSaveAudio);

  document.getElementById("deckSelect")?.addEventListener("change", autoSaveAnki);
  document.getElementById("modelSelect")?.addEventListener("change", autoSaveAnki);
  document.getElementById("tagsInput")?.addEventListener("input", autoSaveAnki);
  document.getElementById("fieldMappingContainer")?.addEventListener("change", (e) => {
    if (e.target && e.target.matches("select")) autoSaveAnki();
  });

  const btnLookupTest = document.getElementById("lookupTestBtn");
  if (btnLookupTest) btnLookupTest.onclick = () => handleLookupTest();
});
