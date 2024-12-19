import { Hono } from 'npm:hono';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { handleToolCall } from "./tools/playwright-tools.ts";
import { serveStatic } from 'npm:hono/deno'
import { logger } from 'npm:hono/logger'

const app = new Hono();
app.use(logger())
const sessions = new Map<string, Anthropic.Messages.MessageParam[]>();

console.log('Initializing application...');

const client = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
});

console.log('Anthropic client initialized');

const locatorInputSchemaProp =  {
  type: "string",
  description: 'Selector that fulfills page.locator(selector). Prefer text and index selections, evaluate code if you need to to find it with query selection'
}
const tools: Anthropic.Tool[] =
  [
  {
    name: "playwright_navigate",
    description: "Navigate to a URL",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "playwright_screenshot",
    description: "Take a screenshot of the current page or a specific element",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name for the screenshot" },
        locator: locatorInputSchemaProp,
        fullpage: { type: "boolean", description: "Screenshot of a full scrollable page", default: false}
      },
      required: ["name"],
    }
  },
  {
    name: "playwright_click",
    description: "Click an element on the page using a playwright locator",
    input_schema: {
      type: "object",
      properties: {
          locator: locatorInputSchemaProp,
      },
      required: ["locator"],
    },
  },
  {
    name: "playwright_find_selectors_by_text",
    description: "Get a list of interactive selectors on the current page",
    input_schema: {
      type: "object",
      properties: {
          text: { type: "string", description: "text to find, will pass to the playwright .filter({hasText: ''}) method" },
      },
    }
  },
  {
    name: "playwright_fill",
    description: "Fill out an input field",
    input_schema: {
      type: "object",
      properties: {
        locator: locatorInputSchemaProp,
        value: { type: "string", description: "Value to fill" },
      },
      required: ["locator", "value"],
    },
  },
  {
    name: "playwright_highlight",
    description: "Highlight an element on the page",
    input_schema: {
      type: "object",
      properties: {
        locator: locatorInputSchemaProp,
      },
      required: ["locator"],
    },
  },
  {
    name: "playwright_evaluate",
    description: "Execute JavaScript in the browser console",
    input_schema: {
      type: "object",
      properties: {
        script: { type: "string", description: "JavaScript code to execute" },
      },
      required: ["script"],
    },
  },
]

console.log('Tools configured');

app.post('/chat/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  console.log(`Received chat request for session ${sessionId}`);

  const { message } = await c.req.json();
  console.log(`Message received: ${message}`);

  if (!sessions.has(sessionId)) {
    console.log(`Initializing new session: ${sessionId}`);
    sessions.set(sessionId, []);
  }
  const messages = sessions.get(sessionId)!;

  messages.push({
    role: 'user',
    content: message,
  });

  try {
    let currentResponse = await client.messages.create({
      max_tokens: 1024,
      messages: messages,
      model: 'claude-3-5-sonnet-latest',
      tools: tools,
    });
    console.log('Received response from Claude');

    messages.push({ "role": "assistant", "content": currentResponse.content });

    while (currentResponse.stop_reason === "tool_use") {
      console.log('Tool use detected');
      const toolUse = currentResponse.content.find(c => c.type === 'tool_use');
      if (!toolUse) break;

      const toolName = toolUse.name;
      const toolInput = toolUse.input;
      console.log(`Executing tool: ${toolName}`);
      const result = await handleToolCall(toolName, toolInput);
      console.log('Tool execution complete');

      messages.push({
        "role": "user",
        "content": [
          {
            "type": "tool_result",
            "tool_use_id": toolUse.id,
            "content": JSON.stringify(result)
          }
        ],
      });

      console.log('Sending follow-up request to Claude...');
      currentResponse = await client.messages.create({
        max_tokens: 1024,
        messages: messages,
        model: 'claude-3-5-sonnet-latest',
        tools: tools
      });
      console.log('Received follow-up response');

      messages.push({ "role": "assistant", "content": currentResponse.content });
    }

    return c.json({
      messages: messages
    });

  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return c.json({ error: (error as Error).message }, 500);
  }
});

app.delete('/chat/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId');
  console.log(`Clearing session: ${sessionId}`);
  sessions.delete(sessionId);
  return c.json({ message: 'Session cleared' });
});

app.get('/chat/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId');
  console.log(`Getting messages for session: ${sessionId}`);
  const messages = sessions.get(sessionId) || [];
  return c.json({ messages });
});

app.get('/', serveStatic({ root: './static/' }))

console.log('Starting server...');
Deno.serve(app.fetch)
