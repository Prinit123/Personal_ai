// src/utils/instructionRouter.ts — Deterministic AI Intent Router for Nilesh
// Detects explicit command suffixes and standalone commands, resolving context from conversation history.

export type RouterCommand =
  | 'fix this'
  | 'explain concept'
  | 'give output'
  | 'create algorithm'
  | 'create graph'
  | 'simple'
  | 'medium'
  | 'hard'
  | 'create flowchart'
  | 'analyze project'
  | 'apply changes'
  | 'summarize';

export interface RoutedIntent {
  hasCommand: boolean;
  command: RouterCommand | null;
  cleanQuery: string;
  instructionPrompt: string;
  responseStructureGuide?: string;
  referencedCodeSnippet?: string;
}

// Ordered list: longer phrases first to avoid greedy prefix collisions
const SUPPORTED_COMMANDS: Array<{ command: RouterCommand; regex: RegExp }> = [
  { command: 'explain concept', regex: /\bexplain\s+concept\b/i },
  { command: 'create algorithm', regex: /\bcreate\s+algorithm\b/i },
  { command: 'create flowchart', regex: /\bcreate\s+flowchart\b/i },
  { command: 'create graph', regex: /\bcreate\s+graph\b/i },
  { command: 'analyze project', regex: /\banalyze\s+project\b/i },
  { command: 'apply changes', regex: /\bapply\s+changes\b/i },
  { command: 'give output', regex: /\bgive\s+output\b/i },
  { command: 'fix this', regex: /\bfix\s+this\b/i },
  { command: 'summarize', regex: /\bsummarize\b/i },
  { command: 'simple', regex: /\bsimple\b/i },
  { command: 'medium', regex: /\bmedium\b/i },
  { command: 'hard', regex: /\bhard\b/i },
];

/**
 * Strips code blocks and quotes from text to prevent false command triggers
 * inside source code or uploaded data.
 */
function stripCodeAndQuotes(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '') // remove fenced blocks
    .replace(/`[^`]+`/g, '')        // remove inline code
    .replace(/"[^"]*"/g, '')        // remove double-quoted strings
    .replace(/'[^']*'/g, '');       // remove single-quoted strings
}

/**
 * Detects if a command is explicitly present in the user query.
 * Checks:
 * 1. Standalone command (e.g. "fix this")
 * 2. Command at the end of the message (e.g. "What is inheritance in C++? simple")
 * 3. Exact command in the non-code portion of the message.
 */
export function detectRouterCommand(rawMessage: string): { command: RouterCommand | null; cleanQuery: string } {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return { command: null, cleanQuery: '' };
  }

  const trimmed = rawMessage.trim();
  const lower = trimmed.toLowerCase();

  // 1. Direct standalone match
  for (const item of SUPPORTED_COMMANDS) {
    if (lower === item.command) {
      return { command: item.command, cleanQuery: '' };
    }
  }

  // 2. Command at the end of the message (punctuation tolerant: ?, ., !)
  for (const item of SUPPORTED_COMMANDS) {
    const endRegex = new RegExp(`[\\s,.:;?!]+${item.command}[.!?]*$`, 'i');
    if (endRegex.test(trimmed)) {
      const clean = trimmed.replace(endRegex, '').trim();
      return { command: item.command, cleanQuery: clean };
    }
  }

  // 3. Search outside code/quotes
  const safeText = stripCodeAndQuotes(trimmed);
  for (const item of SUPPORTED_COMMANDS) {
    if (item.regex.test(safeText)) {
      // Remove command from the query
      const clean = trimmed.replace(item.regex, '').trim().replace(/\s{2,}/g, ' ');
      return { command: item.command, cleanQuery: clean };
    }
  }

  return { command: null, cleanQuery: trimmed };
}

/**
 * Extracts the most recent code block or snippet from conversation history
 * when a user refers to "this" or asks a follow-up about previously supplied code.
 */
export function findLastCodeInHistory(history: Array<{ role: string; content: string }>): string | null {
  if (!Array.isArray(history)) return null;

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (!msg || !msg.content) continue;

    // Check for fenced code block
    const match = /```(?:[a-zA-Z0-9_-]+)?\r?\n([\s\S]*?)```/.exec(msg.content);
    if (match && match[1]?.trim().length > 5) {
      return match[1].trim();
    }

    // Check for code indicators (def, function, class, import, return, #include, etc.)
    const text = msg.content.trim();
    if (
      /\b(def\s+[a-zA-Z0-9_]+\s*\(|function\s+[a-zA-Z0-9_]*\s*\(|class\s+[a-zA-Z0-9_]+|#include\s*<|console\.log|print\s*\(|return\s+)/.test(text) ||
      (text.includes('{') && text.includes('}')) ||
      (text.includes('(') && text.includes(')') && text.includes(':'))
    ) {
      return text;
    }
  }

  return null;
}

/**
 * Routes the user prompt and generates strict system directives for Nilesh.
 */
export function routeUserInstruction(
  userMessage: string,
  history: Array<{ role: string; content: string }> = []
): RoutedIntent {
  const { command, cleanQuery } = detectRouterCommand(userMessage);

  if (!command) {
    return {
      hasCommand: false,
      command: null,
      cleanQuery: userMessage,
      instructionPrompt: '',
    };
  }

  let instructionPrompt = '';
  let responseStructureGuide = '';
  let referencedCode = '';

  // Check if code was in the current message
  const hasCodeInCurrent = /```[\s\S]*?```/.test(userMessage);
  if (!hasCodeInCurrent && (command === 'fix this' || command === 'give output' || command === 'explain concept' || command === 'create algorithm')) {
    const found = findLastCodeInHistory(history);
    if (found) {
      referencedCode = found;
    }
  }

  switch (command) {
    case 'fix this':
      instructionPrompt = `[STRICT DIRECTIVE — FIX THIS]:
The user has issued the command "fix this". You MUST analyze the supplied code (or the code from the recent conversation context), identify any syntax, logical, or runtime errors, and provide a corrected version.
You MUST strictly follow this 4-part response structure:
1. **Problem:** Identify clearly what is wrong with the code and why it fails.
2. **Corrected code:** Provide the complete, working, corrected code in a proper code block.
3. **Explanation:** Explain why this correction solves the problem.
4. **Output:** Provide the expected output of the corrected code.
Do NOT show a menu of options. Follow this command directly.`;
      responseStructureGuide = '1. Problem\n2. Corrected code\n3. Explanation\n4. Output';
      break;

    case 'explain concept':
      instructionPrompt = `[STRICT DIRECTIVE — EXPLAIN CONCEPT]:
The user has issued the command "explain concept".
- Explain the requested concept in clear, simple language as an encouraging personal teacher.
- Use simple definitions, small concrete examples, and Markdown tables where comparison helps.
- Ground the explanation in the specific code or domain requested.
Do NOT show a menu of options. Follow this command directly.`;
      break;

    case 'give output':
      instructionPrompt = `[STRICT DIRECTIVE — GIVE OUTPUT]:
The user has issued the command "give output".
- Give the EXACT output of the supplied code FIRST at the very top of your response.
- Distinguish between verified output (if deterministic) and reasoned expected output.
- Only explain the output if brief clarification is necessary.
- Never invent imaginary output.
Do NOT show a menu of options. Follow this command directly.`;
      break;

    case 'create algorithm':
      instructionPrompt = `[STRICT DIRECTIVE — CREATE ALGORITHM]:
The user has issued the command "create algorithm".
- Provide a clean, step-by-step algorithm with numbered steps (1, 2, 3...).
- Clearly specify:
  1. Input / Preconditions
  2. Step-by-step procedure from start to end
  3. Output / Postconditions
  4. Time and Space Complexity (Big-O analysis)
Do NOT show a menu of options. Follow this command directly.`;
      break;

    case 'create graph':
      instructionPrompt = `[STRICT DIRECTIVE — CREATE GRAPH]:
The user has issued the command "create graph".
- Generate a visual graph, chart, or plot representation based on the supplied equation, function, or data points.
- Provide:
  1. Key data points / coordinates table
  2. ASCII or formatted Markdown chart / Mermaid diagram representing the graph
  3. Python code (using matplotlib/seaborn) to reproduce the exact graph locally
Do NOT show a menu of options. Follow this command directly.`;
      break;

    case 'simple':
      instructionPrompt = `[STRICT DIRECTIVE — SIMPLE LEARNING MODE]:
The user requested a "simple" explanation.
- Explain the concept as a patient, beginner-friendly teacher would.
- Avoid unnecessary jargon; use simple real-life analogies.
- Use a small, easy-to-understand code example.
Do NOT show a menu of options. Follow this command directly.`;
      break;

    case 'medium':
      instructionPrompt = `[STRICT DIRECTIVE — MEDIUM LEARNING MODE]:
The user requested a "medium" intermediate-level explanation.
- Provide a solid technical explanation with standard terminology, practical use cases, and realistic code examples.
- Include common gotchas and best practices.
Do NOT show a menu of options. Follow this command directly.`;
      break;

    case 'hard':
      instructionPrompt = `[STRICT DIRECTIVE — HARD LEARNING MODE]:
The user requested a "hard" advanced explanation.
- Provide a detailed, deep-dive architectural analysis.
- Cover internal mechanisms, memory models, compiler/interpreter details, edge cases, performance trade-offs, and enterprise design patterns.
Do NOT show a menu of options. Follow this command directly.`;
      break;

    case 'create flowchart':
      instructionPrompt = `[STRICT DIRECTIVE — CREATE FLOWCHART]:
The user has issued the command "create flowchart".
- Generate a clean, complete flowchart using Mermaid syntax (\`\`\`mermaid ... \`\`\`).
- Clearly represent: Start, Decisions (if/else), Processes/Actions, Loops, and End.
- Provide a brief summary of the flow below the diagram.
Do NOT show a menu of options. Follow this command directly.`;
      break;

    case 'analyze project':
      instructionPrompt = `[STRICT DIRECTIVE — ANALYZE PROJECT]:
The user has issued the command "analyze project".
- Inspect the project structure, dependencies, and source files.
- Structure your response into:
  1. **Project Overview:** Purpose and tech stack.
  2. **Important Files:** Key entry points, routes, and modules.
  3. **Architecture:** How data flows between components.
  4. **Existing Problems:** Bugs, security vulnerabilities, or anti-patterns detected.
  5. **Recommended Fixes:** Concrete, actionable improvements.
Do NOT show a menu of options. Follow this command directly.`;
      break;

    case 'apply changes':
      instructionPrompt = `[STRICT DIRECTIVE — APPLY CHANGES]:
The user has issued the command "apply changes".
- Implement the requested or previously agreed modifications.
- Provide complete, copy-paste ready code using the file block format:
  \`\`\`language:relative/path/to/file.ext
  // full updated file content
  \`\`\`
Do NOT show a menu of options. Follow this command directly.`;
      break;

    case 'summarize':
      instructionPrompt = `[STRICT DIRECTIVE — SUMMARIZE]:
The user has issued the command "summarize".
- Provide a clear, high-density summary of the requested question, code, file, or conversation.
- Highlight key takeaways, decisions, and actionable points in bullet format.
Do NOT show a menu of options. Follow this command directly.`;
      break;
  }

  if (referencedCode) {
    instructionPrompt += `\n\n[CONVERSATION CONTEXT - PREVIOUSLY SUPPLIED CODE BEING REFERENCED]:\n\`\`\`\n${referencedCode}\n\`\`\``;
  }

  return {
    hasCommand: true,
    command,
    cleanQuery,
    instructionPrompt,
    responseStructureGuide,
    referencedCodeSnippet: referencedCode || undefined,
  };
}
