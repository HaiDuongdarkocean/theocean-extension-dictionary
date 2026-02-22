// OCEAN ENGINE - Debug Helper
// Quick commands to check OCEAN status

window.oceanDebug = {
  // Check if OCEAN is loaded
  async checkStatus() {
    console.log("🌊 ========== OCEAN STATUS ==========");
    
    // Check modules
    console.log("\n📦 Modules:");
    console.log("  oceanMatcher:", !!window.oceanMatcher ? "✅ Loaded" : "❌ Not loaded");
    console.log("  oceanCompiler:", !!window.oceanCompiler ? "✅ Loaded" : "❌ Not loaded");
    console.log("  oceanStorage:", !!window.oceanStorage ? "✅ Loaded" : "❌ Not loaded");
    console.log("  oceanReady:", !!window.oceanReady ? "✅ Promise exists" : "❌ No promise");
    
    // Check database
    if (window.oceanStorage) {
      try {
        const { countPhrasalPatterns, getAllAnchorWords } = window.oceanStorage;
        const count = await countPhrasalPatterns();
        console.log("\n💾 Database:");
        console.log("  Total patterns:", count);
        
        if (count > 0) {
          const anchors = await getAllAnchorWords();
          console.log("  Unique anchors:", anchors.length);
          console.log("  Sample anchors:", anchors.slice(0, 20).join(", "));
        } else {
          console.warn("  ⚠️ No patterns found! Import a dictionary first.");
        }
      } catch (error) {
        console.error("  ❌ Database error:", error);
      }
    }
    
    console.log("\n🌊 ====================================");
  },
  
  // Test a specific word/sentence
  async test(word, sentence) {
    console.log(`🌊 Testing: "${word}" in "${sentence}"`);
    
    if (!window.oceanMatcher) {
      console.error("❌ OCEAN not loaded yet");
      return;
    }
    
    const { findPhrasalMatch } = window.oceanMatcher;
    const result = await findPhrasalMatch(word, sentence);
    
    if (result) {
      console.log("✅ Match found:");
      console.log("  Term:", result.data.term);
      console.log("  Detected:", result.data.detectedInSentence);
      console.log("  Definition:", result.data.definition?.substring(0, 100) + "...");
    } else {
      console.log("ℹ️ No phrasal match (will use single word)");
    }
    
    return result;
  },
  
  // Check specific anchor
  async checkAnchor(anchor) {
    if (!window.oceanStorage) {
      console.error("❌ OCEAN not loaded yet");
      return;
    }
    
    const { getPhrasalPatternsByAnchor } = window.oceanStorage;
    const patterns = await getPhrasalPatternsByAnchor(anchor);
    
    console.log(`🌊 Patterns for anchor "${anchor}":`, patterns.length);
    patterns.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.originalTerm} (priority: ${p.priority})`);
      console.log(`     Regex: ${p.compiledRegex.substring(0, 80)}...`);
    });
    
    return patterns;
  },
  
  // Quick test cases
  async runTests() {
    console.log("🌊 ========== RUNNING TEST CASES ==========");
    
    const tests = [
      { word: "handed", sentence: "He handed the old photograph back to her" },
      { word: "handed", sentence: "She handed in her term paper late" },
      { word: "took", sentence: "She took off her coat" },
      { word: "give", sentence: "Don't give up on your dreams" }
    ];
    
    for (const test of tests) {
      console.log(`\n📝 Test: "${test.word}" in "${test.sentence}"`);
      await this.test(test.word, test.sentence);
    }
    
    console.log("\n🌊 ====================================");
  },
  
  // Wait for OCEAN to be ready
  async waitReady(timeout = 5000) {
    console.log("🌊 Waiting for OCEAN to be ready...");
    
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeout)
      );
      
      await Promise.race([window.oceanReady, timeoutPromise]);
      console.log("✅ OCEAN is ready!");
      return true;
    } catch (error) {
      console.error("❌ OCEAN failed to load:", error.message);
      return false;
    }
  },
  
  // Test "be" verb lemmatization
  async testBeLemmatization() {
    console.log("🌊 ========== TESTING 'BE' VERB LEMMATIZATION ==========");
    
    // Check irregularMap first
    if (!window.irregularMap) {
      console.error("❌ irregularMap not loaded!");
      return;
    }
    
    console.log("\n📚 Checking irregularMap:");
    const beVerbs = ["is", "am", "are", "was", "were", "being", "been"];
    beVerbs.forEach(verb => {
      const result = window.irregularMap.get(verb);
      if (result && result.root === "be") {
        console.log(`  ✅ "${verb}" → "${result.root}" (${result.type})`);
      } else {
        console.error(`  ❌ "${verb}" → NOT MAPPED TO "be"`);
      }
    });
    
    // Check if pattern exists in database
    if (!window.oceanStorage) {
      console.error("\n❌ oceanStorage not loaded!");
      return;
    }
    
    console.log("\n💾 Checking database for 'be' patterns:");
    const { getPhrasalPatternsByAnchor } = window.oceanStorage;
    const patterns = await getPhrasalPatternsByAnchor("be");
    
    if (patterns && patterns.length > 0) {
      console.log(`  ✅ Found ${patterns.length} pattern(s) for anchor "be"`);
      patterns.forEach(p => {
        console.log(`    - "${p.originalTerm}"`);
        console.log(`      Regex: ${p.compiledRegex}`);
      });
    } else {
      console.error("  ❌ No patterns found for anchor 'be'");
    }
    
    // Test actual matching
    if (!window.oceanMatcher) {
      console.error("\n❌ oceanMatcher not loaded!");
      return;
    }
    
    console.log("\n🧪 Testing actual matches:");
    const testCases = [
      { word: "were", sentence: "they were right under my nose" },
      { word: "was", sentence: "was under our noses" },
      { word: "is", sentence: "is right under your nose" },
      { word: "are", sentence: "are under your nose" }
    ];
    
    const { findPhrasalMatch } = window.oceanMatcher;
    
    for (const { word, sentence } of testCases) {
      console.log(`\n  Testing: "${word}" in "${sentence}"`);
      const result = await findPhrasalMatch(word, sentence);
      
      if (result && result.status === "success") {
        console.log(`    ✅ MATCH: "${result.data.term}"`);
        console.log(`    Detected: "${result.data.detectedInSentence}"`);
      } else {
        console.error(`    ❌ NO MATCH`);
      }
    }
    
    console.log("\n🌊 ====================================");
  }
};

console.log("🌊 OCEAN Debug Helper loaded. Available commands:");
console.log("  oceanDebug.checkStatus()    - Check OCEAN status");
console.log("  oceanDebug.test(word, sentence) - Test a word/sentence");
console.log("  oceanDebug.checkAnchor(word) - Check patterns for anchor");
console.log("  oceanDebug.runTests()       - Run all test cases");
console.log("  oceanDebug.waitReady()      - Wait for OCEAN to load");
console.log("  oceanDebug.testBeLemmatization() - Test 'be' verb forms");
