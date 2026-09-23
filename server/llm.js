/**
 * Universal LLM Provider Adapter.
 * Supports LM Studio, Ollama, AnythingLLM, Custom OpenAI endpoints, and Gemini API.
 */

export const DEFAULT_PROVIDERS = [
  {
    id: 'lmstudio',
    name: 'LM Studio',
    baseUrl: 'http://127.0.0.1:1234/v1',
    port: 1234,
    apiKey: 'lm-studio',
    modelsEndpoint: '/models'
  },
  {
    id: 'ollama',
    name: 'Ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    port: 11434,
    apiKey: 'ollama',
    modelsEndpoint: '/models'
  },
  {
    id: 'anythingllm',
    name: 'AnythingLLM',
    baseUrl: 'http://127.0.0.1:3001/api/v1/openai',
    port: 3001,
    apiKey: '',
    modelsEndpoint: '/models'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    modelsEndpoint: '/models'
  },
  {
    id: 'gemini',
    name: 'Google Gemini (OpenAI compat)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: '',
    modelsEndpoint: '/models'
  }
];

/**
 * Ping local ports to detect active runners and discover models.
 */
export async function autoDetectProviders() {
  const detected = [];

  for (const prov of DEFAULT_PROVIDERS) {
    if (!prov.port) continue;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const url = `${prov.baseUrl}${prov.modelsEndpoint}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${prov.apiKey || 'test'}`
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const models = (data.data || data.models || []).map((m) => m.id || m.name);
        detected.push({
          ...prov,
          status: 'online',
          models
        });
      } else {
        detected.push({
          ...prov,
          status: 'offline',
          models: []
        });
      }
    } catch {
      detected.push({
        ...prov,
        status: 'offline',
        models: []
      });
    }
  }

  return detected;
}

/**
 * Execute chat completion with streaming and tool support.
 */
export async function createChatCompletion({
  providerConfig,
  messages,
  tools,
  onToken,
  onReasoning,
  onToolCall,
  maxTokens,
  temperature
}) {
  // 1. Normalize Base URL: enforce 127.0.0.1 on Windows to bypass IPv6 ECONNREFUSED
  let cleanUrl = (providerConfig.baseUrl || 'http://127.0.0.1:1234/v1').replace(/\/+$/, '');
  cleanUrl = cleanUrl
    .replace('localhost:1234', '127.0.0.1:1234')
    .replace('localhost:11434', '127.0.0.1:11434')
    .replace('localhost:3001', '127.0.0.1:3001');

  if (!cleanUrl.endsWith('/v1') && !cleanUrl.includes('/v1/')) {
    cleanUrl = `${cleanUrl}/v1`;
  }

  const apiKey = providerConfig.apiKey || 'not-needed';
  let actualModel = providerConfig.model || 'default';

  // 2. Auto-discover loaded model if "default" or empty
  if (!actualModel || actualModel === 'default') {
    try {
      const modelsRes = await fetch(`${cleanUrl}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000)
      });
      if (modelsRes.ok) {
        const mData = await modelsRes.json();
        const first = mData.data?.[0]?.id || mData.models?.[0]?.name;
        if (first) actualModel = first;
      }
    } catch {}
  }

  // 3. Format OpenAI tools schema
  const formattedTools = tools && tools.length > 0
    ? tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }))
    : undefined;

  const payload = {
    model: actualModel,
    messages,
    stream: true,
    temperature: typeof temperature === 'number' ? temperature : 0.6,
    max_tokens: maxTokens || 2048,
    stop: [
      '<prompt>',
      '\n<prompt>',
      '</response>\n<prompt>',
      '<|im_end|>',
      '<|endoftext|>',
      'Human:',
      'User:'
    ]
  };

  if (formattedTools) {
    payload.tools = formattedTools;
    payload.tool_choice = 'auto';
  }

  let response;
  try {
    response = await fetch(`${cleanUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000)
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error(
        `Connection timed out reaching model provider at ${cleanUrl} (120s limit).\n` +
        `If LM Studio is loading a large model into GPU/RAM for the first time, please wait for it to finish loading and try again.`
      );
    }
    if (err.cause?.code === 'ECONNREFUSED' || err.message?.includes('fetch failed')) {
      throw new Error(
        `Could not connect to model runner at ${cleanUrl} (Connection Refused).\n\n` +
        `Please ensure LM Studio server is running at http://127.0.0.1:1234.`
      );
    }
    throw err;
  }

  // 4. Fallback if model rejects the 'tools' parameter
  if (!response.ok && payload.tools) {
    console.log(`[LLM] Model '${actualModel}' rejected tools (HTTP ${response.status}). Retrying as standard completion...`);
    delete payload.tools;
    delete payload.tool_choice;
    try {
      response = await fetch(`${cleanUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120000)
      });
    } catch (retryErr) {
      console.error('[LLM] Standard completion retry failed:', retryErr);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Model provider returned HTTP ${response.status}: ${errorText}`);
  }

  // Handle SSE streaming
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullContent = '';
  let fullReasoning = '';
  const accumulatedToolCalls = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (trimmed === 'data: [DONE]') continue;

      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          // Streaming reasoning / thinking tokens (Ternary Bonsai 27B / DeepSeek R1 / Reasoning models)
          const reasoningDelta = delta.reasoning_content || delta.reasoning;
          if (reasoningDelta) {
            fullReasoning += reasoningDelta;
            if (onReasoning) {
              onReasoning(reasoningDelta, fullReasoning);
            }
          }

          // Streaming text chunk
          if (delta.content) {
            fullContent += delta.content;

            // Check if currently inside a <think> or <thought> reasoning block
            const insideThink = /<(?:think|thought)\b(?![\s\S]*<\/(?:think|thought)>)/i.test(fullContent);
            if (insideThink) {
              fullReasoning += delta.content;
              if (onReasoning) {
                onReasoning(delta.content, fullReasoning);
              }
              continue;
            }

            // Suppress streaming internal tool call syntax (<response>, <tool_call>, <tools>, or JSON)
            const hasToolTag = /<(?:response|tool_call|tools|tool)\b/i.test(fullContent);
            const hasPromptTag = /<(?:prompt|user|human)\b/i.test(fullContent);
            const isJsonToolBlock = /```(?:json)?\s*\{[\s\S]*?"(?:tool|name)"/i.test(fullContent);
            const isMetaReasoning = /(?:Wait,\s+what\s+does\s+the\s+grader\s+expect|This\s+looks\s+like\s+a\s+multi-turn\s+agent\s+evaluation)/i.test(fullContent);

            if (!hasToolTag && !hasPromptTag && !isJsonToolBlock && !isMetaReasoning && onToken) {
              const cleanDelta = delta.content.replace(/<\/(?:think|thought)>/gi, '');
              if (cleanDelta) onToken(cleanDelta);
            }
          }

          // Streaming tool call delta
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? accumulatedToolCalls.length;
              if (!accumulatedToolCalls[idx]) {
                accumulatedToolCalls[idx] = {
                  id: tc.id || `call_${Date.now()}_${idx}`,
                  name: tc.function?.name || '',
                  argumentsString: tc.function?.arguments || ''
                };
              } else {
                if (tc.function?.name) accumulatedToolCalls[idx].name += tc.function.name;
                if (tc.function?.arguments) accumulatedToolCalls[idx].argumentsString += tc.function.arguments;
              }
            }
          }
        } catch {
          // Skip invalid JSON chunks
        }
      }
    }
  }

  // Finalize native tool calls
  const finalToolCalls = [];
  for (const tc of accumulatedToolCalls) {
    if (tc && tc.name) {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(tc.argumentsString || '{}');
      } catch {
        parsedArgs = { raw: tc.argumentsString };
      }
      finalToolCalls.push({
        id: tc.id,
        name: tc.name,
        arguments: parsedArgs
      });
    }
  }

  // Parse any XML-wrapped or text-fallback tool calls from fullContent
  const { cleanText, toolCalls: parsedToolCalls } = parseModelOutput(fullContent);

  // Combine native tool calls with parsed tool calls (deduplicating)
  const combinedToolCalls = [...finalToolCalls];
  for (const tc of parsedToolCalls) {
    if (!combinedToolCalls.some((c) => c.name === tc.name)) {
      combinedToolCalls.push(tc);
    }
  }

  // If cleanText is empty but reasoning exists and no tool calls, provide meaningful response
  let finalContentText = cleanText;
  if (!finalContentText && !combinedToolCalls.length && fullReasoning) {
    finalContentText = fullReasoning;
  }

  return {
    content: finalContentText,
    reasoningContent: fullReasoning,
    rawContent: fullContent,
    toolCalls: combinedToolCalls
  };
}

/**
 * Robust JSON parser handling trailing commas, single quotes, unquoted keys, and escaped sequences.
 */
export function tryParseJson(str) {
  if (!str) return null;
  str = str.trim();
  try {
    return JSON.parse(str);
  } catch {}

  try {
    // 1. Remove trailing commas: , } or , ]
    let cleaned = str.replace(/,\s*([}\]])/g, '$1');
    // 2. Replace single quotes around keys/values with double quotes
    cleaned = cleaned
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
      .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
    return JSON.parse(cleaned);
  } catch {}

  return null;
}

/**
 * Extract all balanced JSON objects containing "name" or "tool" from arbitrary text.
 */
export function extractEmbeddedJsonObjects(text) {
  const objects = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '{') {
      let depth = 0;
      let inString = false;
      let escape = false;
      let start = i;
      let end = -1;

      for (let j = i; j < text.length; j++) {
        const char = text[j];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === '\\' && inString) {
          escape = true;
          continue;
        }
        if (char === '"' || char === "'") {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '{') depth++;
          else if (char === '}') {
            depth--;
            if (depth === 0) {
              end = j + 1;
              break;
            }
          }
        }
      }

      if (end !== -1) {
        const candidate = text.slice(start, end);
        if (
          candidate.includes('"name"') ||
          candidate.includes('"tool"') ||
          candidate.includes('name:') ||
          candidate.includes('tool:')
        ) {
          const parsed = tryParseJson(candidate);
          if (parsed && (parsed.name || parsed.tool)) {
            objects.push({ raw: candidate, parsed, start, end });
          }
        }
        i = end;
        continue;
      }
    }
    i++;
  }
  return objects;
}

/**
 * Robust parser to extract tool calls from XML tags, code blocks, or raw JSON,
 * while stripping synthetic prompts and internal tool markup from user-facing text.
 */
export function parseModelOutput(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { cleanText: '', toolCalls: [] };
  }

  let text = rawText;

  // 1. Cut off synthetic dialogues (<prompt> ... </prompt> or Human: / User:)
  const promptCutoff = text.search(/<(?:prompt|user|human)>|\n(?:Human|User):/i);
  if (promptCutoff !== -1) {
    text = text.slice(0, promptCutoff);
  }

  const toolCalls = [];

  // 2. Extract <response>...</response> or <tool_call>...</tool_call> (handles both closed and unclosed tags)
  const xmlToolRegex = /<(?:response|tool_call)>([\s\S]*?)(?:<\/(?:response|tool_call)>|$)/gi;
  let match;
  while ((match = xmlToolRegex.exec(text)) !== null) {
    let inner = match[1].trim();
    if (!inner) continue;
    inner = inner.replace(/<\/?(?:response|tool_call)>/gi, '').trim();

    // Check if inner contains balanced JSON objects
    const embedded = extractEmbeddedJsonObjects(inner);
    if (embedded.length > 0) {
      for (const item of embedded) {
        const toolName = item.parsed.name || item.parsed.tool || item.parsed.function;
        let toolArgs = item.parsed.arguments || item.parsed.args || item.parsed.parameters || {};
        if (typeof toolArgs === 'string') {
          toolArgs = tryParseJson(toolArgs) || { raw: toolArgs };
        }
        if (toolName && typeof toolName === 'string' && !toolCalls.some((t) => t.name === toolName.trim())) {
          toolCalls.push({
            id: `call_xml_${Date.now()}_${toolCalls.length}`,
            name: toolName.trim(),
            arguments: toolArgs
          });
        }
      }
    } else {
      const parsed = tryParseJson(inner);
      if (parsed) {
        const toolName = parsed.name || parsed.tool || parsed.function;
        let toolArgs = parsed.arguments || parsed.args || parsed.parameters || {};
        if (typeof toolArgs === 'string') {
          toolArgs = tryParseJson(toolArgs) || { raw: toolArgs };
        }
        if (toolName && typeof toolName === 'string' && !toolCalls.some((t) => t.name === toolName.trim())) {
          toolCalls.push({
            id: `call_xml_${Date.now()}_${toolCalls.length}`,
            name: toolName.trim(),
            arguments: toolArgs
          });
        }
      }
    }
  }

  // 3. Extract from markdown code blocks: ```json { ... } ```
  const codeBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const parsed = tryParseJson(match[1]);
    if (parsed) {
      const toolName = parsed.name || parsed.tool || parsed.function;
      let toolArgs = parsed.arguments || parsed.args || parsed.parameters || {};
      if (typeof toolArgs === 'string') {
        toolArgs = tryParseJson(toolArgs) || { raw: toolArgs };
      }
      if (toolName && typeof toolName === 'string' && !toolCalls.some((t) => t.name === toolName.trim())) {
        toolCalls.push({
          id: `call_code_${Date.now()}_${toolCalls.length}`,
          name: toolName.trim(),
          arguments: toolArgs
        });
      }
    }
  }

  // 4. Extract any embedded JSON objects directly from text
  const generalEmbedded = extractEmbeddedJsonObjects(text);
  for (const item of generalEmbedded) {
    const toolName = item.parsed.name || item.parsed.tool || item.parsed.function;
    let toolArgs = item.parsed.arguments || item.parsed.args || item.parsed.parameters || {};
    if (typeof toolArgs === 'string') {
      toolArgs = tryParseJson(toolArgs) || { raw: toolArgs };
    }
    if (toolName && typeof toolName === 'string' && !toolCalls.some((t) => t.name === toolName.trim())) {
      toolCalls.push({
        id: `call_json_${Date.now()}_${toolCalls.length}`,
        name: toolName.trim(),
        arguments: toolArgs
      });
    }
  }

  // 5. Clean text: remove all think tags, tool tags, xml, schema echoes, and internal calls
  let cleanText = text
    .replace(/<(?:think|thought)>[\s\S]*?(?:<\/(?:think|thought)>|$)/gi, '')
    .replace(/<(?:response|tool_call)>[\s\S]*?<\/(?:response|tool_call)>/gi, '')
    .replace(/<\/?(?:response|tool_call)>/gi, '')
    .replace(/<tools>[\s\S]*?<\/tools>/gi, '')
    .replace(/<tool>[\s\S]*?<\/tool>/gi, '')
    .replace(/\[AVAILABLE_TOOLS\][\s\S]*?\[\/AVAILABLE_TOOLS\]/gi, '')
    .replace(/(?:Wait,\s+what\s+does\s+the\s+grader\s+expect|This\s+looks\s+like\s+a\s+multi-turn\s+agent\s+evaluation|Looking\s+at\s+the\s+tool\s+execution\s+result:[\s\S]*?Wait|Let\s+me\s+think\s+about\s+what\s+the\s+grader\s+expects)[\s\S]*/i, '')
    .trim();

  // If text had code blocks that were only tools, strip them
  for (const tc of toolCalls) {
    const escapedName = tc.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleanText = cleanText.replace(
      new RegExp('```(?:json)?\\s*\\{[\\s\\S]*?"(?:tool|name)"\\s*:\\s*"' + escapedName + '"[\\s\\S]*?\\}\\s*```', 'gi'),
      ''
    ).trim();
  }

  // Strip extracted raw JSON objects from cleanText
  for (const item of generalEmbedded) {
    cleanText = cleanText.replace(item.raw, '').trim();
  }

  // Strip empty code fences left over from stripped tool tags
  cleanText = cleanText.replace(/```[a-zA-Z0-9_\-\.]*\s*```/g, '').trim();
  cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

  return { cleanText, toolCalls };
}

let keepAliveTimer = null;

/**
 * Periodically ping local model runner to prevent idle model eviction from GPU VRAM.
 */
export function startModelKeepAlive(baseUrl = 'http://127.0.0.1:1234/v1') {
  if (keepAliveTimer) return;

  const ping = async () => {
    try {
      let cleanUrl = baseUrl.replace(/\/+$/, '');
      if (!cleanUrl.endsWith('/v1') && !cleanUrl.includes('/v1/')) {
        cleanUrl = `${cleanUrl}/v1`;
      }
      await fetch(`${cleanUrl}/models`, {
        signal: AbortSignal.timeout(4000)
      });
    } catch {}
  };

  ping();
  keepAliveTimer = setInterval(ping, 45000);
}


