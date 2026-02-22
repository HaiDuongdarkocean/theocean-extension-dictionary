// OCEAN ENGINE - Dynamic Module Loader
// Loads ES6 modules dynamically in content script context

// Create a promise that resolves when OCEAN is ready
window.oceanReady = new Promise(async (resolve, reject) => {
  try {
    console.log("🌊 OCEAN: Starting module loading...");
    
    // Dynamically import OCEAN modules
    const oceanMatcher = await import(chrome.runtime.getURL('scripts/oceanMatcher.js'));
    const oceanCompiler = await import(chrome.runtime.getURL('scripts/oceanCompiler.js'));
    const oceanStorage = await import(chrome.runtime.getURL('scripts/oceanStorage.js'));
    
    // Expose to global scope for popupDictionary.js
    window.oceanMatcher = oceanMatcher;
    window.oceanCompiler = oceanCompiler;
    window.oceanStorage = oceanStorage;
    
    console.log("✓ OCEAN ENGINE modules loaded successfully");
    
    // Dispatch custom event for listeners
    window.dispatchEvent(new CustomEvent('oceanReady', { 
      detail: { 
        matcher: oceanMatcher, 
        compiler: oceanCompiler, 
        storage: oceanStorage 
      } 
    }));
    
    resolve({ oceanMatcher, oceanCompiler, oceanStorage });
  } catch (error) {
    console.error("⚠️ Failed to load OCEAN ENGINE modules:", error);
    reject(error);
  }
});
