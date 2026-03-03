// OCEAN ENGINE - Test Script
// Run this in browser console to test OCEAN functionality

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

// Auto-run if in browser console
if (typeof window !== 'undefined') {
  console.log("🌊 OCEAN Test Script Loaded. Run testOceanEngine() to start tests.");
}
