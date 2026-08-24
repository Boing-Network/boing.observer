import { NextResponse } from "next/server";
import {
  parseReviewerAllowlist,
  reviewerVotingConfigured,
} from "@/lib/qa-reviewer-auth";

/**
 * Public: whether the explorer has a reviewer gate configured.
 * Never returns secrets or allowlisted addresses.
 */
export async function GET() {
  const secret = process.env.QA_REVIEWER_TOKEN;
  const allowlist = parseReviewerAllowlist(process.env.QA_REVIEWER_ADDRESSES);
  const operator = Boolean(process.env.BOING_OPERATOR_RPC_TOKEN?.trim());
  return NextResponse.json({
    configured: reviewerVotingConfigured(secret),
    allowlistConfigured: allowlist.size > 0,
    operatorTokenConfigured: operator,
  });
}
