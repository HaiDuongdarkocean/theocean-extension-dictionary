const openOptionsBtn = document.getElementById("openOptionsBtn");

if (openOptionsBtn) {
  openOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}
