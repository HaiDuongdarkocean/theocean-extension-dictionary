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

// Global test function for console
async function testOceanEngine() {
  console.log("🌊 ========== OCEAN ENGINE TEST ==========");
  
  // Test 1: Check if modules loaded
  console.log("\n📦 Test 1: Module Loading");
  if (window.oceanMatcher) {
    console.log("✅ oceanMatcher loaded");
  } else {
    console.error("❌ oceanMatcher NOT loaded");
    return;
  }
  
  // Test 2: Test regex compilation
  console.log("\n🔧 Test 2: Regex Compilation");
  const { compilePhrasalPattern, extractAnchorWord, calculatePriority } = window.oceanCompiler;
  
  const testTerms = [
    "hand back something",
    "hand sth back",
    "a big/great girl's blouse",
    "a bird in the hand (is worth two in the bush)",
    "take sth into account"
  ];
  
  testTerms.forEach(term => {
    const anchor = extractAnchorWord(term);
    const regex = compilePhrasalPattern(term);
    const priority = calculatePriority(term);
    console.log(`Term: "${term}"`);
    console.log(`  Anchor: ${anchor}`);
    console.log(`  Priority: ${priority}`);
    console.log(`  Regex: ${regex}`);
  });
  
  // Test 3: Test pattern matching
  console.log("\n🎯 Test 3: Pattern Matching");
  const { extractSentence, extractWordAtIndex, findPhrasalMatch } = window.oceanMatcher;
  
  const testSentences = [
    { text: "He handed the old photograph back to her", index: 3, word: "handed" },
    { text: "She handed it back immediately", index: 4, word: "handed" },
    { text: "A bird in the hand is worth two in the bush", index: 2, word: "bird" }
  ];
  
  for (const test of testSentences) {
    console.log(`\nSentence: "${test.text}"`);
    const sentence = extractSentence(test.text, test.index);
    const word = extractWordAtIndex(test.text, test.index);
    console.log(`  Extracted sentence: "${sentence}"`);
    console.log(`  Extracted word: "${word}"`);
    
    try {
      const match = await findPhrasalMatch(word, sentence);
      if (match) {
        console.log(`  ✅ Match found: "${match.data.term}"`);
        console.log(`  Detected: "${match.data.detectedInSentence}"`);
      } else {
        console.log(`  ℹ️ No phrasal match (will use single word)`);
      }
    } catch (error) {
      console.error(`  ❌ Error:`, error);
    }
  }
  
  // Test 3b: Test scoring algorithm (NEW)
  console.log("\n🎯 Test 3b: Scoring Algorithm (Phrasal Verb Priority)");
  const scoringTests = [
    { 
      text: "I spent all morning looking for the book, and it was right under my nose the whole time.",
      index: 40,
      word: "was",
      expectedTerm: "be (right) under your nose",
      description: "Should match 'be (right) under your nose' instead of 'be (really) something'"
    },
    {
      text: "That would be something special",
      index: 18,
      word: "be",
      expectedTerm: "be (really) something",
      description: "Should match 'be (really) something' when context is about being special"
    }
  ];
  
  for (const test of scoringTests) {
    console.log(`\n📋 ${test.description}`);
    console.log(`  Sentence: "${test.text}"`);
    console.log(`  Target word: "${test.word}"`);
    console.log(`  Expected: "${test.expectedTerm}"`);
    
    try {
      const match = await findPhrasalMatch(test.word, test.text);
      if (match) {
        const isCorrect = match.data.term === test.expectedTerm;
        const icon = isCorrect ? "✅" : "❌";
        console.log(`  ${icon} Got: "${match.data.term}"`);
        console.log(`     Score: ${match.data.score}`);
        console.log(`     Detected: "${match.data.detectedInSentence}"`);
      } else {
        console.log(`  ❌ No match found`);
      }
    } catch (error) {
      console.error(`  ❌ Error:`, error);
    }
  }
  
  // Test 4: Check database
  console.log("\n💾 Test 4: Database Check");
  const { countPhrasalPatterns, getAllAnchorWords } = window.oceanStorage;
  
  try {
    const count = await countPhrasalPatterns();
    console.log(`  Total phrasal patterns: ${count}`);
    
    if (count > 0) {
      const anchors = await getAllAnchorWords();
      console.log(`  Unique anchor words: ${anchors.length}`);
      console.log(`  Sample anchors:`, anchors.slice(0, 10));
    } else {
      console.warn(`  ⚠️ No phrasal patterns found. Import a dictionary first!`);
    }
  } catch (error) {
    console.error(`  ❌ Database error:`, error);
  }
  
  console.log("\n🌊 ========== TEST COMPLETE ==========");
}

// Make it available globally
window.testOceanEngine = testOceanEngine;
