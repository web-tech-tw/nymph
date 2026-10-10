# Nymph

[正體中文](README.zh-TW.md) | English

> **Your personal AI technical consultant**  
> From Web-Tech-TW  
> Meticulously crafted — a multi-platform intelligent technical consultant powered by open-source AI

Nymph is a community-driven senior technical consultant agent service, operated and maintained by the Taiwan Web Technology Promotion Organization (Web Tech TW), providing developers with professional, in-depth, and contextual system architecture consulting, debugging guidance, and engineering experience retrieval.

![Nymph Avatar](avatar.png)

---

## Core Capabilities

* **Senior technical architecture consulting**: Professional advice and debugging diagnosis across frontend, backend, cloud architecture, networking, and security literacy.
* **Community engineering knowledge retrieval**: Instantly search years of accumulated technical discussions, architecture decision records, and real debugging notes from the community.
* **Long-context multi-turn conversation**: Context understanding and conversational memory, continuously tracking the problem thread across multiple rounds of discussion.
* **Cross-platform, multi-channel support**: Available through Discord and LINE, or integrated directly into your personal development environment via the Model Context Protocol (MCP).

---

## How to Use Nymph

### 1. On Discord

* **Invite the bot**: Click [Invite Nymph to your Discord server](https://discord.com/oauth2/authorize?client_id=921702227016560690).
* **Server channels**: `@Nymph` in any channel of a server Nymph has joined, then ask your question.
* **Direct messages**: Send Nymph a DM for one-on-one technical consulting.

### 2. On LINE

* **One-on-one consulting**: Add the [Nymph official account](https://line.me/R/ti/p/@336jwweq) as a friend and chat directly.
* **Group consulting**: Invite Nymph into a LINE group and ask questions right in the group.

### 3. In your personal dev tools (via remote MCP)

Through the Model Context Protocol (MCP) standard, you can integrate Nymph as a remote technical consultant directly into your editor or AI client (such as Antigravity, Claude Code/Desktop, Codex, Cursor, etc.).

#### Step 1: Request an MCP connection token

1. Open the token management page of the Nymph service website ([https://web-tech.tw/nymph/mcp/tokens](https://web-tech.tw/nymph/mcp/tokens)).
2. Click "Sign in with Sara" and log in through the Taiwan Web Technology Promotion Organization's unified Sara identity system.
3. Enter a token label (e.g. `Cursor IDE` or `My MacBook`) and click "Issue new token".
4. Copy the generated token.

#### Step 2: Mount Nymph in your tool

Taking **Antigravity** as an example, add the Nymph server to your MCP configuration file (such as `mcp_config.json` or `mcp.json`):

```json
{
  "mcpServers": {
    "nymph": {
      "type": "http",
      "url": "https://web-tech.tw/nymph/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_MCP_TOKEN>"
      }
    }
  }
}
```

#### Step 3: Invoke Nymph tools in your editor

Once connected, your AI assistant can directly invoke the following Nymph capabilities in conversation:

* `consult_nymph_wisdom`: Start an in-depth technical consultation, architecture analysis, or debugging diagnosis with Nymph.
* `absorb_nymph_wisdom`: Search and absorb the community's accumulated engineering knowledge base, architecture decisions, and solutions.
* `my_nymph_impression`: Retrieve the profile of this MCP connection token holder.

---

## Example Consultations

* **Architecture and technology selection**
  > "We are planning a large frontend-backend separated project. Please analyze the trade-offs between a micro-frontend architecture and a Monorepo approach in terms of maintenance cost and performance."

* **Troubleshooting and error diagnosis**
  > "Compiling native Node.js modules inside a Docker container fails with a node-gyp error. What are the common causes and troubleshooting steps?"

* **Community knowledge base lookup**
  > "Please search the community knowledge base for past best practices and decision records on OAuth2 and JWT token refresh mechanisms."

* **Networking and security concepts**
  > "Please explain the difference between HTTP/2 multiplexing and HTTP/3's QUIC-based connections in packet-loss scenarios."

---

## Self-hosting Nymph

Nymph is open-sourced under the [MIT License](LICENSE) — you are welcome to deploy your own instance.

### 1. Prerequisites

* [Bun](https://bun.sh/) (>= 1.2)
* MongoDB
* An OpenAI-compatible API key
* As needed: a Discord bot token, LINE official account credentials

### 2. Install and Configure

```sh
bun install
cp .env.sample .env     # Fill in your keys and connection settings
cp mcp.toml.sample mcp.toml
```

Main environment variables:

| Variable | Description |
| :--- | :--- |
| `BASE_URL` / `HTTP_PORT` | HTTP service URL and port (default: `3000`) |
| `MONGODB_URI` | MongoDB connection string |
| `OPENAI_API_KEY` | OpenAI-compatible API key |
| `OPENAI_BASE_URL` | OpenAI-compatible base URL |
| `OPENAI_MODEL` | Model name |
| `DISCORD_BOT_TOKEN` | Discord bot token |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` | LINE official account credentials |
| `SARA_INTE_HOST` / `SARA_RECV_HOST` | Sara unified identity system endpoints |

### 3. Don't Have an LLM API Key?

No budget for an LLM API? No problem!

[NVIDIA Build](https://build.nvidia.com/explore/discover) hosts 100+ models
behind a free, OpenAI-compatible API.
Sign up with an email, no credit card required,
open any model page, and click **Get API Key** to receive a free `nvapi-` key.

The recommended model on NVIDIA NIM is **`openai/gpt-oss-20b`**,
an open-weight model with strong multilingual reasoning and low latency —
it is also the default in `.env.sample`:

```sh
OPENAI_API_KEY="nvapi-..."
OPENAI_BASE_URL="https://integrate.api.nvidia.com/v1"
OPENAI_MODEL="openai/gpt-oss-20b"
```

### 4. Run

```sh
# Development (hot reload)
bun run dev

# Production
bun run start
```

Or run it with Docker:

```sh
docker build -t nymph .
docker run --env-file .env -p 3000:3000 nymph
```

---

## About Us

Nymph is maintained and promoted by the Taiwan Web Technology Promotion Organization, aiming to help community members exchange technical knowledge, pass on engineering experience, and grow together.

* Official website: [Taiwan Web Technology Promotion Organization](https://web-tech.tw)
* Install the bot: [Discord bot](https://discord.com/oauth2/authorize?client_id=921702227016560690) | [LINE official account](https://line.me/R/ti/p/@336jwweq)

---

## License

This project is licensed under the [MIT License](LICENSE).
