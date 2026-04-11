const INPUT_SELECTORS = [
  "textarea",
  "input[type='text']",
  "input[type='search']",
  "input:not([type])",
  "[contenteditable='true']",
  "div[role='textbox']",
  "div.ProseMirror",
  "div.ql-editor",
  "div[data-testid='composer-text-input']"
];

const SITE_NAME_MAP = {
  "chat.openai.com": "ChatGPT",
  "chatgpt.com": "ChatGPT",
  "claude.ai": "Claude",
  "gemini.google.com": "Gemini",
  "grok.com": "Grok",
  "x.com": "Grok",
  "copilot.microsoft.com": "Copilot",
  "bing.com": "Copilot",
  "www.bing.com": "Copilot",
  "perplexity.ai": "Perplexity",
  "poe.com": "Poe",
  "character.ai": "Character.AI",
  "you.com": "You.com"
};

const SUPPORTED_SITE_NAMES = [
  "All websites",
  "ChatGPT",
  "Claude",
  "Gemini",
  "Grok",
  "Copilot",
  "Perplexity",
  "Poe",
  "Character.AI",
  "You.com"
];
let extensionContextValid = true;
let focusedInputIntervalId = null;
let scanInputsIntervalId = null;

function getInputSelector() {
  return INPUT_SELECTORS.join(", ");
}

function safeStorageSet(values) {
  if (!extensionContextValid) {
    return;
  }

  try {
    chrome.storage.local.set(values, () => {
      if (chrome.runtime.lastError) {
        extensionContextValid = false;
      }
    });
  } catch (error) {
    extensionContextValid = false;
  }
}

function getCurrentSiteName() {
  return SITE_NAME_MAP[window.location.hostname] || window.location.hostname;
}

function isSupportedInput(element) {
  return element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement && (
      element.type === "text" ||
      element.type === "search" ||
      element.type === ""
    )) ||
    (element instanceof HTMLElement && (
      element.isContentEditable ||
      element.matches("div[role='textbox'], div.ProseMirror, div.ql-editor, div[data-testid='composer-text-input']")
    ));
}

function isTextField(element) {
  return element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement;
}

function getInputText(element) {
  if (isTextField(element)) {
    return element.value;
  }

  return element.innerText || "";
}

function setInputText(element, text) {
  if (isTextField(element)) {
    element.value = text;
    return;
  }

  element.textContent = text;
}

function savePromptSnapshot(originalText, optimizedText) {
  const greenSuggestion = generateGreenSuggestion(originalText);
  const analysis = buildPromptAnalysis(originalText, optimizedText);

  safeStorageSet({
    originalText,
    optimizedText,
    greenSuggestion,
    currentSite: getCurrentSiteName(),
    supportedSites: SUPPORTED_SITE_NAMES.join(", "),
    originalTokens: analysis.originalTokens,
    optimizedTokens: analysis.optimizedTokens,
    reductionPercent: analysis.reductionPercent,
    originalComplexityScore: analysis.originalComplexity.score,
    originalComplexityLabel: analysis.originalComplexity.label,
    optimizedComplexityScore: analysis.optimizedComplexity.score,
    optimizedComplexityLabel: analysis.optimizedComplexity.label
  });
}

function saveLastMeaningfulResult(originalText, optimizedText) {
  const greenSuggestion = generateGreenSuggestion(originalText);
  const analysis = buildPromptAnalysis(originalText, optimizedText);

  safeStorageSet({
    lastOriginalText: originalText,
    lastOptimizedText: optimizedText,
    lastGreenSuggestion: greenSuggestion,
    lastTokensSaved: analysis.tokensSaved,
    lastCarbonSaved: analysis.carbonSaved,
    lastEnergySaved: analysis.energySaved,
    lastOriginalTokens: analysis.originalTokens,
    lastOptimizedTokens: analysis.optimizedTokens,
    lastReductionPercent: analysis.reductionPercent,
    lastOriginalComplexityScore: analysis.originalComplexity.score,
    lastOptimizedComplexityScore: analysis.optimizedComplexity.score,
    lastOptimizedComplexityLabel: analysis.optimizedComplexity.label
  });
}

function saveBaseSiteInfo() {
  safeStorageSet({
    currentSite: getCurrentSiteName(),
    supportedSites: SUPPORTED_SITE_NAMES.join(", ")
  });
}

function processInputElement(element, applyOptimization) {
  if (!isSupportedInput(element)) {
    return;
  }

  const originalText = getInputText(element);
  const trimmedText = originalText.trim();

  if (!trimmedText) {
    return;
  }

  const optimizedText = optimizePrompt(originalText);

  if (applyOptimization && optimizedText !== originalText) {
    setInputText(element, optimizedText);
  }

  savePromptSnapshot(originalText, optimizedText);

  if (optimizedText !== originalText) {
    saveLastMeaningfulResult(originalText, optimizedText);

    if (applyOptimization) {
      saveOptimizationTotals(originalText, optimizedText);
    }
  }
}

function handleInput(event) {
  processInputElement(event.target, false);
}

function handleKeyDown(event) {
  const element = event.target;

  if (!isSupportedInput(element)) {
    return;
  }

  if (event.key === "Enter" && !event.shiftKey) {
    processInputElement(element, true);
  }
}

function processFocusedInput() {
  const activeElement = document.activeElement;

  if (isSupportedInput(activeElement)) {
    processInputElement(activeElement, false);
  }
}

function applyOptimizedPromptToActiveInput() {
  const activeElement = document.activeElement;

  if (isSupportedInput(activeElement)) {
    processInputElement(activeElement, true);
    return;
  }

  const firstInput = document.querySelector(getInputSelector());

  if (firstInput && isSupportedInput(firstInput)) {
    processInputElement(firstInput, true);
  }
}

function scanExistingInputs() {
  const inputs = document.querySelectorAll(getInputSelector());

  for (const element of inputs) {
    if (!isSupportedInput(element)) {
      continue;
    }

    const text = getInputText(element).trim();

    if (!text) {
      continue;
    }

    processInputElement(element, false);
    return;
  }
}

function getBestAvailableInput() {
  const activeElement = document.activeElement;

  if (isSupportedInput(activeElement)) {
    return activeElement;
  }

  const inputs = document.querySelectorAll(getInputSelector());

  for (const element of inputs) {
    if (!isSupportedInput(element)) {
      continue;
    }

    const text = getInputText(element).trim();

    if (text) {
      return element;
    }
  }

  return null;
}

function buildSnapshotPayload(element) {
  if (!element || !isSupportedInput(element)) {
    return null;
  }

  const originalText = getInputText(element).trim();

  if (!originalText) {
    return null;
  }

  const optimizedText = optimizePrompt(originalText);
  const analysis = buildPromptAnalysis(originalText, optimizedText);

  return {
    originalText,
    optimizedText,
    greenSuggestion: generateGreenSuggestion(originalText),
    currentSite: getCurrentSiteName(),
    supportedSites: SUPPORTED_SITE_NAMES.join(", "),
    originalTokens: analysis.originalTokens,
    optimizedTokens: analysis.optimizedTokens,
    reductionPercent: analysis.reductionPercent,
    originalComplexityScore: analysis.originalComplexity.score,
    optimizedComplexityScore: analysis.optimizedComplexity.score,
    optimizedComplexityLabel: analysis.optimizedComplexity.label
  };
}

function startContentScript() {
  saveBaseSiteInfo();
  scanExistingInputs();
  document.addEventListener("input", handleInput, true);
  document.addEventListener("keydown", handleKeyDown, true);
  document.addEventListener("focusin", processFocusedInput, true);
  document.addEventListener("mousedown", processFocusedInput, true);
  document.addEventListener("touchstart", processFocusedInput, true);
  focusedInputIntervalId = window.setInterval(processFocusedInput, 400);
  scanInputsIntervalId = window.setInterval(scanExistingInputs, 1200);

  try {
    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.type === "APPLY_OPTIMIZED_PROMPT") {
        applyOptimizedPromptToActiveInput();
      }

      if (message && message.type === "GET_CURRENT_PROMPT_DATA") {
        const targetInput = getBestAvailableInput();
        const payload = buildSnapshotPayload(targetInput);

        if (payload) {
          savePromptSnapshot(payload.originalText, payload.optimizedText);
          if (payload.optimizedText !== payload.originalText) {
            saveLastMeaningfulResult(payload.originalText, payload.optimizedText);
          }
        }

        return Promise.resolve(payload);
      }
    });
  } catch (error) {
    extensionContextValid = false;
  }
}

startContentScript();
