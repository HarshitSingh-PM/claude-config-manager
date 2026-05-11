import type { Schema } from "./types";

export const mcpServerSchema: Schema = {
  id: "mcpServer",
  title: "MCP Server",
  description: "One MCP server entry inside .mcp.json or settings.json mcpServers map.",
  format: "json",
  fields: [
    {
      type: "string",
      key: "name",
      label: "Server name",
      tooltip: "Key under mcpServers. Used as the prefix for tool names: mcp__<name>__<tool>.",
      placeholder: "github",
    },
    {
      type: "select",
      key: "type",
      label: "Transport",
      tooltip:
        "How Claude talks to the server. `stdio` launches a local process; `http`/`sse` calls a URL.",
      options: [
        { value: "stdio", label: "stdio (local process)" },
        { value: "http", label: "http (remote)" },
        { value: "sse", label: "sse (remote streaming)" },
      ],
      default: "stdio",
    },
    {
      type: "string",
      key: "command",
      label: "Command (stdio only)",
      tooltip: "Executable or interpreter. Supports ${VAR} expansion.",
      placeholder: "npx",
    },
    {
      type: "list",
      key: "args",
      label: "Args (stdio only)",
      tooltip: "Arguments to pass to the command.",
      itemPlaceholder: "-y",
    },
    {
      type: "string",
      key: "url",
      label: "URL (http/sse only)",
      tooltip: "Endpoint URL. Supports ${VAR} and ${VAR:-default} expansion.",
      placeholder: "https://api.example.com/mcp/",
    },
    {
      type: "kv",
      key: "headers",
      label: "HTTP headers (http/sse only)",
      tooltip: "Static headers sent with every request. Use headersHelper for dynamic ones.",
    },
    {
      type: "kv",
      key: "env",
      label: "Environment variables",
      tooltip: "Env exported into the subprocess (stdio) or available to headersHelper.",
    },
    {
      type: "boolean",
      key: "alwaysLoad",
      label: "Always load tools",
      tooltip:
        "Load this server's tools into context at startup instead of deferring.",
      significance: "Turn on for frequently-used servers; off saves context budget.",
    },
  ],
};
