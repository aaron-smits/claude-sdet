import { chromium } from "rebrowser-playwright-core";
// Global state
let browser;
let page;
const consoleLogs = [];
const screenshots = new Map();
async function getLocatorText(locator) {
    return locator.toString();
}
async function findInteractiveElements(page) {
    const locators = await Promise.all([
        page.getByRole("button").all(),
        page.getByRole("textbox").all(),
        page.getByRole("combobox").all(),
        page.getByRole("link").all(),
        page.getByRole("checkbox").all(),
        page.getByRole("radio").all(),
        page.getByRole("tab").all(),
        page.getByRole("tabpanel").all(),
        page.getByRole("menu").all(),
        page.getByRole("menuitem").all(),
        page.getByRole("listbox").all(),
        page.getByRole("option").all(),
        page.getByRole("dialog").all(),
        page.getByRole("alert").all(),
        page.getByRole("tooltip").all(),
        page.getByRole("slider").all(),
        page.getByRole("spinbutton").all(),
        page.getByRole("searchbox").all(),
        page.getByRole("progressbar").all(),
        page.getByRole("switch").all()
    ]);
    const allLocatorStrings = [];
    for (const locatorArray of locators) {
        for (const locator of locatorArray) {
            allLocatorStrings.push(await getLocatorText(locator));
        }
    }
    console.log(allLocatorStrings);
    return allLocatorStrings;
}
async function ensureBrowser() {
    if (!browser) {
        browser = await chromium.launch({
            headless: false,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--enable-webgl',
                '--use-gl=swiftshader',
                '--enable-accelerated-2d-canvas'
            ]
        });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            viewport: { width: 1280, height: 720 },
            locale: 'en-US',
            timezoneId: 'America/New_York',
            deviceScaleFactor: 1,
        });
        page = await context.newPage();
        page.on("console", (msg) => {
            const logEntry = `[${msg.type()}] ${msg.text()}`;
            consoleLogs.push(logEntry);
        });
    }
    return page;
}
async function takeScreenshot(page, name) {
    const buf = await page.screenshot();
    const screenshot = buf.toString("base64");
    screenshots.set(name, screenshot);
    // server.notification({
    //   method: "notifications/resources/list_changed",
    // });
    return screenshot;
}
export async function handleToolCall(name, args) {
    const page = await ensureBrowser();
    switch (name) {
        case "playwright_navigate": {
            console.error(`Running navigate to await page.goto(${args.url})`);
            await page.goto(args.url);
            const screenshot = await takeScreenshot(page, `navigate_${Date.now()}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Navigated to ${args.url}`,
                    },
                    {
                        type: "image",
                        data: screenshot,
                        mimeType: "image/png",
                    }
                ],
                isError: false,
            };
        }
        case "playwright_screenshot": {
            const buf = await page.screenshot({ fullPage: args.fullpage });
            const screenshot = buf.toString("base64");
            if (!screenshot) {
                return {
                    content: [{
                            type: "text",
                            text: args.locator ? `Element not found: ${args.locator}` : "Screenshot failed",
                        }],
                    isError: true,
                };
            }
            screenshots.set(args.name, screenshot);
            return {
                content: [
                    {
                        type: "text",
                        text: `${args.fullpage ? "Full Page" : undefined}Screenshot '${args.name}' taken at`,
                    },
                    {
                        type: "image",
                        data: screenshot,
                        mimeType: "image/png",
                    }
                ],
                isError: false,
            };
        }
        case "playwright_find_locators": {
            try {
                const matches = await findInteractiveElements(page);
                console.log(matches);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify(matches)
                        }],
                    isError: false
                };
            }
            catch (error) {
                return {
                    content: [{
                            type: "text",
                            text: `Failed to find interactive elements: ${error.message}`
                        }],
                    isError: true
                };
            }
        }
        case "playwright_click": {
            try {
                console.error(args);
                await page.locator(args.locator).click();
                await page.waitForTimeout(2000);
                const screenshot = await takeScreenshot(page, `click_${Date.now()}`);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Clicked ${args.locator}`,
                        },
                        {
                            type: "image",
                            data: screenshot,
                            mimeType: "image/png",
                        }
                    ],
                    isError: false,
                };
            }
            catch (error) {
                return {
                    content: [{
                            type: "text",
                            text: `Failed to click ${args.locator}: ${error.message}`,
                        }],
                    isError: true,
                };
            }
        }
        case "playwright_fill": {
            try {
                await page.locator(args.locator).fill(args.value);
                await page.waitForTimeout(2000);
                const screenshot = await takeScreenshot(page, `click_${Date.now()}`);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Filled ${args.locator} with: ${args.value}`,
                        },
                        {
                            type: "image",
                            data: screenshot,
                            mimeType: "image/png",
                        }
                    ],
                    isError: false,
                };
            }
            catch (error) {
                return {
                    content: [{
                            type: "text",
                            text: `Failed to fill ${args.locator}: ${error.message}`,
                        }],
                    isError: true,
                };
            }
        }
        case "playwright_highlight": {
            try {
                await (args.locator).highlight();
                const screenshot = await takeScreenshot(page, `hover_${Date.now()}`);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Hovered ${args.locator}`,
                        },
                        {
                            type: "image",
                            data: screenshot,
                            mimeType: "image/png",
                        }
                    ],
                    isError: false,
                };
            }
            catch (error) {
                return {
                    content: [{
                            type: "text",
                            text: `Failed to hover ${args.locator}: ${error.message}`,
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
                        console[method] = (...args) => {
                            window.mcpHelper.logs.push(`[${method}] ${args.join(' ')}`);
                            window.mcpHelper.originalConsole[method](...args);
                        };
                    });
                });
                const result = await page.evaluate(args.script);
                const screenshot = await takeScreenshot(page, `evaluate_${Date.now()}`);
                const logs = await page.evaluate(() => {
                    Object.assign(console, window.mcpHelper.originalConsole);
                    const logs = window.mcpHelper.logs;
                    delete window.mcpHelper;
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
            }
            catch (error) {
                return {
                    content: [{
                            type: "text",
                            text: `Script execution failed: ${error.message}`,
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
