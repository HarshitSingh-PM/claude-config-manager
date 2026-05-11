import { NextResponse } from "next/server";
import {
  defaultProjectDir,
  enterpriseManagedDir,
  osLabel,
  resolveTargets,
  userClaudeDir,
} from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectDir = url.searchParams.get("projectDir");
  const { platform, pretty } = osLabel();
  return NextResponse.json({
    os: { platform, pretty },
    userClaudeDir: userClaudeDir(),
    enterpriseManagedDir: enterpriseManagedDir(),
    defaultProjectDir: defaultProjectDir(),
    targets: resolveTargets(projectDir),
  });
}
