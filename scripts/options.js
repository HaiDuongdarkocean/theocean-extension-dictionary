function getExtensionDefaultFields() {
  return [
    "Target word",
    "Definition",
    "Sentence",
    "Sentence translation",
    "Example sentences",
    "Notes",
    "Images",
    "Word audio",
    "Sentence audio",
  ];
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("importBtn").addEventListener("click", async () => {
    const fileInput = document.getElementById("dictFile");
    const status = document.getElementById("status");

    if (fileInput.files.length === 0) {
      alert("Vui lòng chọn một file JSON trước!");
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    status.innerText = "Đang đọc file...";

    reader.onload = async (e) => {
      try {
        // 1. Chuyển nội dung file từ chuỗi văn bản sang JSON (Array)
        const jsonData = JSON.parse(e.target.result);

        status.innerText = "Đang nạp vào IndexedDB (Vui lòng đợi)...";

        // 2. Gọi hàm importDictionary mà mình đã viết ở database.js
        // Vì database.js được nạp trước nên hàm này đã có sẵn
        await importDictionary(jsonData);

        status.innerText = "Chúc mừng! Đã nạp xong " + jsonData.length + " từ.";
      } catch (err) {
        console.error(err);
        status.innerText = "Lỗi: File không đúng định dạng JSON.";
      }
    };

    reader.readAsText(file);
  });

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".sidebar button").forEach((btn) => {
      btn.addEventListener("click", () => {
        // remove active
        document
          .querySelectorAll(".sidebar button")
          .forEach((b) => b.classList.remove("active"));

        document
          .querySelectorAll(".panel")
          .forEach((p) => p.classList.remove("active"));

        btn.classList.add("active");

        const panelId = btn.getAttribute("data-panel");
        document.getElementById(panelId).classList.add("active");
      });
    });
  });
});

// ===== INIT ANKI PANEL =====
async function initAnkiPanel() {
  try {
    const decks = await getDeckNames();
    renderDeckOptions(decks);

    const models = await getModelNames();
    renderModelOptions(models);

    loadSavedAnkiSettings();
  } catch (err) {
    document.getElementById("ankiStatus").innerText =
      "❌ Không kết nối được Anki. Hãy mở Anki Desktop.";
  }
}

function generateAutoMapping(extensionFields, modelFields) {
  const mapping = {};

  extensionFields.forEach((extField) => {
    const normalizedExt = normalizeFieldName(extField);

    const match = modelFields.find(
      (modelField) => normalizeFieldName(modelField) === normalizedExt,
    );

    if (match) {
      mapping[extField] = match;
    }
  });

  return mapping;
}

function renderDeckOptions(decks) {
  const select = document.getElementById("deckSelect");
  select.innerHTML = "";

  decks.forEach((deck) => {
    const option = document.createElement("option");
    option.value = deck;
    option.textContent = deck;
    select.appendChild(option);
  });
}

function renderModelOptions(models) {
  const select = document.getElementById("modelSelect");
  select.innerHTML = "";

  models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    select.appendChild(option);
  });
}
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("modelSelect")
    .addEventListener("change", async (e) => {
      const modelName = e.target.value;

      const fields = await getModelFieldNames(modelName);

      renderFieldMappingTable(fields);
    });
});

function renderFieldMappingTable(modelFields) {
  const container = document.getElementById("fieldMappingContainer");
  container.innerHTML = "";

  const extensionFields = getExtensionDefaultFields();

  const autoMapping = generateAutoMapping(extensionFields, modelFields);

  extensionFields.forEach((extField) => {
    const row = document.createElement("div");
    row.style.marginBottom = "8px";

    const label = document.createElement("label");
    label.textContent = extField + " → ";
    label.style.display = "inline-block";
    label.style.width = "180px";

    const select = document.createElement("select");
    select.dataset.extensionField = extField;

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "-- Ignore --";
    select.appendChild(emptyOption);

    modelFields.forEach((modelField) => {
      const option = document.createElement("option");
      option.value = modelField;
      option.textContent = modelField;

      if (autoMapping[extField] === modelField) {
        option.selected = true;
      }

      select.appendChild(option);
    });

    row.appendChild(label);
    row.appendChild(select);

    container.appendChild(row);
  });
}

function normalizeFieldName(name) {
  return name.toLowerCase().replace(/[\s_\-]/g, "");
}

async function loadSavedAnkiSettings() {
  const config = await loadAnkiConfig();

  document.getElementById("deckSelect").value = config.deckName || "";
  document.getElementById("modelSelect").value = config.modelName || "";
  document.getElementById("tagsInput").value = (config.tags || []).join(",");

  if (config.modelName) {
    const fields = await getModelFieldNames(config.modelName);
    renderFieldMappingTable(fields);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("saveAnkiSettings")
    .addEventListener("click", async () => {
      const deckName = document.getElementById("deckSelect").value;
      const modelName = document.getElementById("modelSelect").value;
      const tags = document
        .getElementById("tagsInput")
        .value.split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const fieldMapping = {};

      document
        .querySelectorAll("#fieldMappingContainer select")
        .forEach((select) => {
          const extField = select.dataset.extensionField;
          const modelField = select.value;

          if (modelField) {
            fieldMapping[extField] = modelField;
          }
        });

      const config = {
        deckName,
        modelName,
        tags,
        autoFieldMapping: true,
        fieldMapping,
      };

      await saveAnkiConfig(config);

      document.getElementById("ankiStatus").innerText =
        "✅ Saved successfully!";
    });
});
document.addEventListener("DOMContentLoaded", () => {
  initAnkiPanel();
});
