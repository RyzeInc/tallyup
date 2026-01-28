"use client";

import { useState, useCallback, useMemo } from "react";
import * as Lucide from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import Button from "@/components/ui/Button";
import BlockRenderer from "./BlockRenderer";
import {
  type Block,
  type BlockResponse,
  parseBlockResponse,
  markdownToBlocks,
  chunkBlocks,
  generateFormatTelemetry,
} from "@/lib/llm/blocks";
import { recordFormatTelemetry } from "@/lib/llm/telemetry";
import { isBlockFormatEnabled } from "@/lib/constants";

/**
 * Preprocess markdown content to fix common LLM formatting issues:
 * 1. Unclosed bold/italic markers
 * 2. Ensure numbered lists are properly formatted with double newlines
 * 3. Clean up stray asterisks
 * 4. Convert inline numbered lists to proper markdown lists
 */
function preprocessMarkdown(content: string): string {
  let processed = content;

  // STEP 1: Normalize spacing after sentence-ending punctuation (fixes cases like '.**' and 'accounts.How')
  processed = processed.replace(/([.!?])([^\s\n])/g, '$1 $2');

  // STEP 2: Fix inline numbered list runs into proper lines
  // e.g., "1. First 2. Second" -> insert blank line between items
  processed = processed.replace(/(\d+\.\s+[^\n]+?)\s*(\d+\.)\s+/g, '$1\n\n$2 ');

  // If a numbered list is immediately followed by an unordered list item, ensure a blank line
  processed = processed.replace(/(^\s*\d+\..*\n)(\s*[-*+]\s+)/gm, '$1\n$2');

  // STEP 3: Fix unclosed bold markers (**). If odd count, append a closing marker to preserve intent.
  const boldMatches = processed.match(/\*\*/g);
  if (boldMatches && boldMatches.length % 2 !== 0) {
    processed = processed + '\n\n**';
  }

  // STEP 4: Fix italic markers (*) similarly
  // Temporarily hide ** to avoid confusion
  processed = processed.replace(/\*\*/g, '%%BOLD%%');
  const italicMatches = processed.match(/\*/g);
  if (italicMatches && italicMatches.length % 2 !== 0) {
    processed = processed + '*';
  }
  // Restore **
  processed = processed.replace(/%%BOLD%%/g, '**');

  // STEP 5: Normalize spacing around bold markers to help markdown parser
  // Ensure a space after sentence-ending punctuation before an opening bold (e.g., '.**' -> '. **')
  processed = processed.replace(/([.!?;:,\)])\s*\*\*/g, '$1 **');
  // If alphanumeric is immediately before **, add a space ("word**" -> "word **") for consistency
  processed = processed.replace(/([A-Za-z0-9])\*\*/g, '$1 **');
  // Ensure a space after closing bold if it's immediately followed by a letter/digit
  processed = processed.replace(/\*\*([A-Za-z0-9])/g, '** $1');

  return processed;
}

/**
 * ChunkedResponse - Progressive disclosure for coach messages
 * 
 * Breaks long responses into logical chunks with "Continue" buttons.
 * Implements the 1-3-1 rule: 1 insight, 3 sentences max, 1 clear action.
 * 
 * User controls the pace of information delivery.
 */

export interface ResponseChunk {
  /** Unique ID for the chunk */
  id: string;
  /** The text content (max ~280 chars recommended) */
  content: string;
  /** Optional visual data card to display */
  card?: React.ReactNode;
  /** Actions available at this chunk */
  actions?: ChunkAction[];
  /** Whether this is the final chunk */
  isFinal?: boolean;
}

export interface ChunkAction {
  /** Button label */
  label: string;
  /** Action type for styling */
  type: "continue" | "pause" | "explain" | "action" | "choice";
  /** Handler when clicked */
  onClick: () => void;
  /** Optional icon name */
  icon?: "arrow-right" | "pause" | "help-circle" | "check" | "external-link";
}

interface ChunkedResponseProps {
  /** All chunks in the response */
  chunks: ResponseChunk[];
  /** Currently visible chunk index */
  currentChunkIndex?: number;
  /** Called when user advances to next chunk */
  onAdvance?: (nextIndex: number) => void;
  /** Called when user selects an action */
  onAction?: (action: ChunkAction, chunkId: string) => void;
  /** Show all chunks at once (for review mode) */
  showAll?: boolean;
  className?: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  "arrow-right": <Lucide.ArrowRight style={{ width: 16, height: 16 }} />,
  "pause": <Lucide.Pause style={{ width: 16, height: 16 }} />,
  "help-circle": <Lucide.HelpCircle style={{ width: 16, height: 16 }} />,
  "check": <Lucide.Check style={{ width: 16, height: 16 }} />,
  "external-link": <Lucide.ExternalLink style={{ width: 16, height: 16 }} />,
};

export default function ChunkedResponse({
  chunks,
  currentChunkIndex = 0,
  onAdvance,
  onAction,
  showAll = false,
  className = "",
}: ChunkedResponseProps) {
  const [localIndex, setLocalIndex] = useState(currentChunkIndex);
  
  const visibleIndex = showAll ? chunks.length - 1 : localIndex;
  const visibleChunks = showAll ? chunks : chunks.slice(0, visibleIndex + 1);
  
  // Merge all visible chunks' content into one string for proper list numbering
  const mergedContent = visibleChunks
    .map(chunk => chunk.content)
    .filter(Boolean)
    .join('\n\n');

  const handleContinue = useCallback(() => {
    const nextIndex = localIndex + 1;
    if (nextIndex < chunks.length) {
      setLocalIndex(nextIndex);
      onAdvance?.(nextIndex);
    }
  }, [localIndex, chunks.length, onAdvance]);

  const handleAction = useCallback((action: ChunkAction, chunkId: string) => {
    if (action.type === "continue") {
      handleContinue();
    } else {
      onAction?.(action, chunkId);
    }
  }, [handleContinue, onAction]);
  
  // Get the last visible chunk for showing actions/continue button
  const lastVisibleChunk = visibleChunks[visibleChunks.length - 1];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Render all visible content as one markdown block for proper list numbering */}
      {mergedContent && (
        <div className="coach-markdown">
          <ReactMarkdown
            remarkPlugins={[remarkBreaks, remarkGfm]}
            components={{
              p: ({ children }) => (
                <p 
                  className="mb-3 last:mb-0"
                  style={{ fontSize: "var(--text-body)", lineHeight: 1.6, color: "var(--text)" }}
                >
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc pl-5 mb-3 last:mb-0 space-y-1.5" style={{ color: "var(--text)" }}>
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-5 mb-3 last:mb-0 space-y-1.5" style={{ color: "var(--text)" }}>
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="pl-1" style={{ fontSize: "var(--text-body)", color: "var(--text)" }}>{children}</li>
              ),
              strong: ({ children }) => (
                <strong style={{ fontWeight: 600 }}>{children}</strong>
              ),
              em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
              br: () => <br />,
            }}
          >
            {preprocessMarkdown(mergedContent)}
          </ReactMarkdown>
        </div>
      )}

      {/* Render cards from visible chunks */}
      {visibleChunks.map((chunk) => (
        chunk.card && (
          <div key={`card-${chunk.id}`} className="my-3">
            {chunk.card}
          </div>
        )
      ))}

      {/* Actions - only show for the last visible chunk */}
      {lastVisibleChunk?.actions && lastVisibleChunk.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {lastVisibleChunk.actions.map((action, actionIdx) => (
            <ChunkActionButton
              key={actionIdx}
              action={action}
              onClick={() => handleAction(action, lastVisibleChunk.id)}
            />
          ))}
        </div>
      )}

      {/* Default continue button if not final and no explicit continue action */}
      {lastVisibleChunk && 
       !lastVisibleChunk.isFinal && 
       !showAll &&
       localIndex < chunks.length - 1 &&
       !lastVisibleChunk.actions?.some(a => a.type === "continue") && (
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleContinue}
          >
            <span>Continue</span>
            <Lucide.ChevronRight style={{ width: 16, height: 16, marginLeft: 4 }} />
          </Button>
        </div>
      )}

      {/* Progress indicator */}
      {!showAll && chunks.length > 1 && (
        <div 
          className="flex justify-center gap-1 pt-2"
          style={{ opacity: 0.6 }}
        >
          {chunks.map((_, idx) => (
            <div
              key={idx}
              className="rounded-full transition-all duration-200"
              style={{
                width: idx <= visibleIndex ? 8 : 6,
                height: idx <= visibleIndex ? 8 : 6,
                backgroundColor: idx <= visibleIndex 
                  ? "var(--primary)" 
                  : "var(--border)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Individual action button with appropriate styling
 */
function ChunkActionButton({ 
  action, 
  onClick 
}: { 
  action: ChunkAction; 
  onClick: () => void;
}) {
  const icon = action.icon ? ICON_MAP[action.icon] : null;
  
  // Style based on action type
  const getVariant = () => {
    switch (action.type) {
      case "continue":
        return "outline";
      case "action":
        return "primary";
      case "choice":
        return "ghost";
      default:
        return "ghost";
    }
  };

  return (
    <Button
      variant={getVariant()}
      size="sm"
      onClick={onClick}
    >
      {icon && <span className="mr-1">{icon}</span>}
      {action.label}
    </Button>
  );
}

/**
 * Utility to parse a long message into chunks
 * Splits on double newlines or [CHUNK] markers
 */
export function parseIntoChunks(
  content: string,
  options?: {
    maxChars?: number;
    addContinueButtons?: boolean;
  }
): ResponseChunk[] {
  const { maxChars = 280, addContinueButtons = true } = options || {};
  
  // First try splitting on explicit markers
  if (content.includes("[CHUNK]")) {
    return content.split("[CHUNK]")
      .map((text, idx, arr) => ({
        id: `chunk-${idx}`,
        content: text.trim(),
        isFinal: idx === arr.length - 1,
        actions: addContinueButtons && idx < arr.length - 1
          ? [{ label: "Continue", type: "continue" as const, onClick: () => {} }]
          : undefined,
      }))
      .filter(c => c.content.length > 0);
  }
  
  // Split on double newlines (paragraphs)
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
  
  // If paragraphs are small enough, use them directly
  if (paragraphs.every(p => p.length <= maxChars)) {
    return paragraphs.map((text, idx) => ({
      id: `chunk-${idx}`,
      content: text.trim(),
      isFinal: idx === paragraphs.length - 1,
      actions: addContinueButtons && idx < paragraphs.length - 1
        ? [{ label: "Continue", type: "continue" as const, onClick: () => {} }]
        : undefined,
    }));
  }
  
  // Otherwise, split long paragraphs at sentence boundaries
  const chunks: ResponseChunk[] = [];
  let currentChunk = "";
  
  for (const para of paragraphs) {
    // Split on sentence endings, but preserve numbered lists
    // Match sentences ending with .!? but not digit-period patterns like "1." "2."
    const sentencePattern = /(?<!\d)[.!?]+(?:\s|$)/g;
    const parts: string[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = sentencePattern.exec(para)) !== null) {
      parts.push(para.slice(lastIndex, match.index + match[0].length));
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < para.length) {
      parts.push(para.slice(lastIndex));
    }
    
    const sentences = parts.length > 0 ? parts : [para];
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChars && currentChunk) {
        chunks.push({
          id: `chunk-${chunks.length}`,
          content: currentChunk.trim(),
          isFinal: false,
          actions: addContinueButtons
            ? [{ label: "Continue", type: "continue" as const, onClick: () => {} }]
            : undefined,
        });
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
  }
  
  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      id: `chunk-${chunks.length}`,
      content: currentChunk.trim(),
      isFinal: true,
    });
  }
  
  return chunks;
}

// ============================================
// BLOCK-BASED CHUNKED RESPONSE
// ============================================

export interface BlockChunkedResponseProps {
  /** Raw content from the LLM (JSON blocks or markdown) */
  content: string;
  /** Provider name for telemetry */
  provider?: string;
  /** Visual cards to display */
  cards?: React.ReactNode[];
  /** Called when user advances through chunks */
  onAdvance?: (chunkIndex: number) => void;
  /** Show all chunks at once */
  showAll?: boolean;
  className?: string;
}

/**
 * BlockChunkedResponse - Progressive disclosure using block-based rendering.
 * 
 * This component:
 * 1. Tries to parse content as block format
 * 2. Falls back to markdown→blocks conversion if parsing fails
 * 3. Chunks by blocks (never splitting mid-list)
 * 4. Records telemetry for format tracking
 */
export function BlockChunkedResponse({
  content,
  provider = "unknown",
  cards = [],
  onAdvance,
  showAll = false,
  className = "",
}: BlockChunkedResponseProps) {
  // Parse and chunk on mount
  const { blockChunks, telemetry } = useMemo(() => {
    const parseResult = parseBlockResponse(content);
    
    let finalResponse: BlockResponse;
    let finalBlocks: Block[];
    
    if (parseResult.success && parseResult.response) {
      // Block format parsed successfully
      finalResponse = parseResult.response;
      finalBlocks = finalResponse.blocks;
    } else {
      // Fallback: convert markdown to blocks
      finalResponse = markdownToBlocks(parseResult.rawContent);
      finalBlocks = finalResponse.blocks;
    }
    
    // Generate telemetry
    const telemetryData = generateFormatTelemetry(parseResult, provider, finalBlocks);
    
    // Chunk the blocks
    const chunks = chunkBlocks(finalResponse, {
      maxBlocksPerChunk: 2,
      keepHeadingWithContent: true,
    });
    
    return { blockChunks: chunks, telemetry: telemetryData };
  }, [content, provider]);

  // Record telemetry once on mount
  useMemo(() => {
    recordFormatTelemetry(telemetry);
  }, [telemetry]);

  const [localIndex, setLocalIndex] = useState(0);
  
  const visibleIndex = showAll ? blockChunks.length - 1 : localIndex;
  const visibleChunks = showAll ? blockChunks : blockChunks.slice(0, visibleIndex + 1);
  
  // Merge all visible blocks for rendering
  const visibleBlocks = useMemo(() => {
    return visibleChunks.flatMap(chunk => chunk.blocks);
  }, [visibleChunks]);

  const handleContinue = useCallback(() => {
    const nextIndex = localIndex + 1;
    if (nextIndex < blockChunks.length) {
      setLocalIndex(nextIndex);
      onAdvance?.(nextIndex);
    }
  }, [localIndex, blockChunks.length, onAdvance]);

  const lastVisibleChunk = visibleChunks[visibleChunks.length - 1];
  const hasMore = !showAll && localIndex < blockChunks.length - 1;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Render all visible blocks */}
      <BlockRenderer blocks={visibleBlocks} />

      {/* Render cards */}
      {cards.map((card, idx) => (
        <div key={`card-${idx}`} className="my-3">
          {card}
        </div>
      ))}

      {/* Continue button */}
      {hasMore && !lastVisibleChunk?.isFinal && (
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleContinue}
          >
            <span>Continue</span>
            <Lucide.ChevronRight style={{ width: 16, height: 16, marginLeft: 4 }} />
          </Button>
        </div>
      )}

      {/* Progress indicator */}
      {!showAll && blockChunks.length > 1 && (
        <div 
          className="flex justify-center gap-1 pt-2"
          style={{ opacity: 0.6 }}
        >
          {blockChunks.map((_, idx) => (
            <div
              key={idx}
              className="rounded-full transition-all duration-200"
              style={{
                width: idx <= visibleIndex ? 8 : 6,
                height: idx <= visibleIndex ? 8 : 6,
                backgroundColor: idx <= visibleIndex 
                  ? "var(--primary)" 
                  : "var(--border)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// SMART CHUNKED RESPONSE (AUTO-SELECTS MODE)
// ============================================

export interface SmartChunkedResponseProps {
  /** Raw content from the LLM */
  content: string;
  /** Provider name for telemetry */
  provider?: string;
  /** Visual cards to display */
  cards?: React.ReactNode[];
  /** Called when user advances through chunks */
  onAdvance?: (chunkIndex: number) => void;
  /** Show all chunks at once */
  showAll?: boolean;
  className?: string;
}

/**
 * SmartChunkedResponse - Automatically selects block or markdown mode.
 * 
 * Uses the feature flag to determine rendering mode:
 * - "blocks" or "auto": Uses BlockChunkedResponse
 * - "markdown": Uses legacy ChunkedResponse
 */
export function SmartChunkedResponse({
  content,
  provider = "unknown",
  cards = [],
  onAdvance,
  showAll = false,
  className = "",
}: SmartChunkedResponseProps) {
  const useBlocks = isBlockFormatEnabled();

  if (useBlocks) {
    return (
      <BlockChunkedResponse
        content={content}
        provider={provider}
        cards={cards}
        onAdvance={onAdvance}
        showAll={showAll}
        className={className}
      />
    );
  }

  // Legacy markdown mode
  const chunks = parseIntoChunks(content, { maxChars: 280 });
  
  return (
    <ChunkedResponse
      chunks={chunks}
      onAdvance={onAdvance}
      showAll={showAll}
      className={className}
    />
  );
}
