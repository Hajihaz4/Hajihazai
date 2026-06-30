/**
 * Decide whether a user message warrants memory/knowledge retrieval.
 *
 * Greetings and low-information acknowledgements ("hi", "thanks", "ok") must NOT
 * trigger RAG — otherwise the retrieval layer injects unrelated profile/memory
 * content into small talk (e.g. "hi" → the user's friends list). Pure heuristic,
 * no imports, no model call.
 *
 * Conservative by design: returns false ONLY when the ENTIRE message is a
 * greeting/acknowledgement, so "hi, who is Haji?" still retrieves normally.
 */

// Whole-message greetings / acknowledgements (anchored ^…$, trailing punctuation
// allowed). If the full message matches, retrieval is skipped.
const LOW_INFO_RE =
  /^(hi+|hey+|hello+|holla|hiya|yo+|sup|wassup|what'?s\s*up|whats\s*up|howdy|gm|gn|good\s*(morning|afternoon|evening|night|day)|how\s*(are|r)\s*(you|u|ya)(\s*doing)?|how'?s\s*it\s*going|how\s*do\s*you\s*do|thanks?|thank\s*(you|u)|thx|ty|tysm|cheers|much\s*appreciated|appreciate\s*(it|that)|ok|okay|okey|k|kk|cool|nice|great|awesome|perfect|sweet|fine|sure|alright|all\s*right|got\s*it|gotcha|understood|yep|yup|yeah|yes|no|nope|nah|np|no\s*problem|you'?re\s*welcome|welcome|lol|lmao|haha+|hehe+|hmm+|huh|oh+|ah+|wow|nvm|never\s*mind|good|bye|goodbye|see\s*(you|ya)|cya|later|peace|done)[\s!.?,…)]*$/i;

/**
 * @returns true when the message should run memory + knowledge retrieval.
 */
export function shouldRetrieve(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  // A longer message is never pure small talk, even with a greeting prefix.
  if (m.length > 40) return true;
  return !LOW_INFO_RE.test(m);
}
