// background.js
import { getDefinition } from "./database.js";
import { loadAnkiConfig, ankiInvoke } from "./ankiSettings.js";
import { buildFieldsFromMapping } from "./ankiManager.js";
import { translateText } from "./TranslateModule.js";
import { getConfig, saveConfig } from "./configManager.js";
import { TTSModule } from "./ttsModule.js";


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

  // Dịch Sentence
  if (request.action === "translateSentence") {
    translateText(request.text)
      .then((translated) => sendResponse({ success: true, text: translated }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Giữ kết nối bất đồng bộ
  }

  // Fetch audio từ Forvo
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
      .then(() => sendResponse({ success: true }))
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
    fetchImagesFromGoogle(request.term)
      .then((urls) => sendResponse({ success: true, urls }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// background.js

async function fetchImagesFromGoogle(term) {
  try {
    // Tăng quy mô tìm kiếm để có nhiều ảnh hơn
    const url = `https://www.google.com/search?q=${encodeURIComponent(term)}&tbm=isch`;
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
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
      if (images.length >= 20) break; // Lấy tối đa 20 ảnh
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
        console.warn(
          "--> Cảnh báo: Chưa map field 'Word audio' trong Settings",
        );
      }
    } catch (e) {
      console.error("--> Lỗi tải/upload audio:", e);
    }
  } else {
    console.log("--> KHÔNG tìm thấy audio trong data gửi tới.");
  }

  if (extensionData.image) {
    try {
      const filename = `img_${extensionData.term}_${Date.now()}.jpg`;
      const base64 = await downloadAudioAsBase64(extensionData.image); // Dùng chung hàm fetch->base64
      const imgTag = await uploadImageToAnki(filename, base64);

      const imgField = config.fieldMapping["Images"];
      if (imgField) fields[imgField] = imgTag;
    } catch (e) {
      console.error("Lỗi xử lý ảnh Anki:", e);
    }
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

// Viết thêm hàm phụ trợ này
async function uploadImageToAnki(filename, base64) {
    await ankiInvoke("storeMediaFile", { filename, data: base64 });
    return `<img src="${filename}">`;
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
