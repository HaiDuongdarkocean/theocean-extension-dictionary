# Ocean Dictionary Framework: Architectural Understanding (Draft v1)

Muc tieu cua he thong nay: nhan nhieu dinh dang tu dien/tan suat khac nhau (Yomitan, Migaku, ...), sau do chuyen tat ca ve mot chuan duy nhat ("Ocean Extension Format") de:

- Quan ly theo resource (bat/tat, uu tien, xoa, doi ten).
- Tra cuu nhanh, de debug.
- Tach dinh nghia thanh cac "meaning atom" (1 y chinh) de nguoi hoc focus.

Tai lieu nay mo ta kien truc theo cac muc: management, import, chunking, inheritance, normalization, atomic splitter, query/merge strategy, DB schema, integration points.

---

## 1) Management (Multi-tier Resource Management)

### 1.1. Khai niem "Resource"
Moi goi du lieu nhap vao duoc coi la 1 resource.

- Resource Dictionary: du lieu giai nghia (term -> meanings).
- Resource Frequency: du lieu tan suat (term -> rank/freq).

### 1.2. Yeu cau quan ly
- CRUD: Import, Rename, Reorder priority, Toggle enabled, Delete.
- Uu tien (priority): so nho hon duoc uu tien cao hon.
- Bat/tat (enabled): tat resource khong duoc tham gia tra cuu, nhung du lieu van con.
- Thong ke (stats) de hien thi: so entry, co audio/pronunciation hay khong, dung luong uoc tinh.

### 1.3. Mo hinh UI quan ly (Options -> Dictionary Tab)
Goi y cac nhom UI:
- Import area: keo tha ZIP/JSON, hien format du doan, nut Import.
- Resource list (dictionary): toggle, priority, rename, delete.
- Resource list (frequency): tuong tu.
- Debug/Test lookup box: nhap term, hien ket qua merge + atoms + freq overlay.

---

## 2) Import (Data Source -> Ocean Format)

### 2.1. Dau vao
- ZIP: Yomitan/Migaku (dong goi nhieu file).
- JSON: Migaku co the la 1 file JSON (array objects / array strings).

### 2.2. 3 tang xu ly (layered importer)
1. BaseImporter
   - Doc input (ZIP/JSON), detect format.
   - Lay metadata (title, revision, ...).
   - Orchestrate parse + batch write.
   - Bao tien do, co the cancel.
2. Sub-Importer (format-specific)
   - YomitanImporter: parse index.json, term_bank_*.json, term_meta_bank_*.json.
   - MigakuImporter: parse array-of-objects dictionary va array-of-strings frequency.
3. Normalizer (Oceanizer)
   - Chuyen du lieu ve Ocean Extension Format.
   - Chuan hoa term key.
   - Chay Atomic Splitter de tao meaning atoms.

### 2.3. Gatekeeper / Identification (quick scan)
Muc tieu: quyet dinh Sub-Importer nao se chay.

- Yomitan (dictionary): ZIP co `index.json` va cac file `term_bank_*.json`.
- Yomitan (frequency): ZIP co `term_meta_bank_*.json` voi record `["term","freq",number]`.
- Migaku (dictionary): JSON array objects co key `term`, `definition`, `pronunciation` (thuong co).
- Migaku (frequency): JSON array strings (rank list).

Neu khong tim duoc metadata title tu file, fallback = ten file ZIP/JSON.

---

## 3) Chunking (Performance, RAM Safety)

### 3.1. Van de
Yomitan term_bank co the rat lon. Doc 1 lan va JSON.parse toan bo co the gay tang RAM, UI lag, hoac crash.

### 3.2. Muc tieu chunking
- Parse theo tung file nho trong ZIP (term_bank_1.json, term_bank_2.json, ...).
- Batch insert vao IndexedDB theo dot (vd 500-2000 records/transaction).
- Yield ve event loop (setTimeout/await) de UI cap nhat progress.

### 3.3. Chien luoc chunking (khong cam ket implementation)
Option A (don gian, ban dau):
- Doc tung file term_bank_N.json -> JSON.parse -> batch write.
- Du cho nhieu bo tu dien, nhung co the cham hoac RAM cao neu file qua lon.

Option B (nang cao):
- Stream parse JSON (incremental parser) de khong can JSON.parse toan bo.
- Phuc vu dataset rat lon.

Kien truc nen cho phep thay doi A -> B ma khong doi Ocean Format.

---

## 4) Inheritance / Reuse (BaseImporter + Sub-importers)

### 4.1. BaseImporter responsibilities
- Open source (ZIP/JSON).
- Detect format, route to Sub-Importer.
- Progress callbacks: onStart, onFile, onBatch, onDone, onError.
- Utilities:
  - cleanHTML / sanitize (neu can).
  - normalizeTermKey().
  - batchWrite helpers.

### 4.2. Sub-Importer responsibilities
- Parse raw structure -> intermediate entries (chua split atom).
- Khong viet thang vao DB theo Ocean shape neu chua qua Normalizer.

### 4.3. Normalizer responsibilities
- Intermediate -> Ocean Format v1 (enforce contract).
- Atomic Splitter.
- Consistent field naming (term/reading/pronunciation/pos/examples/audio...).

---

## 5) Normalization (Ocean Extension Format Contract)

### 5.1. Ocean Format v1 (de xuat)

#### Resource metadata (store: resources)
- id: string (uuid)
- kind: "dictionary" | "frequency"
- sourceFormat: "yomitan" | "migaku" | "ocean"
- title: string
- revision: string | null
- enabled: boolean
- priority: number
- createdAt, updatedAt: number (epoch ms)
- stats: object (optional)
- settings: object (optional, per-resource overrides)

#### Dictionary entry (store: dict_entries)
- resourceId: string
- termKey: string (normalized key, vd lowercase + trim)
- displayTerm: string (giu nguyen neu can)
- reading: string
- pronunciation: string
- pos: string
- meaningAtoms: MeaningAtom[]
- raw: object (optional, de debug/import re-run)

#### MeaningAtom
- atomId: string (stable hash)
- head: string (vd "1. adjective", "noun [U]") (optional)
- glossHtml: string (preferred) hoac glossText
- examples: string[] (optional)
- tags: string[] (optional)

#### Frequency entry (store: freq_entries)
- resourceId: string
- termKey: string
- value: number
- valueType: "rank" | "freq"

### 5.2. Term key normalization
Muc tieu: tat ca query dung cung 1 rule.

De xuat v1:
- lowercase
- trim whitespace
- remove trailing punctuation (.,!?;:"()...) khi tra cuu
- optional: unicode normalization (NFKC) neu gap ky tu dac biet

Rule nay can dong bo giua:
- importer (luc ghi DB)
- content script (luc tra cuu)

---

## 6) Atomic Splitter (Split "Definition Block" -> Meaning Atoms)

### 6.1. Muc tieu
Chuyen `definition` (mot chuoi HTML dai) thanh:
- meaningAtoms[]: moi atom tuong ung 1 y chinh

### 6.2. Inputs theo nguon
- Migaku: `definition` la HTML co dang:
  - `1.adjective<br>...<br><br>2.adjective<br>...`
- Yomitan: definitions co the la array san (tuy dict), hoac string/HTML.

### 6.3. Split pipeline (heuristics v1)
1. Canonicalize HTML:
   - normalize `<br>`/`<br/>`
   - collapse whitespace
2. Find boundaries:
   - numbered headings: `(^|<br>|\\n)\\s*(\\d+)[\\.)]\\s*`
   - double breaks: `<br><br>` (secondary)
   - list items: `<li>` (secondary)
3. Build atoms:
   - Neu co heading "1.adjective": head = "1. adjective", body = phan sau.
   - Neu khong co heading: 1 atom duy nhat.
4. Cleanup:
   - remove empty atoms
   - trim, keep safe HTML

### 6.4. Per-resource overrides
Mot so dict split khac nhau. Nen cho phep `resource.settings.splitter`:
- preferNumberedSplit: true/false
- minAtomLength
- keepNumberPrefix

### 6.5. Debuggability
Luon luu `raw.definition` (hoac raw entry) de:
- xem splitter sai o dau
- cho phep re-normalize neu cap nhat splitter

---

## 7) Query / Merge Strategy (Tiered Lookup)

### 7.1. Input
Term tu UI (popup lookup) + optional reading/context.

### 7.2. Resource selection
- Load resources where enabled = true
- Sort by priority asc (1 truoc, 2 sau)

### 7.3. Dictionary merge modes
De xuat 2 mode (co the la setting):
- first_match: return dictionary entry tu resource uu tien cao nhat co ket qua.
- stacked: return list ket qua tu nhieu resource (co the gioi han N).

### 7.4. Frequency overlay
Chay song song:
- voi moi frequency resource enabled:
  - lookup freq_entries(termKey)
  - attach to UI (rank badge, freq number, color scale)

### 7.5. Atomic meaning focus
Trong popup, mac dinh:
- show atom 1 (hoac atom duoc user chon lan truoc)
- co next/prev atoms
- co list atoms (collapsed) neu can

---

## 8) DB Schema (IndexedDB)

### 8.1. Database
- name: OceanDictionaryDB (de xuat)
- version: bump khi thay schema

### 8.2. Object stores
1. resources
   - keyPath: id
   - indexes:
     - kind
     - enabled
     - priority
2. dict_entries
   - key: auto hoac compound string `${resourceId}:${termKey}`
   - indexes:
     - termKey (de stacked mode nhanh)
     - resourceId+termKey (compound) (de first_match nhanh)
3. freq_entries
   - key: `${resourceId}:${termKey}`
   - indexes:
     - termKey
     - resourceId+termKey
4. import_jobs (optional)
   - tracking progress, error, diagnostics

### 8.3. Ghi chu ve chrome.storage vs IndexedDB
- chrome.storage.sync: chi nen chua settings UI (enabled, priority, user prefs) neu nho.
- IndexedDB: chua data lon (entries/freq).

Neu muon 1 nguon su that:
- resources + data deu o IndexedDB
- chrome.storage chi chua UI prefs (theme, lookup mode) khong quan ly data.

---

## 9) Extension Integration Points (MV3)

### 9.1. Options UI
Chuc nang:
- Import ZIP/JSON -> call importer pipeline
- CRUD resources
- Save settings (lookup trigger mode, stacked/first_match, ...)

### 9.2. Background service worker
Chuc nang:
- Message handlers:
  - lookup term -> query IndexedDB
  - translate -> external fetch (neu enabled)
  - forvo fetch -> external fetch (neu enabled)
  - anki add -> call ankiConnect
- Co the la noi dat "DictionaryQueryService" de content script don gian.

### 9.3. Content script (popupDictionary)
Chuc nang:
- Capture selection/hover/shortcut (theo user settings).
- Send message lookup to background.
- Render popup UI:
  - show atoms
  - show freq overlay
  - audio controls (forvo/tts) theo settings

### 9.4. Data flow summary
Import:
ZIP/JSON -> BaseImporter -> SubImporter -> Normalizer(Atomic Splitter) -> IndexedDB

Lookup:
ContentScript -> Background(lookup) -> IndexedDB(query resources+entries) -> Response -> Popup UI

---

## Appendix A: Source format notes (as provided)

### A.1. Yomitan dictionary
- index.json:
  - {"title":"...","format":3,"revision":"...","sequenced":false/true}
- term_bank_1.json (array-of-arrays):
  - ["term","reading",...,"definitionsArray",...]

### A.2. Yomitan frequency
- term_meta_bank_1.json:
  - ["term","freq",112400]

### A.3. Migaku dictionary
- any.json:
  - [{ term, altterm, pronunciation, definition(HTML), pos, examples, audio }, ...]

### A.4. Migaku frequency
- any.json:
  - ["the","of","and",...]

