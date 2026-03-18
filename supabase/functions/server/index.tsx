import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-e39b424e/health", (c) => {
  console.log('Health check endpoint called');
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Claude API endpoint for content generation
app.post("/make-server-e39b424e/generate", async (c) => {
  try {
    const { messages, system } = await c.req.json();

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: "Invalid request: messages array required" }, 400);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.log("Error: ANTHROPIC_API_KEY not configured");
      return c.json({ error: "API key not configured" }, 500);
    }

    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    console.log("Calling Claude API with model: claude-sonnet-4-20250514");
    console.log("Messages:", JSON.stringify(messages, null, 2));
    if (system) {
      console.log("System prompt length:", system.length);
    }
    
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: messages,
      ...(system && { system })
    });

    console.log("Claude API response received successfully");
    return c.json({ response });
  } catch (error) {
    console.log(`Error calling Claude API: ${error}`);
    if (error instanceof Error) {
      console.log(`Error stack: ${error.stack}`);
    }
    return c.json({ 
      error: "Failed to generate content", 
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

Deno.serve(app.fetch);