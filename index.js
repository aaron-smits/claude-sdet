import Anthropic from '@anthropic-ai/sdk';
import readline from 'readline';

const client = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'],
});

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Calculator function
function calculate(expression) {
  try {
    // Remove any unsafe characters and whitespace
    expression = expression.replace(/[^0-9+\-*/().]/g, '').trim();
    console.log(`Calculating expression: ${expression}`);
    const result = eval(expression); // Note: eval is used here for simplicity
    console.log(`Result: ${result}`);
    return result;
  } catch (error) {
    console.error('Calculation error:', error);
    return 'Error: Invalid expression';
  }
}

async function chat() {
  const messages = [];
  let toolInputBuffer = '';
  let isCollectingToolInput = false;

  while (true) {
    const userInput = await new Promise(resolve => {
      console.log();
      rl.question('You: ', resolve);
    });

    if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
      console.log('\nGoodbye!');
      rl.close();
      break;
    }

    messages.push({ role: 'user', content: userInput });

    try {
      console.log('\nClaude: ');

      const response = await client.messages.create({
        max_tokens: 1024,
        messages: messages,
        model: 'claude-3-5-sonnet-latest',
        stream: true,
        tools: tools,
      });

      let fullResponse = '';

      for await (const chunk of response) {
        // console.log('Debug - Chunk received:', JSON.stringify(chunk, null, 2));

        if (chunk.type === 'content_block_start' && chunk.content_block?.type === 'tool_use') {
          isCollectingToolInput = true;
          toolInputBuffer = '';
          continue;
        }

        if (isCollectingToolInput && chunk.type === 'content_block_delta') {
          toolInputBuffer += chunk.delta.partial_json || '';
        }

        if (isCollectingToolInput && chunk.type === 'content_block_stop') {
          isCollectingToolInput = false;
          try {
            const args = JSON.parse(toolInputBuffer);
            const result = calculate(args.expression);
            const calculationOutput = `\nCalculating ${args.expression} = ${result}\n`;
            process.stdout.write(calculationOutput);
            fullResponse += calculationOutput;
          } catch (error) {
            console.error('Tool call error:', error);
          }
          continue;
        }

        if (chunk.type === 'content_block_delta' && !isCollectingToolInput) {
          const text = chunk.delta?.text || '';
          process.stdout.write(text);
          fullResponse += text;
        }
      }

      messages.push({ role: 'assistant', content: fullResponse });

    } catch (error) {
      console.error('\nError:', error);
      console.error('\nError details:', error.message);
    }
  }
}

// Clear screen and show welcome message
console.clear();
console.log('Chat with Claude (type "exit" or "quit" to end the conversation)');
console.log('----------------------------------------');
chat().catch(console.error);


const locatorInputSchemaProp =  {
  type: "string",
  description: 'Selector that fulfills page.locator(selector). Prefer text and index selections, evaluate code if you need to to find it with query selection'
}

const tools =
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
