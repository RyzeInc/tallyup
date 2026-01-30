/**
 * Block-based response schema for structured LLM output.
 * 
 * This replaces markdown responses with a structured JSON format that:
 * 1. Never breaks mid-list during chunking
 * 2. Preserves formatting intent without parsing ambiguity
 * 3. Enables progressive disclosure by block count
 * 4. Supports telemetry for format tracking
 */

import { z } from "zod";

// ============================================
// BLOCK SCHEMAS
// ============================================

/** Individual list item with optional sub-items */
export const ListItemSchema = z.object({
  text: z.string().min(1),
  subItems: z.array(z.string()).optional(),
});

export type ListItem = z.infer<typeof ListItemSchema>;

/** Discriminated union of block types */
export const BlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("paragraph"),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("callout"),
    tone: z.enum(["tip", "warning", "note"]),
    title: z.string().optional(),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("unordered_list"),
    items: z.array(ListItemSchema).min(1),
  }),
  z.object({
    type: z.literal("ordered_list"),
    /** Starting number for list continuation across chunks */
    start: z.number().int().positive().optional(),
    items: z.array(ListItemSchema).min(1),
  }),
]);

export type Block = z.infer<typeof BlockSchema>;

/** Complete response wrapper */
export const BlockResponseSchema = z.object({
  version: z.literal(1),
  title: z.string().optional(),
  blocks: z.array(BlockSchema).min(1),
});

export type BlockResponse = z.infer<typeof BlockResponseSchema>;

// ============================================
// PARSING & VALIDATION
// ============================================

export interface BlockParseResult {
  success: boolean;
  response: BlockResponse | null;
  /** Original raw content for fallback */
  rawContent: string;
  /** Parse error if any */
  error?: string;
  /** Format detected */
  format: "blocks" | "markdown" | "unknown";
}

/**
 * Try to parse LLM response as block format.
 * Returns structured result with fallback info.
 */
export function parseBlockResponse(rawContent: string): BlockParseResult {
  const trimmed = rawContent.trim();
  
  if (!trimmed) {
    return {
      success: false,
      response: null,
      rawContent,
      format: "unknown",
      error: "Empty content",
    };
  }

  // First, try to fix severely malformed JSON before parsing
  const fixedJson = fixMalformedJson(trimmed);

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(fixedJson);
    // Clean up common LLM mistakes before validation
    const cleaned = cleanupMalformedBlocks(parsed);
    const validated = BlockResponseSchema.parse(cleaned);
    return {
      success: true,
      response: validated,
      rawContent,
      format: "blocks",
    };
  } catch {
    // Not valid JSON or doesn't match schema - try original
  }
  
  // Try original content if fixed version failed
  if (fixedJson !== trimmed) {
    try {
      const parsed = JSON.parse(trimmed);
      const cleaned = cleanupMalformedBlocks(parsed);
      const validated = BlockResponseSchema.parse(cleaned);
      return {
        success: true,
        response: validated,
        rawContent,
        format: "blocks",
      };
    } catch {
      // Not valid JSON or doesn't match schema
    }
  }

  // Try extracting JSON from code block
  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (jsonBlockMatch?.[1]) {
    const codeBlockContent = fixMalformedJson(jsonBlockMatch[1].trim());
    try {
      const parsed = JSON.parse(codeBlockContent);
      const cleaned = cleanupMalformedBlocks(parsed);
      const validated = BlockResponseSchema.parse(cleaned);
      return {
        success: true,
        response: validated,
        rawContent,
        format: "blocks",
      };
    } catch {
      // Code block doesn't contain valid block response
    }
  }

  // Last resort: try to extract blocks from the malformed structure
  const extractedBlocks = extractBlocksFromMalformed(trimmed);
  if (extractedBlocks && extractedBlocks.length > 0) {
    try {
      const response = { version: 1 as const, blocks: extractedBlocks };
      const validated = BlockResponseSchema.parse(response);
      return {
        success: true,
        response: validated,
        rawContent,
        format: "blocks",
      };
    } catch {
      // Extraction didn't produce valid blocks
    }
  }

  // Fallback: detect if it looks like markdown
  const looksLikeMarkdown = 
    /^#\s/m.test(trimmed) || // heading
    /^\s*[-*+]\s/m.test(trimmed) || // unordered list
    /^\s*\d+\.\s/m.test(trimmed) || // ordered list
    /\*\*[^*]+\*\*/.test(trimmed) || // bold
    /\*[^*]+\*/.test(trimmed); // italic

  return {
    success: false,
    response: null,
    rawContent,
    format: looksLikeMarkdown ? "markdown" : "unknown",
    error: "Content is not valid block format",
  };
}

// ============================================
// MALFORMED JSON FIXER
// ============================================

/**
 * Fix severely malformed JSON from LLM:
 * 1. Duplicate "blocks" keys (JSON.parse takes last one, we need to merge)
 * 2. Fix truncated/unclosed structures
 */
function fixMalformedJson(json: string): string {
  let fixed = json;
  
  // Check for duplicate "blocks" keys - this is invalid JSON but LLMs do it
  // We need to merge all blocks arrays into one
  const blocksPattern = /"blocks"\s*:\s*\[/g;
  const matches = [...fixed.matchAll(blocksPattern)];
  
  if (matches.length > 1) {
    // Multiple blocks arrays - need to extract and merge them
    // This is a complex fix, try to extract all block content
    try {
      const allBlocks: unknown[] = [];
      
      // Find each "blocks": [ ... ] section
      let searchStart = 0;
      for (const match of matches) {
        const startIdx = match.index! + match[0].length;
        // Find the matching closing bracket
        let depth = 1;
        let i = startIdx;
        while (i < fixed.length && depth > 0) {
          if (fixed[i] === '[') depth++;
          else if (fixed[i] === ']') depth--;
          i++;
        }
        
        if (depth === 0) {
          const blocksContent = fixed.slice(startIdx, i - 1);
          try {
            // Try to parse this blocks array content
            const parsed = JSON.parse(`[${blocksContent}]`);
            if (Array.isArray(parsed)) {
              allBlocks.push(...parsed);
            }
          } catch {
            // Failed to parse this section
          }
        }
        searchStart = i;
      }
      
      if (allBlocks.length > 0) {
        // Extract version and title from original
        const versionMatch = fixed.match(/"version"\s*:\s*(\d+)/);
        const titleMatch = fixed.match(/"title"\s*:\s*"([^"]*)"/);
        
        const reconstructed: Record<string, unknown> = {
          version: versionMatch ? parseInt(versionMatch[1]) : 1,
          blocks: allBlocks,
        };
        if (titleMatch) {
          reconstructed.title = titleMatch[1];
        }
        
        return JSON.stringify(reconstructed);
      }
    } catch {
      // Failed to fix duplicate blocks
    }
  }
  
  // Fix unclosed brackets/braces at end
  let openBrackets = 0;
  let openBraces = 0;
  for (const char of fixed) {
    if (char === '[') openBrackets++;
    else if (char === ']') openBrackets--;
    else if (char === '{') openBraces++;
    else if (char === '}') openBraces--;
  }
  
  // Add missing closings
  while (openBrackets > 0) {
    fixed += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    fixed += '}';
    openBraces--;
  }
  
  return fixed;
}

/**
 * Extract blocks from severely malformed JSON by pattern matching
 */
function extractBlocksFromMalformed(content: string): Block[] | null {
  const blocks: Block[] = [];
  
  // Extract headings: {"type":"heading","level":N,"text":"..."}
  const headingPattern = /\{"type"\s*:\s*"heading"\s*,\s*"level"\s*:\s*(\d)\s*,\s*"text"\s*:\s*"([^"]+)"\s*\}/g;
  let match;
  while ((match = headingPattern.exec(content)) !== null) {
    const level = parseInt(match[1]) as 1 | 2 | 3;
    if (level >= 1 && level <= 3) {
      blocks.push({ type: "heading", level, text: match[2] });
    }
  }
  
  // Extract paragraphs: {"type":"paragraph","text":"..."}
  const paragraphPattern = /\{"type"\s*:\s*"paragraph"\s*,\s*"text"\s*:\s*"([^"]+)"\s*\}/g;
  while ((match = paragraphPattern.exec(content)) !== null) {
    blocks.push({ type: "paragraph", text: match[1] });
  }
  
  // Extract list items from the malformed nested structure
  // Look for {"text":"N. content"} patterns
  const listItemPattern = /\{"text"\s*:\s*"(\d+)\.\s*([^"]+)"\s*\}/g;
  const listItems: { num: number; text: string }[] = [];
  while ((match = listItemPattern.exec(content)) !== null) {
    listItems.push({ num: parseInt(match[1]), text: match[2] });
  }
  
  // Also look for items without numbers
  const plainItemPattern = /\{"text"\s*:\s*"([^"]+)"\s*\}/g;
  while ((match = plainItemPattern.exec(content)) !== null) {
    // Skip if this looks like it was already captured with a number
    if (!/^\d+\./.test(match[1])) {
      listItems.push({ num: listItems.length + 1, text: match[1] });
    }
  }
  
  // If we found list items, create an ordered list block
  if (listItems.length > 0) {
    // Sort by number and dedupe
    const uniqueItems = new Map<string, { num: number; text: string }>();
    for (const item of listItems) {
      const key = item.text.toLowerCase();
      if (!uniqueItems.has(key)) {
        uniqueItems.set(key, item);
      }
    }
    
    const sortedItems = [...uniqueItems.values()].sort((a, b) => a.num - b.num);
    
    // Determine if this should be ordered or unordered
    const hasOrderedType = content.includes('"ordered_list"');
    const hasUnorderedType = content.includes('"unordered_list"');
    
    if (hasUnorderedType && !hasOrderedType) {
      blocks.push({
        type: "unordered_list",
        items: sortedItems.map(item => ({ text: item.text })),
      });
    } else {
      blocks.push({
        type: "ordered_list",
        start: 1,
        items: sortedItems.map(item => ({ text: item.text })),
      });
    }
  }
  
  return blocks.length > 0 ? blocks : null;
}

// ============================================
// MALFORMED BLOCK CLEANUP
// ============================================

/**
 * Clean up common LLM mistakes in block format responses:
 * 1. List items with redundant numbers in text (e.g., "1. Track your income")
 * 2. Malformed nested structures where ordered_list appears inside items
 * 3. Missing version field
 */
function cleanupMalformedBlocks(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  
  const obj = parsed as Record<string, unknown>;
  
  // Ensure version exists
  if (!obj.version) {
    obj.version = 1;
  }
  
  // Fix blocks array
  if (Array.isArray(obj.blocks)) {
    obj.blocks = flattenAndCleanBlocks(obj.blocks);
  }
  
  return obj;
}

/**
 * Recursively flatten malformed nested structures and clean list items.
 * When lists are deeply nested inside items arrays, we flatten everything
 * into a single list with all items.
 */
function flattenAndCleanBlocks(blocks: unknown[]): unknown[] {
  const result: unknown[] = [];
  
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    
    const b = block as Record<string, unknown>;
    
    if (b.type === "ordered_list" || b.type === "unordered_list") {
      // Extract ALL items from this list and any nested lists
      const allItems = extractAllListItems(b.items as unknown[]);
      
      if (allItems.length > 0) {
        // Determine the correct list type - if any numbered items, use ordered
        const hasNumberedItems = allItems.some(item => /^\d+\./.test(item.originalText));
        const listType = b.type === "ordered_list" || hasNumberedItems ? "ordered_list" : "unordered_list";
        
        result.push({
          type: listType,
          ...(listType === "ordered_list" ? { start: 1 } : {}),
          items: allItems.map(item => ({ text: item.cleanedText })),
        });
      }
    } else {
      result.push(block);
    }
  }
  
  return result;
}

/**
 * Recursively extract all list items from a potentially deeply nested structure.
 * Handles the LLM bug where list blocks are nested inside items arrays.
 */
function extractAllListItems(items: unknown[]): { originalText: string; cleanedText: string }[] {
  const result: { originalText: string; cleanedText: string }[] = [];
  
  if (!Array.isArray(items)) {
    return result;
  }
  
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    
    const i = item as Record<string, unknown>;
    
    // Check if this "item" is actually a nested list block (malformed structure)
    if (i.type === "ordered_list" || i.type === "unordered_list") {
      // Recursively extract items from this nested list
      const nestedItems = extractAllListItems(i.items as unknown[]);
      result.push(...nestedItems);
      continue;
    }
    
    // Regular list item - extract and clean the text
    if (typeof i.text === "string") {
      const originalText = i.text;
      // Strip leading number patterns like "1. ", "2) ", etc.
      const cleanedText = originalText.replace(/^\d+[\.\)]\s*/, "").trim();
      
      if (cleanedText) {
        result.push({ originalText, cleanedText });
      }
    }
  }
  
  return result;
}

/**
 * Clean list items by:
 * 1. Stripping redundant leading numbers (e.g., "1. Text" -> "Text")
 * 2. Extracting any nested ordered_list/unordered_list blocks
 * @deprecated Use extractAllListItems instead for deeply nested structures
 */
function cleanListItems(items: unknown[]): { cleanedItems: unknown[]; nestedLists: unknown[] } {
  const cleanedItems: unknown[] = [];
  const nestedLists: unknown[] = [];
  
  if (!Array.isArray(items)) {
    return { cleanedItems: [], nestedLists: [] };
  }
  
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    
    const i = item as Record<string, unknown>;
    
    // Check if this "item" is actually a nested list block (malformed structure)
    if (i.type === "ordered_list" || i.type === "unordered_list") {
      // This is a nested list that should be a sibling, not a child
      const { cleanedItems: nestedClean, nestedLists: deepNested } = cleanListItems(i.items as unknown[]);
      nestedLists.push({
        ...i,
        items: nestedClean,
      });
      nestedLists.push(...deepNested);
      continue;
    }
    
    // Regular list item - clean the text
    if (typeof i.text === "string") {
      // Strip leading number patterns like "1. ", "2) ", etc.
      const cleanedText = i.text.replace(/^\d+[\.\)]\s*/, "").trim();
      
      cleanedItems.push({
        ...i,
        text: cleanedText || i.text, // Fallback to original if cleaning leaves empty
      });
    } else {
      cleanedItems.push(item);
    }
  }
  
  return { cleanedItems, nestedLists };
}

// ============================================
// MARKDOWN FALLBACK PARSER
// ============================================

/**
 * Convert markdown text to block format as a fallback.
 * This handles LLM responses that don't follow the block schema.
 */
export function markdownToBlocks(markdown: string): BlockResponse {
  const blocks: Block[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) {
      i++;
      continue;
    }

    // Heading detection (# ## ###)
    const headingMatch = trimmedLine.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push({ type: "heading", level, text: headingMatch[2].trim() });
      i++;
      continue;
    }

    // Ordered list detection
    const orderedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      const start = parseInt(orderedMatch[1], 10);
      const items: ListItem[] = [];
      
      while (i < lines.length) {
        const listLine = lines[i].trim();
        const itemMatch = listLine.match(/^\d+\.\s+(.+)$/);
        if (!itemMatch) break;
        
        items.push({ text: itemMatch[1] });
        i++;
      }
      
      if (items.length > 0) {
        blocks.push({ type: "ordered_list", start, items });
      }
      continue;
    }

    // Unordered list detection
    const unorderedMatch = trimmedLine.match(/^[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      const items: ListItem[] = [];
      
      while (i < lines.length) {
        const listLine = lines[i].trim();
        const itemMatch = listLine.match(/^[-*+]\s+(.+)$/);
        if (!itemMatch) break;
        
        items.push({ text: itemMatch[1] });
        i++;
      }
      
      if (items.length > 0) {
        blocks.push({ type: "unordered_list", items });
      }
      continue;
    }

    // Callout detection (> Note: or > Tip: or > Warning:)
    const calloutMatch = trimmedLine.match(/^>\s*(Note|Tip|Warning):\s*(.+)$/i);
    if (calloutMatch) {
      const tone = calloutMatch[1].toLowerCase() as "note" | "tip" | "warning";
      let text = calloutMatch[2];
      i++;
      
      // Collect continuation lines
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        const contLine = lines[i].trim().replace(/^>\s*/, "");
        if (contLine) {
          text += " " + contLine;
        }
        i++;
      }
      
      blocks.push({ type: "callout", tone, text: text.trim() });
      continue;
    }

    // Default: paragraph (collect lines until empty or structural element)
    let paragraphText = trimmedLine;
    i++;
    
    while (i < lines.length) {
      const nextLine = lines[i].trim();
      // Stop at empty line or structural elements
      if (!nextLine || 
          /^#{1,3}\s/.test(nextLine) || 
          /^[-*+]\s/.test(nextLine) || 
          /^\d+\.\s/.test(nextLine) ||
          /^>\s/.test(nextLine)) {
        break;
      }
      paragraphText += " " + nextLine;
      i++;
    }
    
    if (paragraphText.trim()) {
      blocks.push({ type: "paragraph", text: paragraphText.trim() });
    }
  }

  // Ensure at least one block
  if (blocks.length === 0) {
    blocks.push({ type: "paragraph", text: markdown.trim() || "I'm here to help." });
  }

  return { version: 1, blocks };
}

// ============================================
// CHUNKING BY BLOCKS
// ============================================

export interface BlockChunk {
  id: string;
  blocks: Block[];
  isFinal: boolean;
  /** For ordered list continuation, the next start number */
  nextListStart?: number;
}

/**
 * Chunk blocks for progressive disclosure.
 * Never splits inside a list block.
 */
export function chunkBlocks(
  response: BlockResponse,
  options?: {
    /** Max blocks per chunk (default: 2) */
    maxBlocksPerChunk?: number;
    /** Always keep heading with next block */
    keepHeadingWithContent?: boolean;
  }
): BlockChunk[] {
  const { maxBlocksPerChunk = 2, keepHeadingWithContent = true } = options || {};
  const chunks: BlockChunk[] = [];
  const allBlocks = response.blocks;
  
  let currentBlocks: Block[] = [];
  let orderedListCounter = 0;

  for (let i = 0; i < allBlocks.length; i++) {
    const block = allBlocks[i];
    const isLastBlock = i === allBlocks.length - 1;

    // Track ordered list numbers for continuation
    if (block.type === "ordered_list") {
      const start = block.start || 1;
      orderedListCounter = start + block.items.length;
    }

    // Check if we should keep heading with next block
    if (keepHeadingWithContent && block.type === "heading" && !isLastBlock) {
      currentBlocks.push(block);
      continue; // Don't count heading against max, wait for content
    }

    currentBlocks.push(block);

    // Check if chunk is full
    const shouldFlush = currentBlocks.length >= maxBlocksPerChunk || isLastBlock;
    
    if (shouldFlush) {
      chunks.push({
        id: `chunk-${chunks.length}`,
        blocks: [...currentBlocks],
        isFinal: isLastBlock,
        nextListStart: orderedListCounter > 0 ? orderedListCounter : undefined,
      });
      currentBlocks = [];
    }
  }

  // Flush any remaining blocks
  if (currentBlocks.length > 0) {
    chunks.push({
      id: `chunk-${chunks.length}`,
      blocks: currentBlocks,
      isFinal: true,
      nextListStart: orderedListCounter > 0 ? orderedListCounter : undefined,
    });
  }

  return chunks.length > 0 ? chunks : [{
    id: "chunk-0",
    blocks: [{ type: "paragraph", text: "I'm here to help." }],
    isFinal: true,
  }];
}

// ============================================
// LIST CONTINUATION UTILITIES
// ============================================

/**
 * Recalculate ordered list start values for continuous numbering.
 * Call this when merging blocks from multiple chunks.
 */
export function recalculateOrderedListStarts(blocks: Block[]): Block[] {
  let nextStart = 1;
  
  return blocks.map(block => {
    if (block.type === "ordered_list") {
      const updatedBlock = {
        ...block,
        start: nextStart,
      };
      nextStart += block.items.length;
      return updatedBlock;
    }
    return block;
  });
}

// ============================================
// TELEMETRY TYPES
// ============================================

export interface FormatTelemetry {
  /** Timestamp of the response */
  timestamp: number;
  /** Provider that generated the response */
  provider: string;
  /** Format detected/used */
  format: "blocks" | "markdown" | "fallback";
  /** Whether block parsing succeeded */
  blockParseSuccess: boolean;
  /** Error message if parsing failed */
  parseError?: string;
  /** Number of blocks in final response */
  blockCount: number;
  /** Block types used */
  blockTypes: string[];
  /** Raw response length */
  rawLength: number;
}

/**
 * Generate telemetry for a response.
 */
export function generateFormatTelemetry(
  parseResult: BlockParseResult,
  provider: string,
  finalBlocks: Block[]
): FormatTelemetry {
  return {
    timestamp: Date.now(),
    provider,
    format: parseResult.success ? "blocks" : (parseResult.format === "markdown" ? "markdown" : "fallback"),
    blockParseSuccess: parseResult.success,
    parseError: parseResult.error,
    blockCount: finalBlocks.length,
    blockTypes: [...new Set(finalBlocks.map(b => b.type))],
    rawLength: parseResult.rawContent.length,
  };
}
