import { Hono } from 'npm:hono';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { handleToolCall } from "./tools/playwright-tools.ts";
import {
  serveStatic,
  upgradeWebSocket }
from 'npm:hono/deno'
import { logger } from 'npm:hono/logger'
import { inspect } from 'node:util';

const app = new Hono();
app.use(logger())
const client = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
});

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
    name: "playwright_find_locators",
    description: "Get a list of interactive locators on the current page",
    input_schema: {
      type: "object",
      properties: {
          details: { type: "string", description: "Any specific details about what locators to return" },
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

const messages: Anthropic.MessageParam[] = []

messages.push(
  {
    role: 'user',
    content: `Hey Claude! What tools do you have access to?`,
  }
)

app.get('/', serveStatic({ root: './static/' }))

console.log('Starting server...');
Deno.serve(app.fetch)
