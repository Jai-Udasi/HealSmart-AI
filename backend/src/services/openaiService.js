'use strict';

const {
  evaluateSymptomsLocal,
  OPENAI_ASSISTED_STATEMENT,
  MEDICAL_DISCLAIMER,
} = require('./symptomEngine');

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Checks whether the optional OpenAI integration is explicitly enabled AND configured.
 * Defaults strictly to false.
 */
function isOpenAiEnabled() {
  const flag = String(process.env.OPENAI_ENABLED || 'false')
    .trim()
    .toLowerCase();
  return flag === 'true';
}

function getOpenAiConfigStatus() {
  const enabled = isOpenAiEnabled();
  const hasApiKey = Boolean(
    process.env.OPENAI_API_KEY && String(process.env.OPENAI_API_KEY).trim().length > 0
  );
  const model = (process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim();
  return {
    openai_enabled: enabled,
    openai_configured: enabled && hasApiKey,
    active_engine: enabled && hasApiKey ? 'openai' : 'local_rule_engine',
    model: enabled ? model : null,
  };
}

/**
 * Scrubs potential PII (email addresses, phone numbers, SSNs, Firebase UIDs) from free-text
 * symptom inputs before any optional external API call.
 * Note: Patient names, emails, phone numbers, Firebase UIDs, and patient IDs are NEVER passed to this function.
 */
function redactPotentialPii(text) {
  if (!text) return '';
  return String(text)
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
    .replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_ID]')
    .slice(0, 400);
}

/**
 * Builds the strictly non-identifying, bounded payload for the optional OpenAI educational request.
 * Explicitly excludes names, emails, phone numbers, addresses, Firebase UIDs, or SQLite patient_id.
 */
function buildSanitizedOpenAiPayload({ symptoms, duration, severity, additional_notes }) {
  const sanitizedSymptoms = (Array.isArray(symptoms) ? symptoms : [])
    .slice(0, 15)
    .map((s) => redactPotentialPii(String(s).trim()).slice(0, 100))
    .filter(Boolean);

  const sanitizedDuration = duration ? redactPotentialPii(String(duration).trim()).slice(0, 80) : null;
  const sanitizedSeverity = ['mild', 'moderate', 'severe'].includes(severity) ? severity : 'mild';
  const sanitizedNotes = additional_notes
    ? redactPotentialPii(String(additional_notes).trim()).slice(0, 300)
    : null;

  return {
    symptoms: sanitizedSymptoms,
    duration: sanitizedDuration,
    severity: sanitizedSeverity,
    additional_notes: sanitizedNotes,
  };
}

/**
 * Validates and sanitizes untrusted JSON output returned from OpenAI so that:
 * - No diagnosis probabilities or confidence percentages are permitted.
 * - Deterministic emergency warnings from the local engine are NEVER overridden or suppressed.
 */
function sanitizeUntrustedAiOutput(rawJson, localEvaluation) {
  let parsed = null;
  if (typeof rawJson === 'string') {
    parsed = JSON.parse(rawJson);
  } else if (rawJson && typeof rawJson === 'object') {
    parsed = rawJson;
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('OpenAI response did not contain a valid JSON object.');
  }

  const safeStringArray = (arr, maxItems = 6, maxLen = 280) => {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((item) => typeof item === 'string' && item.trim().length > 0)
      .slice(0, maxItems)
      .map((item) => item.trim().slice(0, maxLen));
  };

  const aiExplanations = Array.isArray(parsed.context_explanations)
    ? parsed.context_explanations
        .filter((item) => item && typeof item.aspect === 'string' && typeof item.explanation === 'string')
        .slice(0, 4)
        .map((item) => ({
          aspect: item.aspect.trim().slice(0, 80),
          explanation: item.explanation.trim().slice(0, 350),
        }))
    : [];

  const aiFollowUps = safeStringArray(parsed.follow_up_questions, 6, 220);
  const aiSelfCare = safeStringArray(parsed.self_care_tips, 6, 240);
  const aiSeekCare = safeStringArray(parsed.when_to_seek_medical_advice, 6, 240);

  return {
    ...localEvaluation,
    engine_used: 'openai',
    engine_label: 'OpenAI Assistant (with Local Emergency Safety Rules)',
    engine_type: 'openai_assisted_v2',
    engine_statement: OPENAI_ASSISTED_STATEMENT,
    openai_enabled: true,
    openai_used: true,
    context_explanations:
      aiExplanations.length > 0 ? aiExplanations : localEvaluation.context_explanations,
    follow_up_questions:
      aiFollowUps.length > 0 ? aiFollowUps : localEvaluation.follow_up_questions,
    self_care_tips:
      aiSelfCare.length > 0
        ? Array.from(new Set([...localEvaluation.self_care_tips, ...aiSelfCare])).slice(0, 8)
        : localEvaluation.self_care_tips,
    when_to_seek_medical_advice:
      aiSeekCare.length > 0
        ? Array.from(new Set([...localEvaluation.when_to_seek_medical_advice, ...aiSeekCare])).slice(0, 8)
        : localEvaluation.when_to_seek_medical_advice,
    // CRITICAL: Always preserve the local deterministic emergency_safety and disclaimer!
    emergency_safety: localEvaluation.emergency_safety,
    disclaimer: MEDICAL_DISCLAIMER,
  };
}

/**
 * Primary entry point for symptom evaluation.
 * 1. ALWAYS runs the free deterministic local engine first (including the Emergency Safety Layer).
 * 2. If `OPENAI_ENABLED !== 'true'` or `OPENAI_API_KEY` is missing, immediately returns the free local evaluation
 *    with zero external network calls.
 * 3. If explicitly enabled and configured (or when an injected `mockRequester` is provided in unit tests),
 *    sends only sanitized, non-identifying symptom data with a strict timeout, validates untrusted output,
 *    never overrides deterministic emergency warnings, and falls back gracefully to the local engine on any error.
 */
async function evaluateSymptomsWithOptionalAi(
  input,
  { mockRequester = null, envOverride = null } = {}
) {
  // Step 1: Deterministic local evaluation + emergency safety screening ALWAYS runs first
  const localEvaluation = evaluateSymptomsLocal(input);

  const env = envOverride || process.env;
  const enabledFlag =
    String(env.OPENAI_ENABLED || 'false')
      .trim()
      .toLowerCase() === 'true';
  const apiKey = env.OPENAI_API_KEY ? String(env.OPENAI_API_KEY).trim() : '';

  // Step 2: If disabled or no API key, return the free local engine output immediately
  if (!enabledFlag || !apiKey) {
    return {
      ...localEvaluation,
      engine_used: 'local_rule_engine',
      engine_label: 'Free Smart Assistant (Local Deterministic Engine)',
      openai_enabled: false,
      openai_used: false,
    };
  }

  // Step 3: Build sanitized non-identifying payload (no PII, no patient_id, no Firebase UID)
  const sanitizedPayload = buildSanitizedOpenAiPayload(input);
  const model = (env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim();
  const timeoutMs = Number(env.OPENAI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

  try {
    let rawContent;

    if (typeof mockRequester === 'function') {
      // Used strictly by automated unit/integration tests so zero real/paid API calls occur
      rawContent = await mockRequester({
        model,
        timeoutMs,
        sanitizedPayload,
      });
    } else {
      // Bounded HTTPS request to OpenAI Chat Completions with AbortController timeout
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: 450,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content:
                  'You are a non-diagnostic health education assistant. Never diagnose diseases, never output probabilities or confidence scores, and never downplay emergency symptoms. Return JSON with keys: context_explanations (array of {aspect, explanation}), follow_up_questions (array of strings), self_care_tips (array of strings), when_to_seek_medical_advice (array of strings).',
              },
              {
                role: 'user',
                content: JSON.stringify(sanitizedPayload),
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API responded with status ${response.status}`);
        }

        const body = await response.json();
        rawContent = body?.choices?.[0]?.message?.content;
      } finally {
        clearTimeout(timer);
      }
    }

    return sanitizeUntrustedAiOutput(rawContent, localEvaluation);
  } catch (_err) {
    // Graceful fallback to the free deterministic local engine without exposing keys or failing the user request
    return {
      ...localEvaluation,
      engine_used: 'local_rule_engine',
      engine_label: 'Free Smart Assistant (Local Deterministic Engine)',
      openai_enabled: true,
      openai_used: false,
      openai_fallback_reason: 'OpenAI unavailable or timed out; served by Free Smart Local Engine.',
    };
  }
}

module.exports = {
  isOpenAiEnabled,
  getOpenAiConfigStatus,
  redactPotentialPii,
  buildSanitizedOpenAiPayload,
  sanitizeUntrustedAiOutput,
  evaluateSymptomsWithOptionalAi,
};
