const DEFAULT_ANKI_CONFIG = {
  deckName: "",
  modelName: "",
  tags: ["Ocean"],
  autoFieldMapping: true,
  fieldMapping: {},
  enableTranslate: false,
  enableLocalTTS: true
};

export async function loadAnkiConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["ankiConfig"], (result) => {
      if (!result.ankiConfig) {
        resolve(DEFAULT_ANKI_CONFIG);
      } else {
        console.log("Background.js::Loaded Anki config:", result.ankiConfig);
        resolve({
          ...DEFAULT_ANKI_CONFIG,
          ...result.ankiConfig
        });
      }
    });
  });
}

export async function saveAnkiConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ ankiConfig: config }, () => {
      resolve(true);
    });
  });
}

export function validateAnkiConfig(config) {
  if (!config.deckName) return false;
  if (!config.modelName) return false;
  if (!Array.isArray(config.tags)) return false;
  return true;
}

export async function ankiInvoke(action, params = {}) {
  const response = await fetch("http://127.0.0.1:8765", {
    method: "POST",
    body: JSON.stringify({
      action,
      version: 6,
      params
    })
  });

  return response.json();
}

export async function getDeckNames() {
  const result = await ankiInvoke("deckNames");
  return result.result || [];
}

export async function getModelNames() {
  const result = await ankiInvoke("modelNames");
  return result.result || [];
}

export async function getModelFieldNames(modelName) {
  const result = await ankiInvoke("modelFieldNames", {
    modelName
  });
  return result.result || [];
}

