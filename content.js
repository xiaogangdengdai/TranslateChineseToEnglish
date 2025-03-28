// Track key presses for detection
let ctrlPressCount = 0;
let shiftPressCount = 0;
let ctrlPressTimer = null;
let shiftPressTimer = null;
let activePopup = null;

// Keep track of active elements
let selectionRange = null;
let lastSelectedText = null;
let lastSelection = null;

// Enhanced keyboard event handling
const KEY_CTRL = 'Control';
const KEY_SHIFT = 'Shift';
const DOUBLE_KEY_TIMEOUT = 500; // ms

// Global variables for UI state management
let buttonsTimeout = null;
let isProcessingAction = false;

// Add a general keyboard event listener for debugging
window.addEventListener('keydown', function(e) {
  console.log('Window keydown event:', e.key, 'Shift?', e.shiftKey, 'Ctrl?', e.ctrlKey);
});

// Use capture phase to ensure our listener runs first
document.addEventListener('keydown', handleKeyDown, true);
document.addEventListener('keyup', handleKeyUp, true);

// Improved keyboard handling
function handleKeyDown(e) {
  console.log('Document keydown event:', e.key, 'Shift key?', e.shiftKey, 'Ctrl key?', e.ctrlKey);
  
  // Handle Ctrl key press
  if (e.key === KEY_CTRL || (e.ctrlKey && !ctrlPressTimer)) {
    // Count Ctrl presses for double and triple detection
    ctrlPressCount++;
    console.log('Ctrl press detected, count:', ctrlPressCount);
    
    // Clear existing timer
    if (ctrlPressTimer) {
      clearTimeout(ctrlPressTimer);
    }
    
    // Set timer to reset counter after timeout
    ctrlPressTimer = setTimeout(() => {
      // Single Ctrl press after timeout - close any active popup
      if (ctrlPressCount === 1 && activePopup) {
        console.log('Single Ctrl detected, closing popup');
        removePopup(activePopup);
        activePopup = null;
      }
      
      ctrlPressCount = 0;
      ctrlPressTimer = null;
    }, DOUBLE_KEY_TIMEOUT);
    
    // Check for double press (translate text at cursor)
    if (ctrlPressCount === 2) {
      console.log('Double Ctrl detected, running cursor translation');
      handleCursorTranslation();
    }
    
    // Check for triple press (translate selected text)
    if (ctrlPressCount === 3) {
      console.log('Triple Ctrl detected, running selection translation');
      handleSelectionTranslation();
      ctrlPressCount = 0; // Reset immediately after triple press
      if (ctrlPressTimer) {
        clearTimeout(ctrlPressTimer);
        ctrlPressTimer = null;
      }
    }
  }
  
  // Handle Shift key press for grammar analysis and correction
  if (e.key === KEY_SHIFT || (e.shiftKey && !shiftPressTimer)) {
    // Count Shift presses
    shiftPressCount++;
    console.log('Shift press detected, count:', shiftPressCount);
    
    // Clear existing timer
    if (shiftPressTimer) {
      clearTimeout(shiftPressTimer);
    }
    
    // Set timer to reset counter and perform action after timeout
    shiftPressTimer = setTimeout(() => {
      // Single Shift press - trigger grammar analysis
      if (shiftPressCount === 1) {
        console.log('Single Shift detected, running grammar analysis');
        handleGrammarAnalysis();
      } else if (shiftPressCount === 2) {
        // Double Shift press - trigger grammar correction
        console.log('Double Shift detected, running grammar correction');
        handleGrammarCorrection();
      }
      
      shiftPressCount = 0;
      shiftPressTimer = null;
    }, DOUBLE_KEY_TIMEOUT);
  }
}

// Handle key up to prevent holding down the key 
function handleKeyUp(e) {
  // This helps prevent accidental triggers when key is held down
  console.log('Key up detected:', e.key);
}

// Handle mouseup to show quick action buttons
document.addEventListener('mouseup', (e) => {
  try {
    // Detect text selection
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      selectionRange = selection.getRangeAt(0);
      lastSelectedText = selection.toString().trim();
      lastSelection = selection;
      
      // Only show quick actions for non-trivial selections
      if (lastSelectedText && lastSelectedText.length > 3) {
        console.log('Text selected, showing quick action buttons');
        showQuickActionButtons(selection);
      }
    }
  } catch (error) {
    console.error('Error in mouseup event handler:', error);
  }
});

// Hide quick action buttons when clicking elsewhere
document.addEventListener('mousedown', (e) => {
  try {
    // If we clicked on a button or popup, don't hide
    if (e.target.closest('.quick-actions') || e.target.closest('.translate-popup')) {
      // Prevent losing selection when clicking on buttons
      e.preventDefault();
      return;
    }
    
    removeQuickActionButtons();
  } catch (error) {
    console.error('Error in mousedown event handler:', error);
  }
});

// Handle translation of text at cursor (original functionality)
async function handleCursorTranslation() {
  // Close any existing popup
  if (activePopup) {
    removePopup(activePopup);
    activePopup = null;
  }
  
  const { context, chinese, english, startPos, endPos, element, direction } = getTextAtCursor();
  
  if (!chinese && !english) return; // Exit if no text found
  
  try {
    // Show loading indicator
    const loadingIndicator = showLoadingIndicator(element);
    
    let sourceText, targetLang;
    
    // Determine translation direction
    if (direction === 'zh-to-en') {
      sourceText = chinese;
      targetLang = 'English';
    } else {
      sourceText = english;
      targetLang = 'Chinese';
    }
    
    // Send message to background script for API call
    const translation = await chrome.runtime.sendMessage({
      action: 'translate',
      context: context,
      text: sourceText,
      direction: direction
    });
    
    // Remove loading indicator
    removeLoadingIndicator(loadingIndicator);
    
    if (translation) {
      replaceText(element, startPos, endPos, translation);
      showSuccessToast(`Translated to ${targetLang}`, 'success');
    }
  } catch (error) {
    console.error('Translation error:', error);
    showErrorToast('Translation failed. Please try again.');
  }
}

// New function to handle translation of selected text
async function handleSelectionTranslation() {
  if (isProcessingAction) return; // Prevent multiple simultaneous calls
  isProcessingAction = true;
  
  console.log("handleSelectionTranslation started");
  removeQuickActionButtons();
  
  try {
    // Get selected text
    const selection = window.getSelection();
    const selectedText = selection && !selection.isCollapsed 
                      ? selection.toString().trim() 
                      : lastSelectedText;
    
    if (!selectedText) {
      console.error("No active selection found");
      showErrorToast('Please select text first');
      isProcessingAction = false;
      return;
    }
    
    console.log("Selected text for translation:", selectedText);
    
    // Close any existing popup
    if (activePopup) {
      removePopup(activePopup);
      activePopup = null;
    }
    
    // Determine language direction
    const direction = detectLanguage(selectedText);
    console.log("Detected language direction:", direction);
    
    // Show loading popup at selection
    const currentSelection = (selection && !selection.isCollapsed) ? selection : lastSelection;
    const loadingPopup = showLoadingPopup(currentSelection);
    console.log("Loading popup displayed");
    
    // Send message to background script for API call
    console.log("Sending message to background script with action:", "translate");
    const translation = await chrome.runtime.sendMessage({
      action: 'translate',
      text: selectedText,
      direction: direction
    });
    
    console.log("Received translation response:", translation);
    
    // Remove loading popup
    removePopup(loadingPopup);
    
    if (translation) {
      // Show translation popup
      activePopup = showTranslationPopup(currentSelection, selectedText, translation, direction);
      console.log("Translation popup displayed");
    } else {
      console.error("Translation response is empty");
      showErrorToast('Translation failed. Empty response received.');
    }
  } catch (error) {
    console.error('Translation error:', error);
    showErrorToast('Translation failed. Please try again.');
  } finally {
    isProcessingAction = false;
  }
}

// New function to handle grammar analysis
async function handleGrammarAnalysis() {
  if (isProcessingAction) return; // Prevent multiple simultaneous calls
  isProcessingAction = true;
  
  console.log('Grammar analysis function started');
  removeQuickActionButtons();
  
  try {
    // First check if API key exists
    const apiKeyResult = await chrome.storage.local.get(['deepseekApiKey']);
    console.log("API key check result:", apiKeyResult ? "Found" : "Not found");
    if (!apiKeyResult.deepseekApiKey) {
      showErrorToast('Please set your DeepSeek API key in the extension settings');
      isProcessingAction = false;
      return;
    }
    console.log('API key found, continuing...');
    
    // Get selected text (use saved selection if current selection is empty)
    const selection = window.getSelection();
    const selectedText = selection && !selection.isCollapsed ? 
                        selection.toString().trim() : 
                        lastSelectedText;
    
    console.log('Using selected text for grammar analysis:', selectedText);
    
    if (!selectedText) {
      console.error('No text selected for grammar analysis');
      showErrorToast('Please select text first');
      isProcessingAction = false;
      return;
    }
    
    // Close any existing popup
    if (activePopup) {
      removePopup(activePopup);
      activePopup = null;
    }
    
    // Only proceed if selected text is English
    const isEnglish = detectLanguage(selectedText) === 'en-to-zh';
    console.log('Is English text?', isEnglish);
    
    if (!isEnglish) {
      showErrorToast('Grammar analysis only works for English text');
      isProcessingAction = false;
      return;
    }
    
    // Use current selection or fallback to saved selection
    const currentSelection = (selection && !selection.isCollapsed) ? selection : lastSelection;
    
    // Show loading popup at selection
    const loadingPopup = showLoadingPopup(currentSelection);
    console.log('Sending API request for grammar analysis');
    
    // Send message to background script for API call
    console.log("Sending message to background script with action:", "analyze_grammar");
    const analysis = await chrome.runtime.sendMessage({
      action: 'analyze_grammar',
      text: selectedText
    });
    
    console.log('Received API response for grammar analysis:', analysis);
    
    // Remove loading popup
    removePopup(loadingPopup);
    
    if (analysis) {
      // Show grammar analysis popup
      activePopup = showGrammarPopup(currentSelection, selectedText, analysis);
      console.log("Grammar analysis popup displayed");
    } else {
      console.error('No analysis data received');
      showErrorToast('Grammar analysis failed. No data received.');
    }
  } catch (error) {
    console.error('Grammar analysis error:', error);
    showErrorToast('Grammar analysis failed. Please try again.');
  } finally {
    isProcessingAction = false;
  }
}

// New function to handle grammar correction
async function handleGrammarCorrection() {
  if (isProcessingAction) return; // Prevent multiple simultaneous calls
  isProcessingAction = true;
  
  console.log('Grammar correction function started');
  removeQuickActionButtons();
  
  try {
    // First check if API key exists
    const apiKeyResult = await chrome.storage.local.get(['deepseekApiKey']);
    console.log("API key check result:", apiKeyResult ? "Found" : "Not found");
    if (!apiKeyResult.deepseekApiKey) {
      showErrorToast('Please set your DeepSeek API key in the extension settings');
      isProcessingAction = false;
      return;
    }
    console.log('API key found, continuing...');
    
    // Get selected text (use saved selection if current selection is empty)
    const selection = window.getSelection();
    const selectedText = selection && !selection.isCollapsed ? 
                        selection.toString().trim() : 
                        lastSelectedText;
    
    console.log('Using selected text for grammar correction:', selectedText);
    
    if (!selectedText) {
      console.error('No text selected for grammar correction');
      showErrorToast('Please select text first');
      isProcessingAction = false;
      return;
    }
    
    // Close any existing popup
    if (activePopup) {
      removePopup(activePopup);
      activePopup = null;
    }
    
    // Only proceed if selected text is English
    const isEnglish = detectLanguage(selectedText) === 'en-to-zh';
    console.log('Is English text?', isEnglish);
    
    if (!isEnglish) {
      showErrorToast('Grammar correction only works for English text');
      isProcessingAction = false;
      return;
    }
    
    // Use current selection or fallback to saved selection
    const currentSelection = (selection && !selection.isCollapsed) ? selection : lastSelection;
    
    // Show loading popup at selection
    const loadingPopup = showLoadingPopup(currentSelection);
    console.log('Sending API request for grammar correction');
    
    // Send message to background script for API call
    console.log("Sending message to background script with action:", "correct_grammar");
    const correction = await chrome.runtime.sendMessage({
      action: 'correct_grammar',
      text: selectedText
    });
    
    console.log('Received API response for grammar correction:', correction);
    
    // Remove loading popup
    removePopup(loadingPopup);
    
    if (correction) {
      // Show grammar correction popup
      activePopup = showCorrectionPopup(currentSelection, selectedText, correction);
      console.log("Grammar correction popup displayed");
    } else {
      console.error('No correction data received');
      showErrorToast('Grammar correction failed. No data received.');
    }
  } catch (error) {
    console.error('Grammar correction error:', error);
    showErrorToast('Grammar correction failed. Please try again.');
  } finally {
    isProcessingAction = false;
  }
}

// Function to make popups draggable
function makeDraggable(popup) {
  // Create a draggable header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 5px;
    cursor: move;
    background-color: rgba(0,0,0,0.05);
    border-bottom: 1px solid #e0e0e0;
    margin-bottom: 10px;
    border-radius: 4px 4px 0 0;
    display: flex;
    justify-content: space-between;
  `;
  
  // Add a drag handle text
  const dragText = document.createElement('div');
  dragText.textContent = 'Drag to move • ';
  dragText.style.cssText = 'color: #666; font-size: 14px;';
  
  // Add a close button
  const closeBtn = document.createElement('div');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = 'cursor: pointer; color: #666; font-size: 20px; margin-top: -5px;';
  closeBtn.addEventListener('click', () => removePopup(popup));
  
  header.appendChild(dragText);
  header.appendChild(closeBtn);
  
  // Insert header at the beginning of popup
  popup.insertBefore(header, popup.firstChild);
  
  // Create a draggable footer
  const footer = document.createElement('div');
  footer.style.cssText = `
    padding: 5px;
    cursor: move;
    background-color: rgba(0,0,0,0.05);
    border-top: 1px solid #e0e0e0;
    margin-top: 10px;
    border-radius: 0 0 4px 4px;
    display: flex;
    justify-content: center;
  `;
  
  // Add a drag handle text for footer
  const footerDragText = document.createElement('div');
  footerDragText.textContent = '• • • Drag to move • • •';
  footerDragText.style.cssText = 'color: #666; font-size: 14px;';
  
  footer.appendChild(footerDragText);
  
  // Add footer to the end of popup
  popup.appendChild(footer);
  
  let isDragging = false;
  let offsetX, offsetY;
  
  // Function to handle mousedown event (start dragging)
  const handleMouseDown = (e) => {
    isDragging = true;
    offsetX = e.clientX - popup.getBoundingClientRect().left;
    offsetY = e.clientY - popup.getBoundingClientRect().top;
    popup.style.cursor = 'move';
    e.preventDefault(); // Prevent text selection during drag
  };
  
  // Add event listeners to both header and footer
  header.addEventListener('mousedown', handleMouseDown);
  footer.addEventListener('mousedown', handleMouseDown);
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      popup.style.left = (e.clientX - offsetX) + 'px';
      popup.style.top = (e.clientY - offsetY) + 'px';
    }
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    popup.style.cursor = 'default';
  });
  
  return popup;
}

// Show translation popup
function showTranslationPopup(selection, original, translation, direction) {
  const popup = document.createElement('div');
  
  const sourceLang = direction === 'zh-to-en' ? 'Chinese' : 'English';
  const targetLang = direction === 'zh-to-en' ? 'English' : 'Chinese';
  
  popup.innerHTML = `
    <div style="border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; margin-bottom: 8px;">
      <div style="font-weight: bold; margin-bottom: 5px;">${sourceLang}</div>
      <div>${original}</div>
    </div>
    <div>
      <div style="font-weight: bold; margin-bottom: 5px;">${targetLang}</div>
      <div>${translation}</div>
    </div>
  `;
  
  popup.style.cssText = `
    position: fixed;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    padding: 15px;
    font-size: 16px;
    z-index: 2147483647;
    max-width: 450px;
    border: 2px solid #4285F4;
    max-height: 80vh;
    overflow-y: auto;
  `;
  
  // Position the popup based on selection
  positionPopupAtSelection(popup, selection);
  
  // Make the popup draggable
  makeDraggable(popup);
  
  document.body.appendChild(popup);
  return popup;
}

// Show grammar analysis popup
function showGrammarPopup(selection, original, analysis) {
  const popup = document.createElement('div');
  
  popup.innerHTML = `
    <div style="border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; margin-bottom: 8px;">
      <div style="font-weight: bold; margin-bottom: 5px;">Original Text</div>
      <div>${original}</div>
    </div>
    <div>
      <div style="font-weight: bold; margin-bottom: 5px;">Grammar Analysis</div>
      <div style="white-space: pre-wrap; font-family: monospace;">${analysis.structure}</div>
    </div>
  `;
  
  popup.style.cssText = `
    position: fixed;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    padding: 15px;
    font-size: 16px;
    z-index: 2147483647;
    max-width: 600px;
    border: 2px solid #F9AB00;
    overflow-y: auto;
    max-height: 80vh;
  `;
  
  // Position the popup based on selection
  positionPopupAtSelection(popup, selection);
  
  // Make the popup draggable
  makeDraggable(popup);
  
  document.body.appendChild(popup);
  return popup;
}

// Show grammar correction popup
function showCorrectionPopup(selection, original, correction) {
  const popup = document.createElement('div');
  
  popup.innerHTML = `
    <div style="border-bottom: 1px solid #e0e0e0; padding-bottom: 12px; margin-bottom: 12px;">
      <div style="font-weight: bold; margin-bottom: 8px;">Original Text</div>
      <div style="color: #D93025;">${original}</div>
    </div>
    <div style="border-bottom: 1px solid #e0e0e0; padding-bottom: 12px; margin-bottom: 12px;">
      <div style="font-weight: bold; margin-bottom: 8px;">Corrected Text</div>
      <div style="color: #137333;">${correction.corrected}</div>
    </div>
    <div>
      <div style="font-weight: bold; margin-bottom: 8px;">Explanation</div>
      <div>${correction.explanation}</div>
    </div>
  `;
  
  popup.style.cssText = `
    position: fixed;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    padding: 18px;
    font-size: 16px;
    z-index: 2147483647;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    border: 2px solid #DB4437;
  `;
  
  // Position the popup based on selection
  positionPopupAtSelection(popup, selection);
  
  // Make the popup draggable
  makeDraggable(popup);
  
  document.body.appendChild(popup);
  return popup;
}

// Show loading popup (for selected text)
function showLoadingPopup(selection) {
  const popup = document.createElement('div');
  popup.textContent = 'Loading...';
  popup.style.cssText = `
    position: fixed;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    padding: 10px 15px;
    font-size: 16px;
    z-index: 2147483647;
    border: 1px solid #ccc;
  `;
  
  // Position the popup based on selection
  positionPopupAtSelection(popup, selection);
  
  document.body.appendChild(popup);
  return popup;
}

// Extract text at cursor (modified to detect language direction)
function getTextAtCursor() {
  const element = document.activeElement;
  let text, startPos, endPos, cursorPos;
  
  // Handle different types of editable elements
  if (element.isContentEditable) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return { chinese: null, english: null };
    }
    const range = selection.getRangeAt(0);
    text = element.textContent;
    cursorPos = range.startOffset;
  } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    text = element.value;
    cursorPos = element.selectionStart;
  } else {
    // Not in an editable field
    return { chinese: null, english: null };
  }
  
  // Get current line
  const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
  const lineEnd = text.indexOf('\n', cursorPos);
  const currentLine = text.slice(lineStart, lineEnd !== -1 ? lineEnd : text.length);
  const cursorPosInLine = cursorPos - lineStart;
  
  // Extract text before cursor based on language
  const chineseRegex = /[\u4e00-\u9fa5]+$/;
  const englishRegex = /[a-zA-Z0-9\s.,;:'"!?()[\]{}]+$/;
  
  const textBeforeCursor = currentLine.slice(0, cursorPosInLine);
  const chineseMatch = textBeforeCursor.match(chineseRegex);
  const englishMatch = textBeforeCursor.match(englishRegex);
  
  let chinese = null, english = null, direction = null, matchedText = null, startPosOffset = 0;
  
  // Determine text and direction
  if (chineseMatch) {
    chinese = chineseMatch[0];
    direction = 'zh-to-en';
    matchedText = chinese;
    startPosOffset = chinese.length;
  } else if (englishMatch) {
    english = englishMatch[0].trim();
    direction = 'en-to-zh';
    matchedText = english;
    startPosOffset = englishMatch[0].length;
  } else {
    return { chinese: null, english: null };
  }
  
  startPos = cursorPos - startPosOffset;
  endPos = cursorPos;
  
  // Extract context (remove the matched part for clarity)
  const context = currentLine.slice(0, cursorPosInLine - startPosOffset) + 
                  currentLine.slice(cursorPosInLine);
  
  return {
    chinese,
    english,
    direction,
    context: context.trim(),
    startPos,
    endPos,
    element
  };
}

// Detect language of text (simple version)
function detectLanguage(text) {
  // Check if text contains Chinese characters
  const chineseRegex = /[\u4e00-\u9fa5]/;
  const hasChineseChars = chineseRegex.test(text);
  
  // Determine direction based on presence of Chinese characters
  // This is a simple approach - for a more accurate detection, consider using a library
  return hasChineseChars ? 'zh-to-en' : 'en-to-zh';
}

// Replace text in the active element (unchanged)
function replaceText(element, startPos, endPos, newText) {
  if (element.isContentEditable) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      console.error('Cannot replace text: no valid selection');
      return;
    }
    const range = document.createRange();
    const textNode = element.firstChild;
    
    if (!textNode) {
      console.error('Cannot replace text: no text node found');
      return;
    }
    
    range.setStart(textNode, startPos);
    range.setEnd(textNode, endPos);
    range.deleteContents();
    
    const textNode2 = document.createTextNode(newText);
    range.insertNode(textNode2);
    
    // Reset cursor to end of inserted text
    range.setStartAfter(textNode2);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    const text = element.value;
    element.value = text.substring(0, startPos) + newText + text.substring(endPos);
    
    // Reset cursor position
    element.selectionStart = startPos + newText.length;
    element.selectionEnd = startPos + newText.length;
  }
}

// Show loading indicator (for cursor translation)
function showLoadingIndicator(element) {
  const indicator = document.createElement('div');
  indicator.textContent = 'Translating...';
  indicator.style.cssText = 'position:absolute;background:rgba(0,0,0,0.7);color:white;padding:5px 10px;border-radius:4px;font-size:14px;z-index:2147483647;';
  
  // Position near the element
  const rect = element.getBoundingClientRect();
  indicator.style.top = `${rect.bottom + 5}px`;
  indicator.style.left = `${rect.left}px`;
  
  document.body.appendChild(indicator);
  return indicator;
}

// Position popup at selection with smart positioning
function positionPopupAtSelection(popup, selection) {
  let rect;
  
  // Handle selection
  if (selection && selection.rangeCount > 0) {
    rect = selection.getRangeAt(0).getBoundingClientRect();
  }
  // Handle saved selectionRange
  else if (selectionRange) {
    rect = selectionRange.getBoundingClientRect();
  }
  // Fallback to center of screen if no valid selection
  else {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    popup.style.visibility = 'hidden';
    document.body.appendChild(popup);
    
    // Center in viewport
    popup.style.top = `${(viewportHeight / 2) - (popup.offsetHeight / 2) + window.scrollY}px`;
    popup.style.left = `${(viewportWidth / 2) - (popup.offsetWidth / 2) + window.scrollX}px`;
    popup.style.visibility = 'visible';
    
    // Add class for targeting
    popup.classList.add('translate-popup');
    return;
  }
  
  // First add to DOM to get dimensions
  popup.style.visibility = 'hidden';
  document.body.appendChild(popup);
  
  const popupWidth = popup.offsetWidth;
  const popupHeight = popup.offsetHeight;
  
  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Calculate position - account for scroll position
  let top = rect.bottom + window.scrollY + 10; // 10px below selection
  let left = rect.left + window.scrollX;
  
  console.log('Positioning popup at:', {
    rect, 
    viewportWidth, 
    viewportHeight, 
    popupWidth, 
    popupHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY
  });
  
  // Check if popup would go below viewport
  if ((top - window.scrollY) + popupHeight > viewportHeight) {
    // Place above selection
    top = rect.top + window.scrollY - popupHeight - 10; // 10px above selection
    
    // If still outside viewport (e.g., selection near top), place at top with margin
    if (top < window.scrollY) {
      top = window.scrollY + 10;
    }
  }
  
  // Check if popup would go outside right edge
  if ((left - window.scrollX) + popupWidth > viewportWidth) {
    left = window.scrollX + viewportWidth - popupWidth - 10; // 10px from right edge
  }
  
  // Check if popup is too far left
  if (left < window.scrollX) {
    left = window.scrollX + 10; // 10px from left edge
  }
  
  // Position for multiple popups - add slight offset if existing popup
  if (document.querySelectorAll('.translate-popup').length > 0) {
    top += 15;
    left += 15;
  }
  
  // Apply position
  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
  popup.style.visibility = 'visible';
  
  console.log('Final popup position:', {top, left});
  
  // Add class for targeting
  popup.classList.add('translate-popup');
}

// Remove popup or indicator
function removePopup(element) {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

function removeLoadingIndicator(indicator) {
  removePopup(indicator);
}

// Toast notifications
function showSuccessToast(message = 'Translated successfully', type = 'success') {
  showToast(message, type);
}

function showErrorToast(message) {
  showToast(message, 'error');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 10px 20px;
    border-radius: 4px;
    font-size: 21px;
    z-index: 2147483647;
    animation: fadeOut 3s forwards;
    background-color: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#2196F3'};
    color: white;
  `;
  
  // Add fadeout animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeOut {
      0% { opacity: 1; }
      70% { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(toast);
  
  // Remove after animation completes
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
    if (style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }, 3000);
}

// Show quick action buttons near selection
function showQuickActionButtons(selection) {
  // Remove existing buttons
  removeQuickActionButtons();
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  const buttons = document.createElement('div');
  buttons.className = 'quick-actions';
  buttons.style.cssText = `
    position: fixed;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    border-radius: 20px;
    padding: 5px 10px;
    font-size: 14px;
    z-index: 2147483646;
    display: flex;
    gap: 10px;
    top: ${rect.bottom + window.scrollY + 5}px;
    left: ${rect.left + window.scrollX}px;
  `;
  
  // Save the selection info for later use by the buttons
  buttons.dataset.selectionText = selection.toString().trim();
  
  // Prevent mousedown events from bubbling up to document
  buttons.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  
  // Stay visible on mouseenter
  buttons.addEventListener('mouseenter', () => {
    clearTimeout(buttonsTimeout);
  });
  
  // Translate button
  const translateBtn = document.createElement('button');
  translateBtn.textContent = 'Translate';
  translateBtn.style.cssText = `
    background: #4285F4;
    color: white;
    border: none;
    border-radius: 15px;
    padding: 5px 10px;
    cursor: pointer;
    font-size: 12px;
    transition: transform 0.1s ease;
  `;
  
  translateBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Translate button clicked");
    handleSelectionTranslation();
  });
  
  // Button press effect
  translateBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    translateBtn.style.transform = 'scale(0.95)';
  });
  
  translateBtn.addEventListener('mouseup', (e) => {
    e.preventDefault();
    e.stopPropagation();
    translateBtn.style.transform = 'scale(1)';
  });
  
  translateBtn.addEventListener('mouseleave', () => {
    translateBtn.style.transform = 'scale(1)';
  });
  
  // Grammar analysis button
  const analysisBtn = document.createElement('button');
  analysisBtn.textContent = 'Grammar Analysis';
  analysisBtn.style.cssText = `
    background: #F9AB00;
    color: white;
    border: none;
    border-radius: 15px;
    padding: 5px 10px;
    cursor: pointer;
    font-size: 12px;
    transition: transform 0.1s ease;
  `;
  
  analysisBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Grammar Analysis button clicked");
    handleGrammarAnalysis();
  });
  
  // Button press effect
  analysisBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    analysisBtn.style.transform = 'scale(0.95)';
  });
  
  analysisBtn.addEventListener('mouseup', (e) => {
    e.preventDefault();
    e.stopPropagation();
    analysisBtn.style.transform = 'scale(1)';
  });
  
  analysisBtn.addEventListener('mouseleave', () => {
    analysisBtn.style.transform = 'scale(1)';
  });
  
  // Grammar correction button
  const correctionBtn = document.createElement('button');
  correctionBtn.textContent = 'Grammar Correction';
  correctionBtn.style.cssText = `
    background: #DB4437;
    color: white;
    border: none;
    border-radius: 15px;
    padding: 5px 10px;
    cursor: pointer;
    font-size: 12px;
    transition: transform 0.1s ease;
  `;
  
  correctionBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Grammar Correction button clicked");
    handleGrammarCorrection();
  });
  
  // Button press effect
  correctionBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    correctionBtn.style.transform = 'scale(0.95)';
  });
  
  correctionBtn.addEventListener('mouseup', (e) => {
    e.preventDefault();
    e.stopPropagation();
    correctionBtn.style.transform = 'scale(1)';
  });
  
  correctionBtn.addEventListener('mouseleave', () => {
    correctionBtn.style.transform = 'scale(1)';
  });
  
  buttons.appendChild(translateBtn);
  buttons.appendChild(analysisBtn);
  buttons.appendChild(correctionBtn);
  
  document.body.appendChild(buttons);
  
  // Auto hide buttons after 5 seconds of inactivity
  let buttonsTimeout = setTimeout(() => {
    removeQuickActionButtons();
  }, 5000);
}

// Remove quick action buttons
function removeQuickActionButtons() {
  const buttons = document.querySelector('.quick-actions');
  if (buttons) {
    buttons.parentNode.removeChild(buttons);
  }
}