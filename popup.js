// Wait for the DOM to be loaded
document.addEventListener('DOMContentLoaded', () => {
  // Get references to UI elements
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('saveButton');
  const statusElement = document.getElementById('status');
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Load existing settings
  loadSettings();
  
  // Add event listeners
  saveButton.addEventListener('click', saveSettings);
  
  // Tab switching functionality
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update active content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId) {
          content.classList.add('active');
        }
      });
    });
  });
  
  // Function to load settings from storage
  function loadSettings() {
    chrome.storage.local.get(['deepseekApiKey'], (result) => {
      if (result.deepseekApiKey) {
        apiKeyInput.value = result.deepseekApiKey;
      }
    });
  }
  
  // Function to save settings to storage
  function saveSettings() {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showStatus('Please enter a valid API key', 'error');
      return;
    }
    
    // Save to Chrome storage
    chrome.storage.local.set({
      deepseekApiKey: apiKey
    }, () => {
      showStatus('Settings saved successfully', 'success');
      
      // Validate API key by making a test request
      validateApiKey(apiKey);
    });
  }
  
  // Function to validate the API key
  async function validateApiKey(apiKey) {
    try {
      // Show loading status
      showStatus('Validating API key...', 'loading');
      
      // Simple test request to DeepSeek API
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{
            role: "user",
            content: "Test API key."
          }],
          max_tokens: 5
        })
      });
      
      if (response.ok) {
        showStatus('API key validated successfully', 'success');
      } else {
        const errorData = await response.json();
        showStatus(`API key validation failed: ${errorData.error?.message || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      showStatus(`API key validation failed: ${error.message}`, 'error');
    }
  }
  
  // Function to show status messages
  function showStatus(message, type) {
    statusElement.textContent = message;
    statusElement.className = 'status';
    
    if (type === 'success') {
      statusElement.classList.add('success');
    } else if (type === 'error') {
      statusElement.classList.add('error');
    }
    
    // Clear success message after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 3000);
    }
  }
}); 