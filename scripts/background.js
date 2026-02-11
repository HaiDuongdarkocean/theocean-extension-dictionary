// background.js
// Lưu ý: Đường dẫn phải chính xác tới file database.js
import { getDefinition } from "./database.js";
// import { loadAnkiConfig, ankiInvoke } from "./ankiSettings.js";

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

  const note = {
    deckName: config.deckName,
    modelName: config.modelName,
    fields,
    options: {
      allowDuplicate: false
    },
    tags: config.tags || []
  };

  const result = await ankiInvoke("addNote", { note });

  if (result.error) {
    throw new Error(result.error);
  }
}

