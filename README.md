# Intelligent Translation Assistant

A Chrome extension that provides intelligent translation and grammar analysis with context awareness.

## Features

- Double Ctrl key press to translate text at cursor (auto-detects language)
- Triple Ctrl key press to translate selected text
- Single Shift press to analyze grammar of selected English text
- Double Shift press to get detailed grammar correction for English text
- Single Ctrl press to close any active popup
- Smart popup positioning based on viewport
- Works in any text input field, textarea, or contentEditable element
- Visual feedback with loading and success/error notifications

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your Chrome toolbar

## Setup

1. Click the extension icon to open the popup menu
2. Enter your DeepSeek API key
3. Click "Save Settings" to store your API key securely

## Usage

### Translation Features

- **Translate text at cursor**: Double-press the Ctrl key
  - Automatically detects Chinese or English
  - Replaces the text with its translation

- **Translate selected text**: Select text and triple-press the Ctrl key
  - Shows translation in a popup below the selection
  - Supports both Chinese-to-English and English-to-Chinese

### Grammar Features

- **Analyze grammar**: Select English text and press Shift key
  - Shows modular sentence structure analysis
  - Displays core components (Subject, Verb, Object) and modifiers

- **Grammar correction**: Select English text and double-press Shift key
  - Shows corrected text with optimized expressions
  - Provides detailed explanation of each correction
  - Teaches proper grammar rules and natural expressions

### Popup Management

- **Close popups**: Single press Ctrl key to close any active popup
- All popups position themselves intelligently based on viewport constraints

## Technical Details

- Built with JavaScript using Manifest V3
- Uses content scripts to interact with webpage text fields
- Service worker for background API communication
- Secure API key storage with chrome.storage.local
- Translation caching for improved performance

## Requirements

- Google Chrome browser (version 88 or later)
- DeepSeek API key

## License

MIT 
