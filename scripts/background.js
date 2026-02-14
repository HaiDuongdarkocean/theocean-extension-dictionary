// background.js
import { loadAnkiConfig, ankiInvoke } from "./ankiSettings.js";
import { buildFieldsFromMapping } from "./ankiManager.js";
import { translateText } from "./TranslateModule.js";
import { getConfig, saveConfig } from "./configManager.js";
import { TTSModule } from "./ttsModule.js";
import { lookupTermWithFreq } from "./storage.js";


console.log("Background Service Worker đang chạy...");

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "search_word") {
    getConfig()
      .then((cfg) => cfg || {})
      .then((cfg) => {
        const mode = cfg.lookupResultMode === "first_match" ? "first_match" : "stacked";
        return lookupTermWithFreq(request.word, { mode, maxDictionaries: 10 });
      })
      .then((res) => {
        if (res?.results) {
          if (res.results.length === 0) {
            sendResponse(null);
            return;
          }

          const firstEntry = res.results[0].entries[0];
          const combinedHtml = res.results
            .map((block) => {
              const r = block.resource;
              const e = block.entries[0];
              const atoms = (e.meaningAtoms || [])
                .map(
                  (a, idx) =>
                    `<div class="ocean-atom"><b>${a.head || `#${idx + 1}`}</b> ${a.glossHtml || ""}</div>`,
                )
                .join("");
              return `
                <div class="ocean-dict-block">
                  <div class="ocean-dict-title">${r.title || r.id}</div>
                  <div class="ocean-dict-body">${atoms}</div>
                </div>
              `;
            })
            .join("");

          sendResponse({
            term: firstEntry.displayTerm || firstEntry.termKey,
            pronunciation: firstEntry.pronunciation || "",
            definition: combinedHtml,
            freqs: res.freqs || [],
            sources: res.results.map((b) => ({
              resourceId: b.resource.id,
              title: b.resource.title,
            })),
          });
          return;
        }

        const entry = res?.entry;
        const resource = res?.resource;
        const freqs = res?.freqs || [];
        if (!entry) {
          sendResponse(null);
          return;
        }
        const definitionHtml = (entry.meaningAtoms || [])
          .map(
            (a, idx) =>
              `<div class="ocean-atom"><b>${a.head || `#${idx + 1}`}</b> ${a.glossHtml || ""}</div>`,
          )
          .join("");
        sendResponse({
          term: entry.displayTerm || entry.termKey,
          pronunciation: entry.pronunciation || "",
          definition: definitionHtml,
          resourceTitle: resource?.title || "",
          meaningAtoms: entry.meaningAtoms,
          freqs,
        });
      })
      .catch(() => sendResponse(null));
    return true;
  }

  // Dịch Sentence
  if (request.action === "translateSentence") {
    translateText(request.text)
      .then((translated) => sendResponse({ success: true, text: translated }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Giữ kết nối bất đồng bộ
  }

  if (request.action === "openAnkiBrowser") {
    const query = request.query || "";
    ankiInvoke("guiBrowse", { query })
      .then((res) => sendResponse({ success: true, result: res }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === "updateAnkiNote") {
    const noteId = request.noteId;
    const data = request.data || {};
    if (!noteId) {
      sendResponse({ success: false, error: "Missing noteId" });
      return;
    }
    loadAnkiConfig()
      .then(async (cfg) => {
        const fields = buildFieldsFromMapping(data, cfg);
        const res = await ankiInvoke("updateNoteFields", {
          note: { id: noteId, fields },
        });
        return res;
      })
      .then((res) => sendResponse({ success: true, result: res }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === "getUserConfig") {
    getConfig()
      .then((cfg) => sendResponse({ success: true, config: cfg }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === "speakLocal") {
    const text = request.text || "";
    const voiceName = request.voiceName;
    if (!text.trim()) {
      sendResponse({ success: false, error: "No text" });
      return;
    }
    try {
      TTSModule.speak(text, voiceName);
      sendResponse({ success: true });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true;
  }

  // Fetch audio từ Forvo
  if (request.action === "fetchForvo") {
    console.log("Đang đi chợ lấy từ:", request.term); // Dòng này để debug
    fetchWithTimeout(`https://forvo.com/word/${request.term}/#en`, {}, 5000)
      .then((response) => {
        console.log("Kết quả HTTP:", response.status);
        return response.text();
      })
      .then((html) => {
        console.log("Đã lấy được HTML, độ dài:", html.length);
        sendResponse({ success: true, data: html });
      })
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Giữ kết nối để gửi response async
  }

  // Thêm Note vào Anki
  if (request.action === "addToAnki") {
    const note = request.note;

    fetch("http://127.0.0.1:8765", {
      method: "POST",
      body: JSON.stringify({
        action: "addNote",
        version: 6,
        params: { note },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        sendResponse({ success: !data.error, error: data.error });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });

    return true; // QUAN TRỌNG cho async
  }

  // Xử lý thêm Note vào Anki (phiên bản nâng cao)
  if (request.action === "addNoteToAnki") {
    handleAddToAnki(request.data)
      .then((res) => sendResponse({ success: true, ...res }))
      .catch((err) => sendResponse({ success: false, error: err.message }));

    return true;
  }

  // // Lấy ảnh từ Unsplash
  // if (request.action === "fetchImage") {
  //   fetchImageFromUnsplash(request.term).then(url =>
  //       sendResponse({ success: true, url: url })
  //   );
  //   return true;
  // }

  // Lấy ảnh từ Google Images
  if (request.action === "fetchImages") {
    const maxLinks = Number(request.maxLinks) || 20;
    fetchImagesFromGoogle(request.term, maxLinks)
      .then((urls) => sendResponse({ success: true, urls }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// background.js

async function fetchImagesFromGoogle(term, maxLinks = 20) {
  try {
    // Tăng quy mô tìm kiếm để có nhiều ảnh hơn
    const url = `https://www.google.com/search?q=${encodeURIComponent(term)}&tbm=isch`;
    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    }, 5000);
    const html = await response.text();

    // Regex quét các URL ảnh (thường nằm trong mảng JSON trong mã nguồn Google)
    const imgRegex = /"(https?:\/\/[^"]+?\.(?:jpg|png|jpeg))"/g;
    let match;
    const images = [];
    while ((match = imgRegex.exec(html)) !== null) {
      const link = match[1];
      if (
        !link.includes("gstatic.com") &&
        !link.includes("encrypted") &&
        !images.includes(link)
      ) {
        images.push(link);
      }
      if (images.length >= maxLinks) break;
    }
    return images;
  } catch (e) {
    return [];
  }
}

// Cập nhật Listener
// if (request.action === "fetchImages") {
//     fetchImagesFromGoogle(request.term).then(urls => sendResponse({ success: true, urls }));
//     return true;
// }

// // Lấy ảnh từ Unsplash
// async function fetchImageFromUnsplash(term) {
//   const ACCESS_KEY = "XRgBkZnWRULIv5NGyou46PMKb_edMYwDuoBEGyOo_Z0"; // Thay key của con vào đây
//   const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(term)}&per_page=1&client_id=${ACCESS_KEY}`;

//   try {
//     const response = await fetch(url);
//     const data = await response.json();
//     if (data.results && data.results.length > 0) {
//       return data.results[0].urls.small; // Lấy link ảnh cỡ nhỏ cho nhẹ
//     }
//     return null;
//   } catch (error) {
//     console.error("Lỗi lấy ảnh:", error);
//     return null;
//   }
// }

async function handleAddToAnki(extensionData) {
  const config = await loadAnkiConfig();

  const fields = buildFieldsFromMapping(extensionData, config);
  console.log("Background::Built fields for Anki note:", fields);

  // ===== WORD AUDIO (single or multi) =====
  const audioUrls =
    Array.isArray(extensionData.audioList) && extensionData.audioList.length > 0
      ? extensionData.audioList
      : extensionData.audio
        ? [extensionData.audio]
        : [];

  if (audioUrls.length > 0) {
    try {
      const soundTags = [];
      for (const url of audioUrls) {
        const filename = `${extensionData.term}_${Date.now()}_${soundTags.length + 1}.mp3`;
        const base64 = await downloadAudioAsBase64(url);
        const soundTag = await uploadAudioToAnki(filename, base64);
        soundTags.push(soundTag);
      }

      const audioFieldName = config.fieldMapping["Word audio"];
      if (audioFieldName) {
        fields[audioFieldName] = soundTags.join(" ");
      }
    } catch (e) {
      console.error("--> Lỗi tải/upload audio:", e);
    }
  }

  const imageUrls =
    Array.isArray(extensionData.images) && extensionData.images.length > 0
      ? extensionData.images
      : extensionData.image
        ? [extensionData.image]
        : [];

  if (imageUrls.length > 0) {
    try {
      const imageTags = [];
      for (const url of imageUrls) {
        const filename = `img_${extensionData.term}_${Date.now()}_${imageTags.length + 1}.jpg`;
        const base64 = await downloadAudioAsBase64(url);
        const imgTag = await uploadImageToAnki(filename, base64);
        imageTags.push(imgTag);
      }

      const imgField = config.fieldMapping["Images"];
      if (imgField) fields[imgField] = imageTags.join("");
    } catch (e) {
      console.error("Lỗi xử lý ảnh Anki:", e);
    }
  }

  const note = {
    deckName: config.deckName,
    modelName: config.modelName,
    fields,
    options: { allowDuplicate: config.allowDuplicate !== false },
    tags: config.tags || [],
  };

  // Duplicate check
  if (config.allowDuplicate === false) {
    const targetField = config.fieldMapping?.["Target word"];
    const targetValue = targetField ? fields[targetField] : null;
    if (targetValue) {
      const dupQuery = `"${targetValue}"`;
      const found = await ankiInvoke("findNotes", { query: dupQuery });
      if (Array.isArray(found.result) && found.result.length > 0) {
        return { duplicate: true, noteIds: found.result };
      }
    }
  }

  const result = await ankiInvoke("addNote", { note });

  console.log("Background::Note payload:", note);
  console.log("Background::Anki response:", result);

  if (result.error) {
    throw new Error(result.error);
  }

  const createdId = result.result?.noteIds ? result.result.noteIds : result.result;
  return { success: true, noteIds: Array.isArray(createdId) ? createdId : createdId ? [createdId] : [] };

  console.log("Final note fields:", fields);
}

// Viết thêm hàm phụ trợ này
async function uploadImageToAnki(filename, base64) {
    await ankiInvoke("storeMediaFile", { filename, data: base64 });
    return `<img src="${filename}">`;
}

async function downloadAudioAsBase64(url) {
  const res = await fetchWithTimeout(url, {}, 5000);
  console.log("Download audio response:", res);
  const blob = await res.blob();
  console.log("Blob:", blob);

  return new Promise((resolve) => {
    const reader = new FileReader();
    console.log("About to read blob as data URL", reader);
    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

async function uploadAudioToAnki(filename, base64) {
  await ankiInvoke("storeMediaFile", {
    filename,
    data: base64,
  });

  return `[sound:${filename}]`;
}
