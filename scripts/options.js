/**
 * options.js 
 * Quản lý toàn bộ giao diện cài đặt của Yomitan Pro
 */
import { importDictionary } from "./database.js";
import { getConfig, saveConfig } from "./configManager.js";
import { TTSModule } from "./ttsModule.js";
import {
  loadAnkiConfig,
  saveAnkiConfig,
  getDeckNames,
  getModelNames,
  getModelFieldNames,
} from "./ankiSettings.js";

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

    ankiStatus.innerText = "✅ Kết nối Anki thành công.";
  } catch (err) {
    console.error("Anki Error:", err);
    ankiStatus.innerHTML = "<b style='color:red'>❌ Không kết nối được Anki. Hãy mở Anki Desktop và bật AnkiConnect.</b>";
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
    statusEl.innerText = "✅ Đã lưu tất cả cài đặt!";
    statusEl.style.color = "green";
    setTimeout(() => (statusEl.innerText = ""), 2000);
    
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
    statusEl.innerText = "✅ Đã lưu!";
    statusEl.style.color = "green";
    setTimeout(() => (statusEl.innerText = ""), 2000);
  } catch (err) {
    alert("Có lỗi khi lưu Anki: " + err.message);
  }
}

// --- 6. QUẢN LÝ NHẬP TỪ ĐIỂN (DICTIONARY) ---
function initDictionaryPanel() {
  const importBtn = document.getElementById("importBtn");
  const dictFile = document.getElementById("dictFile");
  const status = document.getElementById("dictStatus");

  importBtn.onclick = async () => {
    if (!dictFile.files.length) return alert("Chọn file JSON đã con!");
    
    const file = dictFile.files[0];
    const reader = new FileReader();
    status.innerText = "🔄 Đang đọc file...";

    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        status.innerText = "🔄 Đang nạp vào IndexedDB...";
        await importDictionary(jsonData);
        status.innerText = `✅ Thành công! Đã nạp ${jsonData.length} từ.`;
      } catch (err) {
        status.innerText = "❌ Lỗi: File không đúng định dạng JSON.";
      }
    };
    reader.readAsText(file);
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

  // Gán sự kiện cho các nút Lưu
  const btnAnkiSave = document.getElementById("saveAnkiSettings");
  if (btnAnkiSave) btnAnkiSave.onclick = () => saveAnkiSettings("ankiStatus");

  const btnAudioSave = document.getElementById("saveAudioBtn");
  if (btnAudioSave) btnAudioSave.onclick = () => saveGeneralSettings("audioSaveStatus");

  const btnDictSave = document.getElementById("saveDictionaryBtn");
  if (btnDictSave) btnDictSave.onclick = () => saveGeneralSettings("dictionarySaveStatus");

  const btnTranslationSave = document.getElementById("saveTranslationBtn");
  if (btnTranslationSave) btnTranslationSave.onclick = () => saveGeneralSettings("translationSaveStatus");
});
