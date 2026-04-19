# mcp-vapi

MCP server for [Vapi](https://vapi.ai), lets Claude Code, Cursor, Windsurf, and any MCP-compatible AI client manage your voice assistants, fire outbound calls, and inspect call history directly from your AI coding environment.

No more copy-pasting assistant IDs from the dashboard. Just ask Claude.

[![npm version](https://img.shields.io/npm/v/mcp-vapi)](https://www.npmjs.com/package/mcp-vapi)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What You Can Do

Once connected, your AI client can:

- **List, create, update, delete assistants**: iterate on prompts without touching the dashboard
- **Fire outbound calls**: trigger calls to any number with any assistant
- **Pull call transcripts**: get the full transcript + recording URL of any call
- **Manage phone numbers**: list your Vapi numbers and grab their IDs
- **Work with squads**: create and manage multi-assistant handoff flows

### Available Tools

| Tool | Description |
|---|---|
| `vapi_list_assistants` | List all assistants in your account |
| `vapi_get_assistant` | Get full config of a specific assistant |
| `vapi_create_assistant` | Create a new voice assistant |
| `vapi_update_assistant` | Update an assistant (partial update) |
| `vapi_delete_assistant` | Delete an assistant |
| `vapi_create_call` | Fire an outbound call |
| `vapi_list_calls` | List calls with filters |
| `vapi_get_call` | Get call details, transcript, recording |
| `vapi_end_call` | Force-end an active call |
| `vapi_list_phone_numbers` | List your Vapi phone numbers |
| `vapi_get_phone_number` | Get a specific phone number |
| `vapi_list_squads` | List all squads |
| `vapi_get_squad` | Get squad details |
| `vapi_create_squad` | Create a multi-assistant squad |
| `vapi_update_squad` | Update a squad |
| `vapi_delete_squad` | Delete a squad |

---

## Setup

### 1. Get Your Vapi API Key

1. Go to [dashboard.vapi.ai](https://dashboard.vapi.ai)
2. Click your account avatar → **API Keys**
3. Copy your **Private Key**

> Use the private key, not the public key. The public key is for client-side SDKs.

### 2. Add to Claude Code

```bash
claude mcp add vapi -e VAPI_API_KEY=your_key_here -- npx -y mcp-vapi
```

That's it. Restart Claude Code and the Vapi tools will be available.

### 3. Add to Claude Desktop

Open your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this to the `mcpServers` section:

```json
{
  "mcpServers": {
    "vapi": {
      "command": "npx",
      "args": ["-y", "mcp-vapi"],
      "env": {
        "VAPI_API_KEY": "your_key_here"
      }
    }
  }
}
```

Restart Claude Desktop.

### 4. Add to Cursor / Windsurf

In your MCP settings file, add:

```json
{
  "mcpServers": {
    "vapi": {
      "command": "npx",
      "args": ["-y", "mcp-vapi"],
      "env": {
        "VAPI_API_KEY": "your_key_here"
      }
    }
  }
}
```

---

## Usage Examples

Once connected, just talk to your AI:

**"List all my Vapi assistants"**
> Claude calls `vapi_list_assistants` and returns the names + IDs

**"Create a new assistant called 'HVAC Receptionist' with this system prompt: [paste prompt]"**
> Claude calls `vapi_create_assistant` with the right params

**"Fire a test call to +14155550100 using assistant ID abc123 from phone number xyz789"**
> Claude calls `vapi_create_call` with your phone number ID, the customer number, and assistant ID

**"Get the transcript from call ID def456"**
> Claude calls `vapi_get_call` and returns the full transcript + recording URL

**"Update the system prompt on assistant abc123 to [new prompt]"**
> Claude calls `vapi_update_assistant` with just the systemPrompt field

---

## Tips

**You still need a Vapi phone number to make outbound calls.** Buy one at dashboard.vapi.ai → Phone Numbers, then list them with `vapi_list_phone_numbers` to grab the ID.

**E.164 format for phone numbers.** Always `+[country code][number]`, no dashes or spaces. `+14155550100` ✅, `415-555-0100` ❌.

**Metadata is your friend.** Pass a metadata object when creating a call, it comes back on every webhook event so you can link calls to CRM records, campaigns, or anything else.

**`assistantOverrides` is super useful.** You don't need a separate assistant per lead. Create one assistant and pass per-call overrides like `firstMessage`, `variableValues`, or `serverUrl` when you create the call.

**Pagination is timestamp-based.** Vapi doesn't use page numbers, use `createdAtGt`/`createdAtLt` to paginate through large result sets.

---

## Local Development

```bash
git clone https://github.com/adhirajhangal/mcp-vapi
cd mcp-vapi
npm install
npm run build

# test it
VAPI_API_KEY=your_key node dist/index.js
```

To use your local build in Claude Code:

```bash
claude mcp add vapi-local -e VAPI_API_KEY=your_key -- node /path/to/mcp-vapi/dist/index.js
```

---

## Resources

- [Vapi API Docs](https://docs.vapi.ai/api-reference)
- [Vapi Dashboard](https://dashboard.vapi.ai)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Claude Code MCP Docs](https://docs.anthropic.com/en/docs/claude-code/mcp)

---

## License

MIT
