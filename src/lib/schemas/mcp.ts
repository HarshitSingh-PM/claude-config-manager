import type { Schema } from "./types";

const isStdio = (v: Record<string, unknown>) => !v.type || v.type === "stdio";
const isRemote = (v: Record<string, unknown>) => !isStdio(v);

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
        "How Claude talks to the server. `stdio` launches a local process; `http`, `sse` and `ws` call a URL. An entry with a URL but no type fails to load.",
      options: [
        { value: "stdio", label: "stdio (local process)" },
        { value: "http", label: "http (remote, recommended)" },
        { value: "sse", label: "sse (remote streaming, legacy)" },
        { value: "ws", label: "ws (WebSocket)" },
      ],
      default: "stdio",
    },
    {
      type: "string",
      key: "command",
      label: "Command",
      tooltip: "Executable or interpreter. Supports ${VAR} expansion.",
      placeholder: "npx",
      hidden: isRemote,
    },
    {
      type: "list",
      key: "args",
      label: "Args",
      tooltip: "Arguments to pass to the command.",
      itemPlaceholder: "-y",
      hidden: isRemote,
    },
    {
      type: "kv",
      key: "env",
      label: "Environment variables",
      tooltip: "Env exported into the server subprocess.",
      hidden: isRemote,
    },
    {
      type: "string",
      key: "url",
      label: "URL",
      tooltip: "Endpoint URL. Supports ${VAR} and ${VAR:-default} expansion.",
      placeholder: "https://api.example.com/mcp/",
      hidden: isStdio,
    },
    {
      type: "kv",
      key: "headers",
      label: "HTTP headers",
      tooltip: "Static headers sent with every request. Use the headers helper for dynamic ones.",
      keyPlaceholder: "Authorization",
      valuePlaceholder: "Bearer ${API_TOKEN}",
      hidden: isStdio,
    },
    {
      type: "string",
      key: "headersHelper",
      label: "Headers helper command",
      tooltip:
        "Command that prints request headers as JSON at connection time — for Kerberos, short-lived tokens or internal SSO. Runs only after you trust the folder.",
      placeholder: "/opt/bin/get-mcp-auth-headers.sh",
      hidden: isStdio,
    },
    {
      type: "string",
      key: "oauth.clientId",
      label: "OAuth client ID",
      tooltip: "Pre-registered OAuth client ID, for servers without dynamic client registration.",
      placeholder: "your-client-id",
      hidden: (v) => v.type !== "http" && v.type !== "sse",
    },
    {
      type: "number",
      key: "oauth.callbackPort",
      label: "OAuth callback port",
      tooltip: "Fixed local port for the OAuth redirect, when the provider needs a pre-registered redirect URI.",
      placeholder: "8080",
      min: 1,
      max: 65535,
      hidden: (v) => v.type !== "http" && v.type !== "sse",
    },
    {
      type: "string",
      key: "oauth.scopes",
      label: "OAuth scopes",
      tooltip: "Pin the scopes requested during authorization (space-separated) — restrict a server to an approved subset.",
      placeholder: "channels:read chat:write",
      hidden: (v) => v.type !== "http" && v.type !== "sse",
    },
    {
      type: "string",
      key: "oauth.authServerMetadataUrl",
      label: "OAuth metadata URL",
      tooltip: "Override where authorization-server metadata is discovered. Must be https://.",
      placeholder: "https://auth.example.com/.well-known/openid-configuration",
      hidden: (v) => v.type !== "http" && v.type !== "sse",
    },
    {
      type: "number",
      key: "timeout",
      label: "Tool timeout (ms)",
      tooltip: "Per-server tool execution timeout in milliseconds. Overrides MCP_TOOL_TIMEOUT for this server.",
      placeholder: "600000",
      min: 1,
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
