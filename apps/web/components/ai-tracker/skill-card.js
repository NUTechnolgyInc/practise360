"use client";

import { useState } from "react";
import { Check, Copy, Download, Sparkles } from "lucide-react";
import { buttonVariants, Card, CardHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { monthLabel } from "@/lib/format";

const SKILL_ZIP = "/skills/claude-usage-report.zip";

/** Step 1: get the skill that writes the report, with install steps for Claude.ai and Claude Code. */
export function SkillCard({ period }) {
  const prompt = `Create my Claude usage report for ${monthLabel(period)}`;
  return (
    <Card>
      <CardHeader
        title="1. Generate your report with Claude"
        description="Install the Claude Usage Report skill once. Each month it analyses your Claude history and writes a NULogic-branded PDF."
        actions={
          <a href={SKILL_ZIP} download className={cn(buttonVariants({ variant: "dark", size: "sm" }))}>
            <Download aria-hidden="true" /> Download skill (.zip)
          </a>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Steps
          title="Claude.ai / Claude desktop"
          steps={[
            "Open Settings → Capabilities and turn on Code execution.",
            "Under Skills, choose Upload skill and pick the downloaded .zip.",
            "Turn on past-chat search so Claude can read your month's conversations.",
          ]}
        />
        <Steps
          title="Claude Code"
          steps={[
            <>Unzip into your skills folder: <code className="rounded bg-gray-100 px-1 font-mono text-[11px]">unzip claude-usage-report.zip -d ~/.claude/skills/</code></>,
            "Start a new session — the skill loads automatically.",
            "It reads your local session history; nothing leaves your machine.",
          ]}
        />
      </div>
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-purple-100 bg-purple-50 p-4 sm:flex-row sm:items-center">
        <Sparkles className="size-5 shrink-0 text-nu-purple" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-nu-navy">Then ask Claude</div>
          <p className="font-mono text-xs text-nu-dark-teal">{prompt}</p>
        </div>
        <CopyButton text={prompt} />
      </div>
    </Card>
  );
}

function Steps({ title, steps }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4">
      <h4 className="mb-2 text-sm font-bold">{title}</h4>
      <ol className="space-y-1.5 text-xs text-nu-dark-teal">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-nu-lapis text-[10px] font-bold text-white">{i + 1}</span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" onClick={copy} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? "Copied" : "Copy prompt"}
    </button>
  );
}
