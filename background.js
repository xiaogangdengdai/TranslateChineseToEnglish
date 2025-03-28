// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request.action);
  
  if (request.action === 'translate') {
    console.log('Translate request received:', request);
    translateText(request.text, request.context || '', request.direction)
      .then(result => {
        console.log('Translation completed successfully:', result ? result.substring(0, 30) + '...' : 'null');
        sendResponse(result);
      })
      .catch(error => {
        console.error('Translation error:', error);
        sendResponse(null);
      });
    return true; // Indicates async response
  } else if (request.action === 'analyze_grammar') {
    console.log('Grammar analysis request received:', request);
    analyzeGrammar(request.text)
      .then(result => {
        console.log('Grammar analysis completed successfully:', result ? 'has data' : 'null');
        sendResponse(result);
      })
      .catch(error => {
        console.error('Grammar analysis error:', error);
        sendResponse(null);
      });
    return true; // Indicates async response
  } else if (request.action === 'correct_grammar') {
    console.log('Grammar correction request received:', request);
    correctGrammar(request.text)
      .then(result => {
        console.log('Grammar correction completed successfully:', result ? 'has data' : 'null');
        sendResponse(result);
      })
      .catch(error => {
        console.error('Grammar correction error:', error);
        sendResponse(null);
      });
    return true; // Indicates async response
  }
});

// Translation function using DeepSeek API
async function translateText(text, context, direction) {
  try {
    // Get API key from storage
    const result = await chrome.storage.local.get(['deepseekApiKey']);
    const apiKey = result.deepseekApiKey;
    
    if (!apiKey) {
      throw new Error('API key not found. Please set it in the extension options.');
    }
    
    let prompt;
    
    if (direction === 'zh-to-en') {
      // Chinese to English
      prompt = `As a professional translator, choose the most appropriate English translation based on the context.
Context: ${context}
Chinese text to translate: ${text}
Return only the translation result, without any explanation.`;
    } else {
      // English to Chinese
      prompt = `作为专业翻译，请根据上下文选择最合适的中文翻译。
上下文: ${context}
英文文本: ${text}
仅返回翻译结果，不要任何解释。`;
    }

    // Call DeepSeek API
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
          content: prompt
        }],
        temperature: 0.3,
        max_tokens: 256
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API request failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    // Try to save to cache for future use
    try {
      const cache = await chrome.storage.local.get(['translationCache']);
      const translationCache = cache.translationCache || {};
      const cacheKey = `${direction}:${text}`;
      
      translationCache[cacheKey] = {
        translation: data.choices[0].message.content.trim(),
        timestamp: Date.now()
      };
      
      // Limit cache size to 100 entries
      const cacheKeys = Object.keys(translationCache);
      if (cacheKeys.length > 100) {
        // Sort by timestamp, remove oldest
        const oldestKey = cacheKeys.sort((a, b) => 
          translationCache[a].timestamp - translationCache[b].timestamp
        )[0];
        delete translationCache[oldestKey];
      }
      
      chrome.storage.local.set({ translationCache });
    } catch (e) {
      console.error('Error saving to cache:', e);
      // Non-critical error, continue without caching
    }
    
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Translation API error:', error);
    throw error;
  }
}

// Grammar analysis function using DeepSeek API
async function analyzeGrammar(text) {
  try {
    // Get API key from storage
    const result = await chrome.storage.local.get(['deepseekApiKey']);
    const apiKey = result.deepseekApiKey;
    
    if (!apiKey) {
      throw new Error('API key not found. Please set it in the extension options.');
    }
    
    // Construct the prompt for grammar analysis
    const prompt = `你是一个专业英语语法解析器，请严格按以下规则分析句子结构：

【分析要求】
1. 按功能模块化解析，只识别以下六大成分：
   - 核心结构：S(主语)+V(谓语类型)+O(宾语类型)
   - 修饰成分：AdjP(形容词短语)/AdvP(副词短语)/PP(介词短语)
   - 特殊结构：Clause(从句类型)/Phrase(非谓语结构)

2. 输出格式要求：
[句子原型] 
→ [核心结构] 
→ ([修饰成分1类型]@位置) 
→ ([修饰成分2类型]@位置) 
→ (...其他成分)

3. 禁止单词级拆分，如遇复合结构按以下方式处理：
   - 并列成分用"&"连接
   - 嵌套成分用">"表示层级
   - 省略结构用"∅"标记

分析这个句子: "${text}"

请严格按照上述格式输出，不要添加额外解释。`;

    // Call DeepSeek API
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
          content: prompt
        }],
        temperature: 0.2,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API request failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // Parse response - with new format, we'll just pass the full content
    return {
      structure: content,
      errors: null // New format doesn't specifically call out errors
    };
  } catch (error) {
    console.error('Grammar analysis API error:', error);
    throw error;
  }
}

// Grammar correction function using DeepSeek API
async function correctGrammar(text) {
  try {
    // Get API key from storage
    const result = await chrome.storage.local.get(['deepseekApiKey']);
    const apiKey = result.deepseekApiKey;
    
    if (!apiKey) {
      throw new Error('API key not found. Please set it in the extension options.');
    }
    
    // Construct the prompt for grammar correction
    const prompt = `你是一位专业英语语法老师，请对以下英文文本进行详细的语法纠错和优化表达：

原文: "${text}"

请按照以下格式提供详细反馈：
1. 纠正后的文本（保持原意，但修正所有语法错误和表达不自然的地方）
2. 详细讲解每一处修改的原因，包括语法规则解释和最佳表达方式建议

务必确保纠正后的文本自然、地道，符合英语母语者的表达习惯。`;

    // Call DeepSeek API
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
          content: prompt
        }],
        temperature: 0.3,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API request failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // Parse the response
    let corrected = '';
    let explanation = '';
    
    // Try to extract the corrected text (usually appears first in response)
    const correctedMatch = content.match(/^(.*?)(?=详细|解释|原因|说明)/s);
    if (correctedMatch && correctedMatch[1]) {
      corrected = correctedMatch[1].replace(/^纠正后的文本[：:]\s*/i, '').trim();
    } else {
      // Fallback parsing - take first few lines as corrected text
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.match(/^[\d\.\*]/) && !line.match(/原文|纠正|详细|解释|原因/)) {
          corrected = line;
          break;
        }
      }
    }
    
    // Rest of content is explanation
    explanation = content.replace(corrected, '').trim();
    // Remove any labels or prefixes
    explanation = explanation.replace(/^(纠正后的文本|详细讲解|详细解释|原因|说明)[：:]\s*/i, '').trim();
    
    return {
      corrected: corrected || text, // Default to original if parsing fails
      explanation: explanation || '无需修改，文本已经很完美了。'
    };
  } catch (error) {
    console.error('Grammar correction API error:', error);
    throw error;
  }
}

// Handle installation - set up default settings
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    // Initialize with empty API key - user will need to set this in options
    chrome.storage.local.set({
      deepseekApiKey: '',
      translationCache: {}
    });
  }
}); 