# Cima Workers

This directory is the workspace for Cloudflare Workers belonging to Cima. Cloudflare's Workers dashboard has no project-group resource, so Cima Workers use the `cima-` name prefix and live together here.

## `cima-interactions`

An isolated serverless HTTP endpoint for Discord Interactions. It validates Discord's Ed25519 request signature and currently implements the PING handshake and a prototype `/ping` response.

It is deployed at `https://cima-interactions.cima-uabc.workers.dev`. The account-level `cima-uabc.workers.dev` subdomain is registered for Cima's Workers. The endpoint is deliberately not connected to the Discord application yet. Discord delivers interactions through either the Gateway or an HTTP Interactions Endpoint, not both. Do not set the application's Interactions Endpoint URL until the migrated commands and components are ready; doing so early would stop the production bot from receiving its current interaction events.

## Migration boundaries

HTTP Interactions can handle slash commands, buttons, select menus, and modals. The current bot also depends on Gateway events for ordinary message processing, voice-state updates, member joins/updates, and message deletion. Those features cannot be moved unchanged to an HTTP-only Worker. They must be redesigned around explicit interactions, dropped, or handled by a separate persistent Gateway process.

Current Gateway-dependent features identified in the repository:

| Existing behavior | Source | HTTP-only migration impact |
| --- | --- | --- |
| Message XP and chat activity points | `src/events/leveling.js`, `src/events/staffActivity.js` | Discord does not send ordinary server message events to an Interactions endpoint. These counters stop unless redesigned or a Gateway process remains. |
| Prefix commands and message automations/reactions | `src/events/messageCreate.js`, `src/events/welcomeReactions.js` | Prefix commands need slash replacements; greetings and automatic reactions need Gateway message events. |
| Dynamic voice rooms | `src/events/voiceStateUpdate.js` | No voice-state event arrives over HTTP Interactions. Keep a Gateway process or remove this automation. |
| Join/leave, welcome, and game-role cleanup | `src/events/guildMemberAdd.js`, `src/events/gameRoleVerification.js`, `src/events/memberCount.js`, `src/events/verification.js` | Some actions can move to the explicit verification interaction; automatic join/leave handling needs Gateway or a different, less immediate design. |
| Deleted-message bookkeeping | `src/events/messageDelete.js` | Requires message-delete Gateway events. |
| Slash commands, buttons, selects, and modals | `src/events/interactionCreate.js`, `src/events/tickets.js`, `src/events/verification.js` | Suitable for the HTTP Worker once their handlers and state access are ported. |

The running bot's slash commands are not migrated by the `/ping` prototype. Keep the current bot and Discord endpoint settings unchanged until each command and component is ported and checked.

The existing SQLite database uses `node:sqlite` and a local filesystem path. Workers cannot use that local database file as durable storage; application state must be migrated to a Cloudflare database such as D1 or Durable Object SQLite before cutover.

## Local setup

From this directory, install dependencies, set `DISCORD_PUBLIC_KEY` as a local secret, and use `npm run dev` / `npm run build`. For deployment, set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the process environment; never commit credentials. `GET /health` is available without a Discord key. `/interactions` returns 503 until the public key is configured.
