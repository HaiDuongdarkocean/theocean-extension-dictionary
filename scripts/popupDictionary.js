// Chuyển đổi thành Map để đạt tốc độ O(1)
const dictionary = new Map();

// Thêm biến này ở đầu file để quản lý toàn cục
let globalCloseTimer = null;
let lookupTimer = null;
let popupStack = [];

// 2. Tạo phần tử Popup (như bài trước)
const popup = document.createElement("div");
popup.id = "yomitan-popup";
document.body.appendChild(popup);

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
      // Gỡ bỏ sự kiện phím tắt của riêng popup này trước khi xóa element
      if (p._keyHandler) {
        document.removeEventListener("keydown", p._keyHandler);
        console.log(`Đã gỡ phím tắt của popup level ${p.dataset.level}`);
      }
      p.remove();
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
      const isPrimary = index === 0;
      const accentColor =
        audio.country === "United States" ? "#0866ff" : "#00c0a5";

      return `<span class="yomi-audio-btn"
              data-url="${audio.url}"
              data-index="${index}"
              title="${audio.country}"
              style="cursor:pointer;margin-right:8px;color:${accentColor};font-size:${isPrimary ? "1em" : "1em"};">
              ${isPrimary ? "🔊" : "🔊"}
            </span>`;
    })
    .join("");

  // Nếu còn audio chưa hiển thị
  if (visibleCount < fullList.length) {
    const remain = fullList.length - visibleCount;

    container.innerHTML += `
      <span class="yomi-load-more"
            style="font-size:10px;color:#999;cursor:pointer">
        +${remain}
      </span>`;
  }

  attachAudioEvents(popup);
  attachLoadMoreEvent(popup);
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
      playAudioWithUI(popup, index);
    };
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

function addNoteToAnki(dataOfCard) {
  console.log("PopupDrictionary.js::Adding note to Anki:", dataOfCard);
  chrome.runtime.sendMessage(
    {
      action: "addNoteToAnki",
      data: dataOfCard,
    },
    (response) => {
      console.log("PopupDrictionary.js::addNoteToAnki responed:", response);
      if (!response) {
        alert("❌ Không kết nối được Anki");
        return;
      }

      if (response.success) {
        alert("✅ Đã thêm vào Anki!");
      } else {
        alert("❌ Lỗi: " + response.error);
      }
    },
  );
}

function showPopup(x, y, data, level) {
  console.log("showPopup called with:", { x, y, data, level });
  removePopupsAbove(level - 1);

  const newPopup = document.createElement("div");
  newPopup.className = "yomitan-popup-stack";
  newPopup.dataset.level = level;

  // 1. Tạo KHUNG XƯƠNG (Placeholder) - Không dùng biến audioButtonsHTML ở đây
  newPopup.innerHTML = `
        <div class="yomi-header">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                <span class="popup-term-title">${data.term}</span>
                <span class="yomi-add-anki-btn" style="margin-top:8px;padding:4px 8px;cursor:pointer;" tooltip="add to Anki">💎</span>
            </div>
            
            ${data.originalWord ? `<div class="yomi-origin-note">(Gốc của: <span>${data.originalWord}</span>)</div>` : ""}

            <div class="yomi-pronunciation yomi-pronunciation-container" style="display: flex; align-items: center; margin-top: 5px; color: var(--yomi-primary)">
                <span style="font-family: 'Segoe UI', sans-serif; margin-right: 10px;">/${data.pronunciation || "n/a"}/</span>
                <div class="yomi-audio-group">
                    <span style="opacity: 0.3">🔈 🔈 🔈</span>
                </div>
            </div>
        </div>

        <div class="definition-container">
            <div class="yomi-definition-text">${data.definition}</div>
        </div>

        <div style="padding: 6px 16px; background: var(--yomi-surface); font-size: 10px; color: var(--yomi-text-sub); display: flex; justify-content: space-between; border-top: 1px solid var(--yomi-border);">
            <span>Level ${level}</span>
        </div>
    `;

  const targetContainer = document.fullscreenElement || document.body;
  targetContainer.appendChild(newPopup);

  // Gắn sự kiện Add to Anki
  const addBtn = newPopup.querySelector(".yomi-add-anki-btn");

  if (addBtn) {
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();

      addNoteToAnki(data); // gửi extensionData hiện tại
    });
  }

  // 4. ĐI LẤY DỮ LIỆU THẬT (Bất đồng bộ)
  const audioContainer = newPopup.querySelector(".yomi-audio-group");

  fetchAudioFromForvo(data.term).then((realData) => {
    const safeData = realData || [];
    // console.log("Dữ liệu âm thanh thô:", realData);
    const processed = processAudioList(realData);
    // console.log("Dữ liệu sau khi lọc (processed):", processed);

    if (processed.fullList && processed.fullList.length > 0) {
      // Lưu toàn bộ audio
      newPopup._audioFullList = processed.fullList;

      // Ban đầu chỉ hiển thị 3
      newPopup._audioVisibleCount = AudioConfig.maxDisplay;

      // Render bằng hệ thống lazy mới
      renderAudioGroup(newPopup);

      // AutoPlay chỉ tải audio đầu tiên
      if (AudioConfig.autoPlay) {
        setTimeout(() => {
          const firstUrl = newPopup._audioFullList?.[0]?.url;
          if (!firstUrl) return;

          if (AudioConfig.autoPlay) {
            setTimeout(() => {
              playMultipleAudios(newPopup, 1);
            }, 300);
          }
        }, 300);
      }
    } else {
      audioContainer.innerHTML = `<span style="font-size:10px; color:#ccc;">No audio</span>`;
    }
  });

  // 5. Gắn phím tắt (Nhớ remove khi đóng)
  const keyHandler = (e) => {
    if (!e.ctrlKey || e.code !== "Space") return;

    e.preventDefault();

    // Ctrl + Shift + Space → phát 3 audio đầu
    if (e.shiftKey) {
      playMultipleAudios(newPopup, 3);
    }
    // Ctrl + Space → phát 1 audio
    else {
      playMultipleAudios(newPopup, 1);
    }
  };

  document.addEventListener("keydown", keyHandler);
  // Lưu keyHandler vào popup để sau này gỡ ra
  newPopup._keyHandler = keyHandler;

  // QUAN TRỌNG: Khi đóng popup phải gỡ sự kiện phím tắt
  // (Con nhớ thêm dòng này vào hàm removePopup)
  // document.removeEventListener('keydown', keyHandler);

  // --- GIẢI THUẬT TÍNH VỊ TRÍ CHỐNG TRÀN ---
  const popupWidth = 300; // Chiều rộng cố định hoặc đo bằng newPopup.offsetWidth
  const popupHeight = newPopup.offsetHeight;

  // Lấy tọa độ chuột tương ứng với Viewport (cửa sổ hiển thị)
  // Vì x, y của con là pageX, pageY (tính cả phần đã cuộn)
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;

  let finalX = x + 10; // Mặc định lệch phải 10px
  let finalY = y + 20; // Mặc định lệch dưới 20px

  // 1. Kiểm tra tràn bên PHẢI
  if (finalX + popupWidth > scrollX + viewWidth) {
    finalX = x - popupWidth - 10; // Lật sang bên trái chuột
  }
  // Kiểm tra tràn bên TRÁI (nếu lật sang trái mà vẫn tràn)
  if (finalX < scrollX) finalX = scrollX + 5;

  // 2. Kiểm tra tràn bên DƯỚI
  if (finalY + popupHeight > scrollY + viewHeight) {
    finalY = y - popupHeight - 20; // Lật lên phía trên chuột
  }
  // Kiểm tra tràn bên TRÊN
  if (finalY < scrollY) finalY = scrollY + 5;

  // Áp dụng tọa độ cuối cùng
  newPopup.style.left = `${finalX}px`;
  newPopup.style.top = `${finalY}px`;
  newPopup.style.visibility = "visible"; // Hiển thị lại sau khi đã căn chỉnh
  newPopup.style.zIndex = (10000 + level).toString();

  popupStack.push(newPopup);
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
    if (!sentence) return;
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
    infoOfSentenceAndWord.sentence = sentence; // Lưu lại câu để hiển thị trong popup. phục vụ cho anki.
    console.log(
      "popupDictionary.js::infoOfSentenceAndWord:",
      infoOfSentenceAndWord,
    );
    if (!infoOfSentenceAndWord) return;

    console.log(
      "Word candidate:",
      sentence.substring(relativeOffset, relativeOffset + 20),
    );
    console.log("Calculated word relativeOffset:", relativeOffset);

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
    showPopup(event.pageX, event.pageY, infoOfSentenceAndWord, level);
  }, 150);
});
