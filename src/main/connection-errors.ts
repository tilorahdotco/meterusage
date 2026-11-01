/** Fixed Windows connection messages; electron.ts lists every message the renderer may show. */
export const connectionErrors = {
  claudeWindows: "Could not unlock Claude Desktop's Windows-protected key. Open Claude Desktop and sign in, then try connecting again.",
  grokWindows: "Could not connect Grok Bot Desktop. Sign in to Grok Bot, check allowance, then reconnect.",
  codexWindows: "Open Codex on this PC, then try connecting again",
  codexMissingWindows: "Codex CLI not found. Install the Codex CLI, then try connecting again",
} as const;
