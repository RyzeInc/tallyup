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

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(trimmed);
    const validated = BlockResponseSchema.parse(parsed);
    return {
      success: true,
      response: validated,
      rawContent,
      format: "blocks",
    };
  } catch {
    // Not valid JSON or doesn't match schema
  }

  // Try extracting JSON from code block
  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (jsonBlockMatch?.[1]) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      const validated = BlockResponseSchema.parse(parsed);
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
