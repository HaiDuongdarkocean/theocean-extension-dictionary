// import { loadAnkiConfig, ankiInvoke } from "./ankiSettings.js";

function buildFieldsFromMapping(extensionData, config) {

  const fields = {};

  const mapping = config.fieldMapping || {};

  Object.keys(mapping).forEach(extField => {

    const modelField = mapping[extField];

    if (!modelField) return;

    switch (extField) {

      case "Target word":
        fields[modelField] = extensionData.term || "";
        break;

      case "Definition":
        fields[modelField] = extensionData.definition || "";
        break;

      case "Sentence":
        fields[modelField] = extensionData.sentence || "";
        break;

      case "Sentence translation":
        fields[modelField] = extensionData.sentenceTranslation || "";
        break;

      case "Example sentences":
        fields[modelField] = extensionData.examples || "";
        break;

      case "Notes":
        fields[modelField] = extensionData.notes || "";
        break;

      case "Images":
        fields[modelField] = extensionData.images || "";
        break;

      case "Word audio":
        fields[modelField] = extensionData.wordAudio || "";
        break;

      case "Sentence audio":
        fields[modelField] = extensionData.sentenceAudio || "";
        break;

      default:
        fields[modelField] = "";
    }
  });

  return fields;
}

async function buildNoteObject(extensionData) {

  const config = await loadAnkiConfig();

  const fields = buildFieldsFromMapping(extensionData, config);

  return {
    deckName: config.deckName,
    modelName: config.modelName,
    fields,
    options: {
      allowDuplicate: false
    },
    tags: config.tags || []
  };
}

async function addNoteToAnki(extensionData) {

  try {

    const note = await buildNoteObject(extensionData);

    const result = await ankiInvoke("addNote", {
      note
    });

    if (result.error) {
      alert("❌ Anki lỗi: " + result.error);
    } else {
      alert("✅ Đã thêm vào Anki!");
    }

  } catch (err) {
    alert("❌ Không kết nối được Anki");
  }
}

// export {
//     addNoteToAnki,
//     buildFieldsFromMapping,
//     buildNoteObject
// }