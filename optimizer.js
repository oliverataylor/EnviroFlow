const FILLER_PATTERNS = [
  /\bplease\b/gi,
  /\bpls\b/gi,
  /\bplz\b/gi,
  /\bthank you\b/gi,
  /\bthanks\b/gi,
  /\bthx\b/gi,
  /\bthank u\b/gi,
  /\bty\b/gi,
  /\bcould you\b/gi,
  /\bcan you\b/gi,
  /\bif possible\b/gi,
  /\bi would like\b/gi,
  /\bi need you to\b/gi,
  /\bwould you\b/gi,
  /\bkindly\b/gi,
  /\bif you can\b/gi,
  /\bwhen you can\b/gi,
  /\bappreciate it\b/gi,
  /\bjust\b/gi,
  /\bkind of\b/gi,
  /\bsort of\b/gi,
  /\bsomewhat\b/gi,
  /\bbasically\b/gi,
  /\bactually\b/gi,
  /\breally\b/gi,
  /\bvery\b/gi,
  /\bpretty\b/gi,
  /\bin a way\b/gi,
  /\bi guess\b/gi,
  /\byou know\b/gi,
  /\bi mean\b/gi,
  /\bfor the most part\b/gi,
  /\bmore or less\b/gi,
  /\bat the end of the day\b/gi,
  /\bto some extent\b/gi,
  /\bgenerally speaking\b/gi,
  /\bin general\b/gi,
  /\bin a sense\b/gi,
  /\bbasically speaking\b/gi,
  /\bkind of like\b/gi,
  /\bsort of like\b/gi
];

function optimizePrompt(text) {
  let cleanedText = String(text || "");

  FILLER_PATTERNS.forEach((pattern) => {
    cleanedText = cleanedText.replace(pattern, " ");
  });

  const words = cleanedText.trim().split(/\s+/).filter(Boolean);
  const uniqueWords = [];

  words.forEach((word) => {
    const normalizedWord = word.toLowerCase();
    const isDuplicate = uniqueWords.some(
      (existingWord) => existingWord.toLowerCase() === normalizedWord
    );

    if (!isDuplicate) {
      uniqueWords.push(word);
    }
  });

  return uniqueWords.join(" ").replace(/\s+/g, " ").trim();
}

function countTokens(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function estimateTokensSaved(originalText, optimizedText) {
  const originalTokens = countTokens(originalText);
  const optimizedTokens = countTokens(optimizedText);

  return Math.max(0, originalTokens - optimizedTokens);
}

function estimateCarbonSaved(tokensSaved) {
  return tokensSaved * 0.000002;
}

function estimateEnergySaved(tokensSaved) {
  return tokensSaved * 0.0005;
}

function generateGreenSuggestion(text) {
  const promptText = String(text || "").trim();
  const hasFillerWords = FILLER_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(promptText);
  });
  const isLongPrompt = countTokens(promptText) > 20;

  if (hasFillerWords && isLongPrompt) {
    return "Shorten instructions and remove politeness words.";
  }

  if (hasFillerWords) {
    return "Remove politeness words.";
  }

  if (isLongPrompt) {
    return "Try shortening instructions.";
  }

  return "Prompt looks efficient.";
}

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

function buildPromptAnalysis(originalText, optimizedText) {
  const tokensSaved = estimateTokensSaved(originalText, optimizedText);
  const carbonSaved = estimateCarbonSaved(tokensSaved);
  const energySaved = estimateEnergySaved(tokensSaved);
  const originalTokens = countTokens(originalText);
  const optimizedTokens = countTokens(optimizedText);
  const reductionPercent = originalTokens > 0
    ? Math.round((tokensSaved / originalTokens) * 100)
    : 0;
  const originalComplexity = calculateComplexity(originalText);
  const optimizedComplexity = calculateComplexity(optimizedText);

  return {
    originalTokens,
    optimizedTokens,
    tokensSaved,
    carbonSaved,
    energySaved,
    reductionPercent,
    originalComplexity,
    optimizedComplexity
  };
}

function saveOptimizationTotals(originalText, optimizedText) {
  const analysis = buildPromptAnalysis(originalText, optimizedText);

  chrome.storage.local.get(
    ["totalTokensSaved", "totalCarbonSaved", "totalEnergySaved"],
    (storedTotals) => {
      chrome.storage.local.set({
        totalTokensSaved: (storedTotals.totalTokensSaved || 0) + analysis.tokensSaved,
        totalCarbonSaved: (storedTotals.totalCarbonSaved || 0) + analysis.carbonSaved,
        totalEnergySaved: (storedTotals.totalEnergySaved || 0) + analysis.energySaved
      });
    }
  );

  return analysis;
}
