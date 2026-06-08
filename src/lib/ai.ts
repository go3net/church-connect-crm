import type { FollowUpType } from "@prisma/client";

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-haiku-4-5-20251001";

export interface FollowUpSuggestion {
  recommendedType: FollowUpType;
  rationale: string;
  draftMessage: string;
  source: "ai" | "fallback";
}

export interface PersonContext {
  firstName: string;
  status: string; // MemberStatus
  isFirstTimer: boolean;
  lastAttendedDaysAgo: number | null;
  openPrayerRequest: string | null;
  lastOutcome: string | null;
  churchName: string;
}

const SYSTEM = `You are a caring pastoral-care assistant for a church follow-up team in Nigeria.
Given a person's engagement context, recommend the single best next follow-up action and draft a warm, concise, culturally-appropriate message (max 60 words) the team can send. Be encouraging, never pushy. If the person needs prayer, prioritise that.
Respond ONLY with minified JSON: {"recommendedType":"CALL|WHATSAPP|HOME_VISIT|PRAYER","rationale":"one sentence","draftMessage":"the message"}.`;

/** Generate a follow-up suggestion via Claude, with a rule-based fallback. */
export async function generateFollowUpSuggestion(
  ctx: PersonContext
): Promise<FollowUpSuggestion> {
  if (!API_KEY) return fallback(ctx);

  const userBlock = JSON.stringify(ctx);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: [
          { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: `Context: ${userBlock}` }],
      }),
    });
    if (!res.ok) return fallback(ctx);
    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return {
      recommendedType: json.recommendedType,
      rationale: json.rationale,
      draftMessage: json.draftMessage,
      source: "ai",
    };
  } catch {
    return fallback(ctx);
  }
}

/** Deterministic suggestion when the AI is unavailable. */
function fallback(ctx: PersonContext): FollowUpSuggestion {
  if (ctx.openPrayerRequest) {
    return {
      recommendedType: "PRAYER",
      rationale: "There is an open prayer request to follow up on.",
      draftMessage: `Hi ${ctx.firstName}, we've been praying with you about your request. How are things now? We're standing with you. — ${ctx.churchName}`,
      source: "fallback",
    };
  }
  if (ctx.isFirstTimer) {
    return {
      recommendedType: "WHATSAPP",
      rationale: "New guest — a warm personal check-in encourages a return visit.",
      draftMessage: `Hi ${ctx.firstName}, it was a joy having you at ${ctx.churchName}. We'd love to see you again this Sunday — can we save you a seat?`,
      source: "fallback",
    };
  }
  if ((ctx.lastAttendedDaysAgo ?? 0) > 21) {
    return {
      recommendedType: "CALL",
      rationale: "Member has not attended recently and may be drifting.",
      draftMessage: `Hi ${ctx.firstName}, we've missed you at ${ctx.churchName}! Is everything okay? We'd love to reconnect this week.`,
      source: "fallback",
    };
  }
  return {
    recommendedType: "WHATSAPP",
    rationale: "Routine check-in to maintain engagement.",
    draftMessage: `Hi ${ctx.firstName}, just checking in — how has your week been? Anything we can pray with you about? — ${ctx.churchName}`,
    source: "fallback",
  };
}
