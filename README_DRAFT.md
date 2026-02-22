# 🌊 The0cean - Advanced English Learning Extension

> A powerful Chrome extension for English learners with intelligent dictionary lookup, phrasal verb detection, Anki integration, and more.

[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)](https://github.com/yourusername/the0cean)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-orange.svg)](https://chrome.google.com/webstore)

---

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Core Features](#-core-features)
  - [Dictionary Lookup](#1-dictionary-lookup)
  - [OCEAN Engine (Phrasal Verbs & Idioms)](#2-ocean-engine-phrasal-verbs--idioms)
  - [Anki Integration](#3-anki-integration)
  - [Audio & Pronunciation](#4-audio--pronunciation)
  - [Images & Visual Learning](#5-images--visual-learning)
- [Settings & Configuration](#-settings--configuration)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [FAQ](#-faq)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 🎯 Core Capabilities
- **Instant Dictionary Lookup** - Hover or use keyboard shortcuts to look up words
- **OCEAN Engine** - Intelligent phrasal verb and idiom detection with context awareness
- **Dual Dictionary Support** - Cambridge Dictionary + English-Vietnamese Dictionary pre-installed
- **Anki Integration** - One-click card creation with auto-field mapping
- **Forvo Audio** - Native speaker pronunciations from Forvo.com
- **Text-to-Speech** - Multiple TTS voices with customizable settings
- **Image Search** - Visual learning with automatic image fetching
- **Sentence Extraction** - Context-aware sentence detection and translation
- **Frequency Lists** - Word frequency data from Wikipedia and TV/Movies

### 🚀 Advanced Features
- **Smart Lemmatization** - Recognizes word forms (was → be, handed → hand)
- **Possessive Placeholder** - Matches all possessive forms (my/your/his/her/its/our/their/one's)
- **Auto Field Mapping** - Intelligent Anki field detection
- **Duplicate Detection** - Prevents duplicate Anki cards
- **Batch Operations** - Update multiple Anki notes at once
- **Customizable Shortcuts** - Fully configurable keyboard shortcuts
- **Dark Mode Support** - Automatic theme switching

---

## 📦 Installation

### Method 1: Chrome Web Store (Recommended)
1. Visit [Chrome Web Store](#) (link coming soon)
2. Click "Add to Chrome"
3. Done! Extension is ready to use

### Method 2: Manual Installation (Developer Mode)
1. Download the latest release from [Releases](https://github.com/yourusername/the0cean/releases)
2. Extract the ZIP file
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" (top right)
5. Click "Load unpacked"
6. Select the extracted folder
7. Done!

### First-Time Setup
On first install, the extension automatically:
- ✅ Imports Cambridge Dictionary
- ✅ Imports English-Vietnamese Dictionary
- ✅ Imports Wikipedia Frequency List
- ✅ Configures default external dictionaries (Cambridge + Oxford)

**No manual setup required!** Just install and start using.

---

## 🚀 Quick Start

### Basic Usage (3 Steps)

1. **Look up a word**
   - Hover over any English word on a webpage
   - Or select text and press `Alt+Q` (default shortcut)

2. **View definition**
   - Popup shows definition, pronunciation, examples
   - Click tabs for Audio, Images, TTS, Sentence

3. **Add to Anki (Optional)**
   - Click "Add to Anki" button
   - Card is created automatically with all fields

### Video Tutorial
[📺 Watch 2-minute tutorial](#) (coming soon)

---

## 🎯 Core Features

### 1. Dictionary Lookup

#### Hover Mode (Default)
Simply hover your mouse over any word to see its definition.

#### Keyboard Shortcuts
- `Alt+Q` - Look up selected text
- `Esc` - Close popup
- `Esc Esc` (double tap) - Close all popups

#### Lookup Modes
You can change the trigger mode in Settings:
- **Hover** - Automatic on mouse hover
- **Ctrl+Hover** - Hold Ctrl while hovering
- **Alt+Hover** - Hold Alt while hovering
- **Shift+Hover** - Hold Shift while hovering

#### Supported Dictionaries
- Cambridge Dictionary (English definitions)
- English-Vietnamese Dictionary (translations)
- Custom dictionaries (import your own JSON)

---

### 2. OCEAN Engine (Phrasal Verbs & Idioms)

The OCEAN Engine is our intelligent system for detecting phrasal verbs and idioms in context.

#### What it does
- Detects phrasal verbs like "hand back", "give up", "look into"
- Recognizes idioms like "under your nose", "break the ice"
- Understands different verb forms (was/were/is/are → be)
- Matches possessive variations (my/your/his/her/its/our/their/one's)

#### Example
When you hover over "was" in:
> "The answer **was** right under my nose"

OCEAN detects the idiom **"be (right) under your nose"** and shows:
- ✅ Full idiom definition
- ✅ Context: "was right under my nose"
- ✅ All variations (be/is/was/were under my/your/his/her nose)

#### How it works
1. **Lemmatization** - Converts word to base form (was → be)
2. **Pattern Matching** - Searches for phrasal patterns
3. **Context Analysis** - Verifies match in sentence context
4. **Priority Ranking** - Shows most relevant match first

---

### 3. Anki Integration

Create Anki flashcards directly from the popup with one click.

#### Prerequisites
1. Install [Anki Desktop](https://apps.ankiweb.net/)
2. Install [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on
3. Keep Anki running in background

#### Setup (One-Time)
1. Open extension settings (click extension icon → Options)
2. Go to "Anki" tab
3. Select your deck and note type
4. Field mapping is **automatic** - just verify it's correct
5. Click "Save"

#### Creating Cards
1. Look up a word
2. Click "Add to Anki" button in popup
3. Done! Card is created with:
   - Target word
   - Definition
   - Example sentence
   - Sentence translation (if enabled)
   - Audio (Forvo)
   - Images (if enabled)

#### Advanced Features
- **Duplicate Detection** - Warns if card already exists
- **Update Existing** - Update cards instead of creating duplicates
- **Batch Update** - Select multiple notes to update at once
- **View in Browser** - Jump to Anki browser after adding

---

### 4. Audio & Pronunciation

#### Forvo Audio
- Native speaker pronunciations from Forvo.com
- Multiple speakers per word
- Country/region information
- Auto-play options

#### Text-to-Speech (TTS)
- Browser's built-in TTS voices
- Multiple voice selection
- Sentence reading
- Customizable speed and pitch

#### Audio Settings
- **Forvo Mode**: Auto-load or Manual
- **Auto-play Count**: 0-3 pronunciations
- **TTS Voices**: Select up to 3 voices
- **Voice Selection**: Filter by country/language

---

### 5. Images & Visual Learning

Automatic image fetching for visual learners.

#### Features
- Google Images integration
- Auto-load first N images
- Click to view full size
- Add to Anki cards

#### Settings
- **Enable/Disable**: Toggle image fetching
- **Max Images**: 5-20 images
- **Auto-load Count**: 1-5 images
- **Retry Limit**: 0-10 retries for failed images

---

## ⚙️ Settings & Configuration

### Dictionary Settings
- **Import Dictionary**: Add custom JSON dictionaries
- **Lookup Mode**: Hover, Ctrl+Hover, Alt+Hover, Shift+Hover
- **Result Mode**: Stacked (all dictionaries) or First Match
- **Default Feature**: Which tab opens first (Forvo/Images/TTS/Sentence)

### Anki Settings
- **Deck**: Select target deck
- **Note Type**: Select note type (model)
- **Field Mapping**: Auto-mapped, verify and adjust
- **Allow Duplicates**: Enable/disable duplicate detection
- **Tags**: Add custom tags to cards

### Audio Settings
- **Forvo**: Enable/disable, auto-play count
- **TTS**: Select voices, auto-play count
- **Voice Selection**: Filter by country, test voices

### Sentence Settings
- **Show Sentence**: Display example sentence
- **Show Translation**: Display sentence translation
- **Auto-translate**: Use Google Translate

### Images Settings
- **Enable Images**: Toggle image fetching
- **Max Links**: Number of images to fetch
- **Auto-load**: Number of images to load automatically

### Other Dictionaries
Add external dictionary links with placeholders:
- `{term}` - The looked-up word
- `{sentence}` - The example sentence

Example:
```
https://dictionary.cambridge.org/dictionary/english/{term}
https://www.oxfordlearnersdictionaries.com/definition/english/{term}
```

---

## ⌨️ Keyboard Shortcuts

### Default Shortcuts
| Action | Shortcut | Description |
|--------|----------|-------------|
| Look up | `Alt+Q` | Look up selected text |
| Close popup | `Esc` | Close current popup |
| Close all | `Esc Esc` | Double-tap to close all popups |
| Next audio | `D` | Next Forvo pronunciation |
| Previous audio | `A` | Previous Forvo pronunciation |
| Play audio | `S` | Play current audio |
| Next image | `→` | Next image |
| Previous image | `←` | Previous image |
| Add to Anki | `Ctrl+Enter` | Create Anki card |

### Customization
1. Go to Settings → Dictionary → Shortcuts
2. Click on any shortcut to edit
3. Press new key combination
4. Click "Save"

---

## ❓ FAQ

### Q: Do I need an internet connection?
**A:** Yes, for:
- Forvo audio (requires internet)
- Image fetching (requires internet)
- Google Translate (requires internet)

No internet needed for:
- Dictionary lookup (works offline)
- TTS (browser built-in)
- Anki integration (local)

### Q: Can I use my own dictionaries?
**A:** Yes! Go to Settings → Dictionary → Import Dictionary and upload your JSON file. Supported formats:
- Migaku Dictionary JSON
- Yomitan Dictionary ZIP

### Q: How do I add Vietnamese translations?
**A:** The English-Vietnamese dictionary is pre-installed. If you need more:
1. Find a compatible dictionary JSON
2. Import via Settings → Dictionary

### Q: Why isn't Anki working?
**A:** Check:
1. ✅ Anki Desktop is running
2. ✅ AnkiConnect add-on is installed
3. ✅ Deck and note type are selected in settings
4. ✅ Field mapping is configured

### Q: Can I disable certain features?
**A:** Yes! All features can be toggled in Settings:
- Forvo audio
- Images
- TTS
- Sentence translation
- Auto-translate

### Q: How do I report bugs?
**A:** Open an issue on [GitHub Issues](https://github.com/yourusername/the0cean/issues) with:
- Chrome version
- Extension version
- Steps to reproduce
- Screenshots (if applicable)

---

## 🔧 Troubleshooting

### Popup not showing
1. Check lookup mode in Settings (Hover vs Ctrl+Hover)
2. Try refreshing the page
3. Check if extension is enabled in `chrome://extensions/`

### Anki connection failed
1. Open Anki Desktop
2. Go to Tools → Add-ons → AnkiConnect → Config
3. Verify `webBindAddress` is `127.0.0.1`
4. Restart Anki

### Audio not playing
1. Check Forvo mode (Auto vs Manual)
2. Try clicking "Load audio" button
3. Check internet connection
4. Try TTS as fallback

### Images not loading
1. Check if images are enabled in Settings
2. Check internet connection
3. Try increasing retry limit
4. Some words may not have images

### Dictionary not found
1. Go to Settings → Dictionary
2. Check if dictionary is imported
3. Try re-importing dictionary
4. Check console for errors (F12)

---

## 🤝 Contributing

We welcome contributions! Here's how:

### Reporting Bugs
1. Check [existing issues](https://github.com/yourusername/the0cean/issues)
2. Create new issue with detailed description
3. Include steps to reproduce

### Suggesting Features
1. Open a [feature request](https://github.com/yourusername/the0cean/issues/new)
2. Describe the feature and use case
3. Explain why it would be useful

### Code Contributions
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Development Setup
```bash
# Clone repository
git clone https://github.com/yourusername/the0cean.git
cd the0cean

# Install dependencies (if any)
npm install

# Load extension in Chrome
# 1. Go to chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the project folder
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Cambridge Dictionary** - Dictionary data
- **Forvo** - Audio pronunciations
- **Anki** - Flashcard system
- **AnkiConnect** - Anki integration
- **Contributors** - Everyone who helped improve this extension

---

## 📞 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/yourusername/the0cean/issues)
- **Email**: support@the0cean.com
- **Discord**: [Join our community](#) (coming soon)

---

## 🗺️ Roadmap

### Version 1.1 (Coming Soon)
- [ ] Chrome Web Store release
- [ ] Firefox support
- [ ] More dictionary sources
- [ ] Offline mode improvements

### Version 1.2
- [ ] Mobile app
- [ ] Cloud sync
- [ ] Custom themes
- [ ] Advanced statistics

### Version 2.0
- [ ] AI-powered definitions
- [ ] Personalized learning paths
- [ ] Gamification features
- [ ] Social learning features

---

<div align="center">

**Made with ❤️ for English learners**

[⭐ Star us on GitHub](https://github.com/yourusername/the0cean) | [🐛 Report Bug](https://github.com/yourusername/the0cean/issues) | [💡 Request Feature](https://github.com/yourusername/the0cean/issues)

</div>
