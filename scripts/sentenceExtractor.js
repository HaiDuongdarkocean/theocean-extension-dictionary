console.log("SentenceExtractor loaded");

function extractBlockTextFromRange(range) {
//   console.log("extractBlockTextFromRange::Received range:", range);
  if (!range || !range.startContainer) return "";

  const textContent = range.startContainer.textContent;
//   console.log("extractBlockTextFromRange::textContent:", textContent);

  return textContent || null;
}

const SentenceConfig = {
  minLength: 20,
  punctuation: [
    ".",
    "!",
    "?",
    "...",
    "?!",
    "!!",
    "。",
    "！",
    "？", // future support
    ":",
    ";",
    "\n",
  ],
};

function buildSentenceRegex() {
  const escaped = SentenceConfig.punctuation.map((p) =>
    p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );

  return new RegExp(`(${escaped.join("|")})`, "g");
}

function splitIntoSentences(text) {
  const regex = buildSentenceRegex();
  console.log("Regex:", regex);
  const parts = text.split(regex);
  console.log("Parts:", parts);

  const sentences = [];

  for (let i = 0; i < parts.length; i += 2) {
    let sentence = parts[i] || "";
    const punctuation = parts[i + 1] || "";

    sentence = (sentence + punctuation).trim();

    if (sentence.length > 0) {
      sentences.push(sentence);
    }
  }

  return sentences;
}

function findSentenceContainingOffset(text, offset) {
  const sentences = splitIntoSentences(text);

  let currentIndex = 0;

  for (let sentence of sentences) {
    const start = currentIndex;
    const end = currentIndex + sentence.length;

    if (offset >= start && offset <= end) {
      return {
        sentence,
        index: sentences.indexOf(sentence),
        sentences,
      };
    }

    currentIndex = end;
  }

  return null;
}

function refineShortSentence(result) {
  if (!result) return "";

  let { sentence, index, sentences } = result;

  while (
    sentence.length < SentenceConfig.minLength &&
    index < sentences.length - 1
  ) {
    index++;
    sentence += " " + sentences[index];
  }

  return sentence.trim();
}

function extractFinalSentence(range) {
//   console.log("sentenceExtractor::Extracting sentence from range:", range);
  const blockText = extractBlockTextFromRange(range);
//   console.log("setenteceEtractor::Extracted block text:", blockText);

  if (!blockText) return "";

  const offset = range.startOffset;

  const result = findSentenceContainingOffset(blockText, offset);

  const finalSentence = refineShortSentence(result);

  return finalSentence;
}

// // const sentence = extractFinalSentence(range);
// const TEST_DATA = [
//   {
//     description: "Câu ngắn cần nối",
//     text: "Woww! Woww! I love you so much.",
//   },
//   {
//     description: "Ellipsis",
//     text: "I was thinking... maybe we should try again.",
//   },
//   {
//     description: "Viết tắt",
//     text: "Mr. Smith went to Washington. He met Dr. Brown.",
//   },
//   {
//     description: "Nhiều dấu liên tiếp",
//     text: "What?! Are you serious!! This can't be real.",
//   },
//   {
//     description: "Số thập phân",
//     text: "The value is 3.14. It is important in math.",
//   },
//   {
//     description: "Emoji",
//     text: "I can't believe it 😱! This is amazing.",
//   },
//   {
//     description: "Chấm hỏi + chấm than",
//     text: "Really?! You did that? Incredible!",
//   },
//   {
//     description: "Câu ngắn cuối đoạn",
//     text: "Hello! Yes. No. Absolutely fantastic performance tonight.",
//   },
//   {
//     description: "Nhiều dòng",
//     text: `This is the first line.
// It continues here! Then something else happens.
// Finally, we end here.`,
//   },
//   {
//     description: "Chữ in hoa + nhiều câu ngắn",
//     text: "NO! STOP! Don't move any further.",
//   },
// ];

// function runSentenceTests() {
//   TEST_DATA.forEach((item) => {
//     console.log("======");
//     console.log("Case:", item.description);
//     console.log("Original:", item.text);

//     const sentences = splitIntoSentences(item.text);

//     console.log("Split result:", sentences);
//   });
// }

// runSentenceTests();

// function simulateOffsetTest(text, offset) {
//   const fakeRange = {
//     startContainer: {
//       nodeType: Node.TEXT_NODE,
//       textContent: text,
//       parentNode: {
//         innerText: text,
//       },
//     },
//     startOffset: offset,
//   };

//   const sentence = extractFinalSentence(fakeRange);

//   console.log("Offset:", offset);
//   console.log("Result sentence:", sentence);
// }

// simulateOffsetTest("Woww! Woww! I love you so much.", 15);
