// background.js
import { getDefinition } from "./database.js";
import { loadAnkiConfig, ankiInvoke } from "./ankiSettings.js";
import { buildFieldsFromMapping } from "./ankiManager.js";

console.log("Background Service Worker đang chạy...");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "search_word") {
    // Tra cứu từ trong IndexedDB của Extension
    getDefinition(request.word).then((result) => {
      // Gửi lời hồi đáp về cho content script (website)
      sendResponse(result);
      console.log(
        "Đã gửi phản hồi cho từ background.js:",
        request.word,
        "Kết quả:",
        result,
      );
    });

    // Trả về true để báo cho Chrome biết ta sẽ phản hồi sau (asynchronous)
    return true;
  }
});

// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchForvo") {
    console.log("Đang đi chợ lấy từ:", request.term); // Dòng này để debug
    fetch(`https://forvo.com/word/${request.term}/#en`)
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
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // === ADD TO ANKI ===
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

  if (request.action === "addNoteToAnki") {
    handleAddToAnki(request.data)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));

    return true;
  }
});

async function handleAddToAnki(extensionData) {
  const config = await loadAnkiConfig();

  const fields = buildFieldsFromMapping(extensionData, config);
  console.log("Background::Built fields for Anki note:", fields);

  // ===== WORD AUDIO =====
  if (extensionData.audio) {
    console.log("--> Phát hiện có Audio URL, bắt đầu tải..."); // Debug log
    try {
        const filename = `${extensionData.term}_${Date.now()}.mp3`;
        const base64 = await downloadAudioAsBase64(extensionData.audio);
        const soundTag = await uploadAudioToAnki(filename, base64);
        
        console.log("--> Upload thành công, soundTag:", soundTag); // Debug log

        const audioFieldName = config.fieldMapping["Word audio"];
        if (audioFieldName) {
          fields[audioFieldName] = soundTag;
        } else {
            console.warn("--> Cảnh báo: Chưa map field 'Word audio' trong Settings");
        }
    } catch (e) {
        console.error("--> Lỗi tải/upload audio:", e);
    }
  } else {
      console.log("--> KHÔNG tìm thấy audio trong data gửi tới.");
  }

  const note = {
    deckName: config.deckName,
    modelName: config.modelName,
    fields,
    options: { allowDuplicate: false },
    tags: config.tags || [],
  };

  const result = await ankiInvoke("addNote", { note });

  console.log("Background::Note payload:", note);
  console.log("Background::Anki response:", result);

  if (result.error) {
    throw new Error(result.error);
  }

  console.log("Final note fields:", fields);
}

async function downloadAudioAsBase64(url) {
  const res = await fetch(url);
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


