interface Env {
  DISCORD_PUBLIC_KEY?: string;
}

interface DiscordInteraction {
  type: number;
  data?: {
    name?: string;
  };
}

const encoder = new TextEncoder();
const MAX_SIGNATURE_AGE_SECONDS = 5 * 60;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function fromHex(value: string): Uint8Array | null {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function verifyDiscordRequest(request: Request, body: string, publicKeyHex: string): Promise<boolean> {
  const signatureHex = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  if (!signatureHex || !timestamp || !/^\d+$/.test(timestamp)) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (ageSeconds > MAX_SIGNATURE_AGE_SECONDS) return false;

  const signature = fromHex(signatureHex);
  const publicKeyBytes = fromHex(publicKeyHex);
  if (!signature || signature.length !== 64 || !publicKeyBytes || publicKeyBytes.length !== 32) return false;

  try {
    const publicKey = await crypto.subtle.importKey(
      "raw",
      publicKeyBytes,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      signature,
      encoder.encode(timestamp + body),
    );
  } catch {
    return false;
  }
}

async function handleInteraction(request: Request, env: Env): Promise<Response> {
  if (!env.DISCORD_PUBLIC_KEY) return json({ error: "Discord interaction verification is not configured." }, 503);

  const body = await request.text();
  const valid = await verifyDiscordRequest(request, body, env.DISCORD_PUBLIC_KEY);
  if (!valid) return json({ error: "Invalid Discord request signature." }, 401);

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(body) as DiscordInteraction;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  if (interaction.type === 1) return json({ type: 1 });

  if (interaction.type === 2 && interaction.data?.name === "ping") {
    return json({
      type: 4,
      data: { content: "Pong — Cima responde desde Cloudflare Workers." },
    });
  }

  return json({
    type: 4,
    data: {
      content: "Esta interacción todavía no se ha migrado a Cima Workers.",
      flags: 64,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ worker: "cima-interactions", status: "ready" });
    }

    if (request.method === "POST" && url.pathname === "/interactions") {
      return handleInteraction(request, env);
    }

    return json({ error: "Not found." }, 404);
  },
};
