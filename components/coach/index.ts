// Coach components barrel export
export { default as CoachChat } from "./CoachChat";
export { default as CoachAvatar } from "./CoachAvatar";
export { default as QuickAskInput } from "./QuickAskInput";
export { default as PriorityCard } from "./PriorityCard";
export { default as ModuleProgressPill } from "./ModuleProgressPill";
export { default as CheckInCard } from "./CheckInCard";
export { default as ConversationCard } from "./ConversationCard";
export { default as InsightCard } from "./InsightCard";
export { default as ActionButton } from "./ActionButton";
export { default as CoachMessageBubble } from "./CoachMessageBubble";
export { default as InteractiveAnalysisCard } from "./InteractiveAnalysisCard";
export { default as FollowUpSuggestions } from "./FollowUpSuggestions";
export { default as CoachDashboard } from "./CoachDashboard";
export { default as ChatSidebar, SidebarToggle } from "./ChatSidebar";

// Chunked response & progressive disclosure components
export { default as ChunkedResponse, parseIntoChunks } from "./ChunkedResponse";
export type { ResponseChunk, ChunkAction } from "./ChunkedResponse";

export { default as DataInsightCard, formatMoney, createCashflowCard, createSavingsCard, createExpenseCard } from "./DataInsightCard";
export type { DataCardType } from "./DataInsightCard";

export { default as ActionOptions, PRESET_OPTIONS } from "./ActionOptions";
export type { ActionOption } from "./ActionOptions";
