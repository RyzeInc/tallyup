import { redirect } from "next/navigation";

/**
 * Redirect /coach/chat/[id] to /coach/chat
 * Conversations are now loaded via the sidebar in the main chat page
 * 
 * TODO: Add query param support to auto-select conversation on load
 */
export default function ChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  redirect("/coach/chat");
}
