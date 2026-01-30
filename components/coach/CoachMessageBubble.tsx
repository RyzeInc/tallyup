"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import CoachAvatar from "./CoachAvatar";
import { SmartChunkedResponse } from "./ChunkedResponse";
import { isBlockFormatEnabled } from "@/lib/constants";
import BlockRenderer from "./BlockRenderer";
import { parseBlockResponse, markdownToBlocks } from "@/lib/llm/blocks";

/**
 * Preprocess markdown content to fix common LLM formatting issues
 * (Only used when block format is disabled)
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
  processed = processed.replace(/\*\*/g, '%%BOLD%%');
  const italicMatches = processed.match(/\*/g);
  if (italicMatches && italicMatches.length % 2 !== 0) {
    processed = processed + '*';
  }
  processed = processed.replace(/%%BOLD%%/g, '**');

  // STEP 5: Normalize spacing around bold markers to help markdown parser
  processed = processed.replace(/([.!?;:,\)])\s*\*\*/g, '$1 **');
  processed = processed.replace(/([A-Za-z0-9])\*\*/g, '$1 **');
  processed = processed.replace(/\*\*([A-Za-z0-9])/g, '** $1');
  
  // STEP 6: Fix spaces inside bold/italic markers (e.g., "** text **" -> "**text**")
  processed = processed.replace(/\*\*\s+([^*]+?)\s+\*\*/g, '**$1**');
  processed = processed.replace(/\*\s+([^*\n]+?)\s+\*/g, '*$1*');
  
  // STEP 7: Fix malformed triple asterisks (e.g., "** Additional tips: ***" -> "**Additional tips:**")
  processed = processed.replace(/\*\*\s*([^*]+?):\s*\*\*\*/g, '**$1:**');
  
  // STEP 8: Renumber ordered lists to ensure continuous numbering
  processed = renumberOrderedLists(processed);

  return processed;
}

/**
 * Renumber all ordered lists in markdown to ensure continuous numbering.
 */
function renumberOrderedLists(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];
  let currentListNumber = 0;
  let inList = false;
  
  for (const line of lines) {
    const listMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    
    if (listMatch) {
      const [, indent, , content] = listMatch;
      
      if (!inList) {
        inList = true;
        currentListNumber = 1;
      } else {
        currentListNumber++;
      }
      
      result.push(`${indent}${currentListNumber}. ${content}`);
    } else {
      if (line.trim() !== '') {
        inList = false;
        currentListNumber = 0;
      }
      result.push(line);
    }
  }
  
  return result.join('\n');
}

/**
 * CoachMessageBubble - Chat message bubble for coach conversations
 * 
 * Renders user or coach messages with appropriate styling.
 * Supports progressive disclosure via chunked responses for long messages.
 * Uses block-based rendering when enabled for reliable formatting.
 * 
 * Response Length Guidelines (1-3-1 Rule):
 * - 1 main insight per message
 * - 3 sentences maximum in voice/text
 * - 1 clear next action option
 * - Max ~280 characters per chunk
 */

/** Character threshold above which we enable chunking */
const CHUNK_THRESHOLD = 300;

interface CoachMessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
  isLoading?: boolean;
  /** Visual cards to display with the message */
  cards?: React.ReactNode[];
  /** Enable progressive disclosure for long messages */
  enableChunking?: boolean;
  /** Called when user advances through chunks */
  onChunkAdvance?: (chunkIndex: number) => void;
  /** Provider name for telemetry */
  provider?: string;
  className?: string;
}

export default function CoachMessageBubble({
  role,
  content,
  timestamp,
  isLoading = false,
  cards = [],
  enableChunking = true,
  onChunkAdvance,
  provider = "unknown",
  className = "",
}: CoachMessageBubbleProps) {
  const isUser = role === "user";
  const useBlocks = isBlockFormatEnabled();
  
  // Determine if chunking should be used
  const shouldChunk = useMemo(() => {
    return !isUser && enableChunking && content.length > CHUNK_THRESHOLD;
  }, [isUser, enableChunking, content.length]);
  
  // For short messages, parse blocks directly (no chunking)
  const shortMessageParsed = useMemo(() => {
    if (isUser || shouldChunk || !useBlocks) return null;
    
    const parseResult = parseBlockResponse(content);
    if (parseResult.success && parseResult.response) {
      return parseResult.response; // Return full response including title
    }
    // Fallback to markdown conversion
    return markdownToBlocks(content);
  }, [isUser, shouldChunk, useBlocks, content]);

  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} ${className}`}
    >
      {/* Coach avatar */}
      {!isUser && (
        <div className="shrink-0 self-end">
          <CoachAvatar 
            size="sm" 
            state={isLoading ? "thinking" : "idle"} 
          />
        </div>
      )}

      {/* Message bubble */}
      <div
        className="max-w-[80%] rounded-2xl px-4 py-3"
        style={{
          backgroundColor: isUser ? "var(--primary)" : "var(--surface)",
          color: isUser ? "#FFFFFF" : "var(--text)",
          border: isUser ? "none" : "1px solid var(--border)",
          borderBottomLeftRadius: isUser ? 20 : 4,
          borderBottomRightRadius: isUser ? 4 : 20,
        }}
      >
        {isLoading ? (
          <div className="flex items-center gap-1">
            <span 
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ 
                backgroundColor: "var(--text-secondary)",
                animationDelay: "0ms" 
              }}
            />
            <span 
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ 
                backgroundColor: "var(--text-secondary)",
                animationDelay: "150ms" 
              }}
            />
            <span 
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ 
                backgroundColor: "var(--text-secondary)",
                animationDelay: "300ms" 
              }}
            />
          </div>
        ) : isUser ? (
          <p style={{ fontSize: "var(--text-body)" }}>{content}</p>
        ) : shouldChunk ? (
          // Chunked progressive disclosure for long messages (uses blocks or markdown)
          <SmartChunkedResponse
            content={content}
            provider={provider}
            cards={cards}
            onAdvance={onChunkAdvance}
            showAll={false}
          />
        ) : useBlocks && shortMessageParsed ? (
          // Block-based rendering for short messages (includes title if present)
          <>
            {shortMessageParsed.title && (
              <h3 
                className="font-semibold mb-2"
                style={{ 
                  fontSize: "var(--text-body)", 
                  color: "var(--text)",
                  fontWeight: 600,
                }}
              >
                {shortMessageParsed.title}
              </h3>
            )}
            {shortMessageParsed.blocks.length > 0 ? (
              <BlockRenderer blocks={shortMessageParsed.blocks} />
            ) : (
              // If we have a title but no blocks, show a fallback message
              <p style={{ fontSize: "var(--text-body)", lineHeight: 1.6, color: "var(--text-secondary)" }}>
                {shortMessageParsed.title ? "Let me know if you'd like me to explain more." : "I'm here to help."}
              </p>
            )}
          </>
        ) : (
          // Legacy markdown rendering for short messages (when blocks disabled)
          <div className="coach-markdown">
            <ReactMarkdown
              remarkPlugins={[remarkBreaks, remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p 
                    className="mb-3 last:mb-0"
                    style={{ fontSize: "var(--text-body)", lineHeight: 1.6 }}
                  >
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-5 mb-3 last:mb-0 space-y-1.5">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-5 mb-3 last:mb-0 space-y-1.5">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="pl-1" style={{ fontSize: "var(--text-body)" }}>{children}</li>
                ),
                strong: ({ children }) => (
                  <strong style={{ fontWeight: 600 }}>{children}</strong>
                ),
                em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
                br: () => <br />,
                code: ({ children }) => (
                  <code
                    className="px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: "var(--surface-2)",
                      fontSize: "var(--text-micro)",
                    }}
                  >
                    {children}
                  </code>
                ),
                a: ({ children, href }) => (
                  <a
                    href={href}
                    className="underline"
                    style={{ color: "var(--primary)" }}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {preprocessMarkdown(content)}
            </ReactMarkdown>
          </div>
        )}

        {/* Visual cards (displayed after text content, but not if using SmartChunkedResponse which handles cards) */}
        {!isUser && !shouldChunk && cards.length > 0 && (
          <div className="mt-3 space-y-3">
            {cards.map((card, idx) => (
              <div key={idx}>{card}</div>
            ))}
          </div>
        )}

        {/* Timestamp */}
        {timestamp && !isLoading && (
          <div
            className="mt-1 text-right"
            style={{
              fontSize: "var(--text-micro)",
              color: isUser ? "rgba(255,255,255,0.7)" : "var(--text-secondary)",
            }}
          >
            {new Date(timestamp).toLocaleTimeString([], { 
              hour: "numeric", 
              minute: "2-digit" 
            })}
          </div>
        )}
      </div>
    </div>
  );
}
