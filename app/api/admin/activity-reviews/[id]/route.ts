import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin";
import { awardActivityById } from "@/lib/proof/rewards";

const Body = z.object({
  decision: z.enum(["approve", "reject"]),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, admin } = await requireAdmin();
    const { id } = await context.params;
    const body = Body.parse(await req.json());
    const { data: review, error: reviewError } = await admin.from("activity_reviews")
      .select("*,activities(*)").eq("id", id).single();
    if (reviewError || !review) throw reviewError ?? new Error("REVIEW_NOT_FOUND");
    if (review.status !== "queued") return NextResponse.json({ error: "REVIEW_ALREADY_RESOLVED" }, { status: 409 });

    const activity: any = review.activities;
    if (!activity) return NextResponse.json({ error: "ACTIVITY_NOT_FOUND" }, { status: 404 });

    if (body.decision === "approve") {
      const award = await awardActivityById(activity.id, activity.user_id, { reviewApproved: true });
      await admin.from("activity_reviews").update({
        status: "approved", reviewer_id: user.id, notes: body.notes ?? null,
        reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", id);
      return NextResponse.json({ status: "approved", award });
    }

    if (activity.reward_status === "awarded") {
      const { error: reversalError } = await admin.rpc("reverse_activity_reward", {
        p_activity_id: activity.id,
        p_reason: body.notes ?? "Rejected by activity review",
      });
      if (reversalError) {
        await admin.from("activity_reviews").update({
          notes: `${body.notes ?? "Rejected by activity review"}\nREVERSAL_BLOCKED: ${reversalError.message}`,
          updated_at: new Date().toISOString(),
        }).eq("id", id);
        return NextResponse.json({ error: "REVERSAL_BLOCKED", detail: reversalError.message }, { status: 409 });
      }
    } else {
      await admin.from("activities").update({ reward_status: "rejected", verification_level: "unverified", updated_at: new Date().toISOString() }).eq("id", activity.id);
    }
    await admin.from("activity_reviews").update({
      status: "rejected", reviewer_id: user.id, notes: body.notes ?? null,
      reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", id);
    return NextResponse.json({ status: "rejected" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}
