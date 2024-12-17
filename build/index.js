import Anthropic from '@anthropic-ai/sdk';
import { handleToolCall } from './tools/playwright-tools.js';
const client = new Anthropic({
    apiKey: process.env['ANTHROPIC_API_KEY'],
});
const locatorInputSchemaProp = {
    type: "string",
    description: 'Selector that fulfills page.locator(selector). Prefer text and index selections, evaluate code if you need to to find it with query selection'
};
const tools = [
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
                fullpage: { type: "boolean", description: "Screenshot of a full scrollable page", default: false }
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
];
let messages = [
    {
        role: 'user',
        content: `What is the weather in SF?`,
    },
];
async function chat() {
    messages.push({
        role: 'user',
        content: `Go to pomofocus.io with playwright`,
    });
    const stream = client.messages.stream({
        max_tokens: 1024,
        messages: messages,
        model: 'claude-3-5-sonnet-latest',
        tools: tools,
    });
    stream.on('connect', () => {
        console.log('Connected to Anthropic API');
    });
    // stream.on('streamEvent', (event, snapshot) => {
    //   console.log('Stream event:', event);
    //   console.log('Message snapshot:', snapshot);
    // });
    stream.on('text', (textDelta, textSnapshot) => {
        console.log('Text delta:', textDelta);
        console.log('Text snapshot:', textSnapshot);
    });
    // stream.on('inputJson', (partialJson, jsonSnapshot) => {
    //   console.log('JSON delta:', partialJson);
    //   console.log('JSON snapshot:', jsonSnapshot);
    // });
    stream.on('message', (message) => {
        console.log('Message completed:', message);
    });
    stream.on('contentBlock', async (content) => {
        console.log('Content block completed:', content);
        if (content.type == 'tool_use') {
            const result = await handleToolCall(content.name, content.input);
            messages.push({ "role": "assistant", "content": result.content });
            messages.push({
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": content.id,
                        "content": result,
                    }
                ],
            });
        }
    });
    stream.on('finalMessage', (message) => {
        console.log('Final message:', message);
    });
    stream.on('error', (error) => {
        console.error('Stream error:', error);
    });
    stream.on('abort', (error) => {
        console.error('Stream aborted:', error);
    });
    stream.on('end', () => {
        console.log('Stream ended');
    });
    await stream.done();
}
chat();
