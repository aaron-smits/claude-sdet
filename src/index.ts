import Anthropic from '@anthropic-ai/sdk';
import { handleToolCall } from './tools/playwright-tools.js';


const client = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'],
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

let messages: Anthropic.Messages.MessageParam[] =  [
       {
         role: 'user',
         content: `What is the weather in SF?`,
       },
]

async function chat() {
  messages.push({
      role: 'user',
      content: `Go to pomofocus.io with playwright`,
  })
  const resp = await client.messages.create({
    max_tokens: 1024,
    messages: messages,
    model: 'claude-3-5-sonnet-latest',
    tools: tools,
  });
  if (resp.stop_reason == "tool_use") {
    console.log(resp)
    const toolUse = resp.content.find(c => c.type === 'tool_use');
    if (toolUse) {
      const toolName = toolUse!.name;
      const toolInput = toolUse!.input;
      const result = await handleToolCall(toolName, toolInput)
      messages.push(
          {"role": "assistant", "content": resp.content},
          {
              "role": "user",
              "content": [
                  {
                      "type": "tool_result",
                      "tool_use_id": toolUse.id,
                      "content": JSON.stringify(result)
                  }
              ],
          },
      )
      const toolresp = await client.messages.create({
        max_tokens: 1024,
        messages: messages,
        model: 'claude-3-5-sonnet-latest',
        tools: tools
      });
      console.log(toolresp)
    }
  }
}
chat()
