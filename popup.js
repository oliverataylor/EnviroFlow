const originalPrompt = document.getElementById("originalPrompt");
const optimizedPrompt = document.getElementById("optimizedPrompt");
const tokensSaved = document.getElementById("tokensSaved");
const carbonSaved = document.getElementById("carbonSaved");
const energySaved = document.getElementById("energySaved");
const currentSite = document.getElementById("currentSite");
const reductionPercent = document.getElementById("reductionPercent");
const efficiencyMeter = document.getElementById("efficiencyMeter");
const originalComplexity = document.getElementById("originalComplexity");
const optimizedComplexity = document.getElementById("optimizedComplexity");
const complexityLabel = document.getElementById("complexityLabel");
const tokenComparison = document.getElementById("tokenComparison");
const supportedSites = document.getElementById("supportedSites");
const applyPromptButton = document.getElementById("applyPromptButton");

const popupKeys = [
  "totalTokensSaved",
  "totalCarbonSaved",
  "totalEnergySaved",
  "lastOriginalText",
  "lastOptimizedText",
  "lastTokensSaved",
  "lastCarbonSaved",
  "lastEnergySaved",
  "lastOriginalTokens",
  "lastOptimizedTokens",
  "lastReductionPercent",
  "lastOriginalComplexityScore",
  "lastOptimizedComplexityScore",
  "lastOptimizedComplexityLabel"
];

function calculateComplexity(text) {
  const promptText = String(text || "").trim();
  const tokenCount = countTokens(promptText);
  const commaCount = (promptText.match(/,/g) || []).length;
  const lineBreakCount = (promptText.match(/\n/g) || []).length;
  const instructionWords = (promptText.match(/\b(and|then|also|after|before|include|make|create|build)\b/gi) || []).length;
  const rawScore = tokenCount + commaCount * 2 + lineBreakCount * 3 + instructionWords * 2;
  const score = Math.min(100, rawScore);

  if (score >= 70) {
    return { score, label: "High" };
  }

  if (score >= 35) {
    return { score, label: "Medium" };
  }

  return { score, label: "Low" };
}

function buildLiveAnalysis(originalText) {
  const optimizedText = optimizePrompt(originalText);
  const originalTokens = countTokens(originalText);
  const optimizedTokens = countTokens(optimizedText);
  const tokens = Math.max(0, originalTokens - optimizedTokens);
  const carbon = tokens * 0.000002;
  const energy = tokens * 0.0005;
  const reduction = originalTokens > 0 ? Math.round((tokens / originalTokens) * 100) : 0;
  const beforeComplexity = calculateComplexity(originalText);
  const afterComplexity = calculateComplexity(optimizedText);

  return {
    originalText,
    optimizedText,
    currentSite: "",
    originalTokens,
    optimizedTokens,
    tokensSaved: tokens,
    carbonSaved: carbon,
    energySaved: energy,
    reductionPercent: reduction,
    originalComplexityScore: beforeComplexity.score,
    optimizedComplexityScore: afterComplexity.score,
    optimizedComplexityLabel: afterComplexity.label
  };
}

function updatePopup(view) {
  originalPrompt.textContent = view.originalText || "No prompt captured yet.";
  optimizedPrompt.textContent = view.optimizedText || "No optimized prompt yet.";
  tokensSaved.textContent = String(view.totalTokensSaved ?? 0);
  carbonSaved.textContent = ((view.totalCarbonSaved ?? 0) * 1000).toFixed(4) + " g";
  energySaved.textContent = (view.totalEnergySaved ?? 0).toFixed(4) + " Wh";
  currentSite.textContent = view.currentSite || "No site";
  reductionPercent.textContent = String(view.reductionPercent ?? 0) + "%";
  efficiencyMeter.style.width = String(view.reductionPercent ?? 0) + "%";
  originalComplexity.textContent = String(view.originalComplexityScore ?? 0);
  optimizedComplexity.textContent = String(view.optimizedComplexityScore ?? 0);
  complexityLabel.textContent = view.optimizedComplexityLabel || "Low";
  tokenComparison.textContent = String(view.originalTokens ?? 0) + " -> " + String(view.optimizedTokens ?? 0) + " tokens";
  supportedSites.textContent = "All websites, plus ChatGPT, Claude, Gemini, Grok, Copilot, Perplexity, Poe, Character.AI, and You.com";
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getPagePromptData(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const selectors = [
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

      const isSupported = (element) => {
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
      };

      const getText = (element) => {
        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
          return element.value || "";
        }

        return element instanceof HTMLElement ? (element.innerText || "") : "";
      };

      const activeElement = document.activeElement;
      let target = isSupported(activeElement) ? activeElement : null;

      if (!target) {
        const elements = document.querySelectorAll(selectors.join(", "));

        for (const element of elements) {
          if (!isSupported(element)) {
            continue;
          }

          const text = getText(element).trim();

          if (text) {
            target = element;
            break;
          }
        }
      }

      return {
        text: target ? getText(target).trim() : "",
        hostname: window.location.hostname
      };
    }
  });

  return results[0]?.result || { text: "", hostname: "" };
}

async function renderPopup() {
  const stored = await chrome.storage.local.get(popupKeys);
  const tab = await getActiveTab();

  if (!tab?.id) {
    updatePopup({
      originalText: stored.lastOriginalText || "",
      optimizedText: stored.lastOptimizedText || "",
      totalTokensSaved: stored.totalTokensSaved || 0,
      totalCarbonSaved: stored.totalCarbonSaved || 0,
      totalEnergySaved: stored.totalEnergySaved || 0,
      currentSite: "No site",
      originalTokens: stored.lastOriginalTokens || 0,
      optimizedTokens: stored.lastOptimizedTokens || 0,
      reductionPercent: stored.lastReductionPercent || 0,
      originalComplexityScore: stored.lastOriginalComplexityScore || 0,
      optimizedComplexityScore: stored.lastOptimizedComplexityScore || 0,
      optimizedComplexityLabel: stored.lastOptimizedComplexityLabel || "Low"
    });
    return;
  }

  try {
    const pageData = await getPagePromptData(tab.id);
    const analysis = pageData.text ? buildLiveAnalysis(pageData.text) : null;

    updatePopup({
      originalText: analysis?.originalText || stored.lastOriginalText || "",
      optimizedText: analysis?.optimizedText || stored.lastOptimizedText || "",
      totalTokensSaved: stored.totalTokensSaved || 0,
      totalCarbonSaved: stored.totalCarbonSaved || 0,
      totalEnergySaved: stored.totalEnergySaved || 0,
      currentSite: pageData.hostname || "No site",
      originalTokens: analysis?.originalTokens || stored.lastOriginalTokens || 0,
      optimizedTokens: analysis?.optimizedTokens || stored.lastOptimizedTokens || 0,
      reductionPercent: analysis?.reductionPercent || stored.lastReductionPercent || 0,
      originalComplexityScore: analysis?.originalComplexityScore || stored.lastOriginalComplexityScore || 0,
      optimizedComplexityScore: analysis?.optimizedComplexityScore || stored.lastOptimizedComplexityScore || 0,
      optimizedComplexityLabel: analysis?.optimizedComplexityLabel || stored.lastOptimizedComplexityLabel || "Low"
    });
  } catch (error) {
    updatePopup({
      originalText: stored.lastOriginalText || "",
      optimizedText: stored.lastOptimizedText || "",
      totalTokensSaved: stored.totalTokensSaved || 0,
      totalCarbonSaved: stored.totalCarbonSaved || 0,
      totalEnergySaved: stored.totalEnergySaved || 0,
      currentSite: "No site",
      originalTokens: stored.lastOriginalTokens || 0,
      optimizedTokens: stored.lastOptimizedTokens || 0,
      reductionPercent: stored.lastReductionPercent || 0,
      originalComplexityScore: stored.lastOriginalComplexityScore || 0,
      optimizedComplexityScore: stored.lastOptimizedComplexityScore || 0,
      optimizedComplexityLabel: stored.lastOptimizedComplexityLabel || "Low"
    });
  }
}

renderPopup();

if (applyPromptButton) {
  applyPromptButton.addEventListener("click", async () => {
    const tab = await getActiveTab();

    if (!tab?.id) {
      return;
    }

    const pageData = await getPagePromptData(tab.id);

    if (!pageData.text) {
      return;
    }

    const analysis = buildLiveAnalysis(pageData.text);

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [analysis.optimizedText],
      func: (optimizedText) => {
        const selectors = [
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

        const isSupported = (element) => {
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
        };

        const activeElement = document.activeElement;
        let target = isSupported(activeElement) ? activeElement : null;

        if (!target) {
          const elements = document.querySelectorAll(selectors.join(", "));

          for (const element of elements) {
            if (isSupported(element)) {
              target = element;
              break;
            }
          }
        }

        if (!target) {
          return;
        }

        if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
          target.value = optimizedText;
          target.dispatchEvent(new Event("input", { bubbles: true }));
          return;
        }

        target.textContent = optimizedText;
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const currentTotals = await chrome.storage.local.get([
      "totalTokensSaved",
      "totalCarbonSaved",
      "totalEnergySaved"
    ]);

    await chrome.storage.local.set({
      totalTokensSaved: (currentTotals.totalTokensSaved || 0) + analysis.tokensSaved,
      totalCarbonSaved: (currentTotals.totalCarbonSaved || 0) + analysis.carbonSaved,
      totalEnergySaved: (currentTotals.totalEnergySaved || 0) + analysis.energySaved,
      lastOriginalText: analysis.originalText,
      lastOptimizedText: analysis.optimizedText,
      lastTokensSaved: analysis.tokensSaved,
      lastCarbonSaved: analysis.carbonSaved,
      lastEnergySaved: analysis.energySaved,
      lastOriginalTokens: analysis.originalTokens,
      lastOptimizedTokens: analysis.optimizedTokens,
      lastReductionPercent: analysis.reductionPercent,
      lastOriginalComplexityScore: analysis.originalComplexityScore,
      lastOptimizedComplexityScore: analysis.optimizedComplexityScore,
      lastOptimizedComplexityLabel: analysis.optimizedComplexityLabel
    });

    renderPopup();
  });
}
