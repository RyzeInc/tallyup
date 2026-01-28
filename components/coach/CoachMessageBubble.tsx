"use client";

import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import CoachAvatar from "./CoachAvatar";
import ChunkedResponse, { parseIntoChunks, ResponseChunk, ChunkAction } from "./ChunkedResponse";

/**
 * Preprocess markdown content to fix common LLM formatting issues
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

  return processed;
}

/**
 * CoachMessageBubble - Chat message bubble for coach conversations
 * 
 * Renders user or coach messages with appropriate styling.
 * Supports progressive disclosure via chunked responses for long messages.
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
  /** Called when user selects a chunk action */
  onChunkAction?: (action: ChunkAction, chunkId: string) => void;
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
  onChunkAction,
  className = "",
}: CoachMessageBubbleProps) {
  const isUser = role === "user";
  
  // Parse content into chunks if enabled and content is long
  const shouldChunk = useMemo(() => {
    return !isUser && enableChunking && content.length > CHUNK_THRESHOLD;
  }, [isUser, enableChunking, content.length]);
  
  const chunks = useMemo(() => {
    if (!shouldChunk) return null;
    return parseIntoChunks(content, { maxChars: 280 });
  }, [shouldChunk, content]);
  
  // Track chunk progress
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  
  const handleChunkAdvance = (index: number) => {
    setCurrentChunkIndex(index);
    onChunkAdvance?.(index);
  };

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
        ) : shouldChunk && chunks ? (
          // Chunked progressive disclosure for long messages
          <ChunkedResponse
            chunks={chunks}
            currentChunkIndex={currentChunkIndex}
            onAdvance={handleChunkAdvance}
            onAction={onChunkAction}
          />
        ) : (
          // Standard markdown rendering for short messages
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

        {/* Visual cards (displayed after text content) */}
        {!isUser && cards.length > 0 && (
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
