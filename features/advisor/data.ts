import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AdvisorConversation, AdvisorMessage } from "@/types/database";

/**
 * Read-side data access for advisor conversations (Phase 16).
 *
 * Every query is filtered on a workspace id the caller resolved from their own
 * session, and RLS enforces the same restriction again. §17: a conversation id
 * belonging to another workspace returns nothing rather than a refusal — there
 * is no response that distinguishes "not yours" from "does not exist", so an id
 * cannot be probed for existence.
 */

/** A workspace's threads, most recently used first. */
export async function getConversations(
  workspaceId: string,
  limit = 20,
): Promise<AdvisorConversation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("advisor_conversations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** One thread, or null when it is not this workspace's. */
export async function getConversation(
  workspaceId: string,
  conversationId: string,
): Promise<AdvisorConversation | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("advisor_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Messages in a thread, oldest first.
 *
 * Bounded rather than unlimited: the page renders a conversation, not an
 * archive, and an unbounded read is a slow page waiting to happen on a thread
 * somebody has used for months.
 */
export async function getMessages(
  workspaceId: string,
  conversationId: string,
  limit = 50,
): Promise<AdvisorMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("advisor_messages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return data ?? [];
}

export interface ConversationDetail {
  conversation: AdvisorConversation;
  messages: AdvisorMessage[];
}

/** A thread and its turns, or null when the caller may not see it. */
export async function getConversationDetail(
  workspaceId: string,
  conversationId: string,
): Promise<ConversationDetail | null> {
  const conversation = await getConversation(workspaceId, conversationId);
  if (!conversation) return null;
  return {
    conversation,
    messages: await getMessages(workspaceId, conversationId),
  };
}
