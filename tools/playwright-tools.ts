import { chromium, Browser, Page, Locator } from "npm:rebrowser-playwright-core";

// Global state
let browser: Browser | undefined;
let page: Page | undefined;
const consoleLogs: string[] = [];
const screenshots = new Map<string, string>();



async function ensureBrowser() {
  if (!browser) {
    browser =  await chromium.launch({
        headless: false,
        // args: [
        //   '--disable-blink-features=AutomationControlled',
        //   '--enable-webgl',
        //   '--use-gl=swiftshader',
        //   '--enable-accelerated-2d-canvas'
        // ]
    });
    const context = await browser.newContext({
        // userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        // viewport: { width: 1280, height: 720 },
        // locale: 'en-US',
        // timezoneId: 'America/New_York',
        // deviceScaleFactor: 1,
    });
    page = await context.newPage()

    page.on("console", (msg) => {
      const logEntry = `[${msg.type()}] ${msg.text()}`;
      consoleLogs.push(logEntry);
    });
  }
  return page!;
}

declare global {
  interface Window {
    mcpHelper: {
      logs: string[],
      originalConsole: Partial<typeof console>,
    }
  }
}

async function takeScreenshot(page: Page, name: string) {
  const buf = await page.screenshot();
  const screenshot = buf.toString("base64");
  screenshots.set(name, screenshot);
  return screenshot;
}

export async function handleToolCall(name: string, args: any): Promise<any> {
  const page = await ensureBrowser();
  switch (name) {
    case "playwright_navigate": {
      console.error(`Running navigate to await page.goto(${args.url})`)
      await page.goto(args.url);
      // const screenshot = await takeScreenshot(page, `navigate_${Date.now()}`);
      return {
        content: [
          {
            type: "text",
            text: `Navigated to ${args.url}`,
          },
        ],
        isError: false,
      };
    }

    case "playwright_screenshot": {
      const buf = await page.screenshot({fullPage: args.fullpage})
      const screenshot = buf.toString("base64")

      if (!screenshot) {
        return {
          content: [{
            type: "text",
            text: args.locator ? `Element not found: ${args.locator}` : "Screenshot failed",
          }],
          isError: true,
        };
      }

      screenshots.set(args.name, screenshot as string);

      return {
        content: [
          {
            type: "text",
            text: `${args.fullpage ? "Full Page": undefined }Screenshot '${args.name}' taken at`,
          },
        ],
        isError: false,
      };
    }

    case "playwright_find_selectors_by_text": {
      try {
        const locators = await page.locator("*").filter({hasText: args.text}).all()
        console.log(locators)
        return {
          content: [{
            type: "text",
            text: JSON.stringify(locators)
          }],
          isError: false
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to find interactive elements: ${(error as Error).message}`
          }],
          isError: true
        };
      }
    }
    case "playwright_click": {

      try {
        console.error(args)
        await page.locator(args.locator).click()
        return {
          content: [
            {
              type: "text",
              text: `Clicked ${args.locator}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to click ${args.locator}: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    }
    case "playwright_fill": {
      try {
        await page.locator(args.locator).fill(args.value);
        return {
          content: [
            {
              type: "text",
              text: `Filled ${args.locator} with: ${args.value}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to fill ${args.locator}: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    }

    case "playwright_highlight": {
      try {
        await (args.locator).highlight();
        // const screenshot = await takeScreenshot(page, `hover_${Date.now()}`);
        return {
          content: [
            {
              type: "text",
              text: `Hovered ${args.locator}`,
            },
            // {
            //   type: "image",
            //   // data: screenshot,
            //   mimeType: "image/png",
            // }
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to hover ${args.locator}: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    }

    case "playwright_evaluate": {
      try {
        await page.evaluate(() => {
          window.mcpHelper = {
            logs: [],
            originalConsole: { ...console },
          };

          ['log', 'info', 'warn', 'error'].forEach(method => {
            (console as any)[method] = (...args: any[]) => {
              window.mcpHelper.logs.push(`[${method}] ${args.join(' ')}`);
              (window.mcpHelper.originalConsole as any)[method](...args);
            };
          } );
        } );

        const result = await page.evaluate( args.script );
        const screenshot = await takeScreenshot(page, `evaluate_${Date.now()}`);

        const logs = await page.evaluate(() => {
          Object.assign(console, window.mcpHelper.originalConsole);
          const logs = window.mcpHelper.logs;
          delete ( window as any).mcpHelper;
          return logs;
        });

        return {
          content: [
            {
              type: "text",
              text: `Execution result:\n${JSON.stringify(result, null, 2)}\n\nConsole output:\n${logs.join('\n')}`,
            },
            {
              type: "image",
              data: screenshot,
              mimeType: "image/png",
            }
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Script execution failed: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    }

    default:
      return {
        content: [{
          type: "text",
          text: `Unknown tool: ${name}`,
        }],
        isError: true,
      };
  }
}
