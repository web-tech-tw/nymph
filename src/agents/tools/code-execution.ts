import { DynamicStructuredTool } from "@langchain/community/tools/dynamic";
import { z } from "zod";
import {
    getQuickJS,
    type QuickJSContext,
} from "quickjs-emscripten";

// Default configuration for the sandbox.
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_OUTPUT_LENGTH = 10000;
const MAX_MEMORY_BYTES = 64 * 1024 * 1024; // 64MB
const MAX_STACK_SIZE = 1024 * 1024; // 1MB

/**
 * Execution result from the sandbox.
 */
interface ExecutionResult {
    success: boolean;
    result?: string;
    error?: string;
    logs: string[];
    executionTimeMs: number;
}

/**
 * Execute JavaScript code in a QuickJS WASM sandbox.
 * @param code - The JavaScript code to execute.
 * @param timeoutMs - Maximum execution time in milliseconds.
 * @returns The execution result.
 */
async function executeInSandbox(
    code: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ExecutionResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    const QuickJS = await getQuickJS();
    const runtime = QuickJS.newRuntime();

    // Set memory and stack limits.
    runtime.setMemoryLimit(MAX_MEMORY_BYTES);
    runtime.setMaxStackSize(MAX_STACK_SIZE);

    // Set up interrupt handler for timeout.
    let shouldInterrupt = false;
    const timeoutId = setTimeout(() => {
        shouldInterrupt = true;
    }, timeoutMs);

    runtime.setInterruptHandler(() => shouldInterrupt);

    const vm = runtime.newContext();

    try {
        // Set up console logging.
        setupConsole(vm, logs);

        // Wrap the user code to capture the result.
        const wrappedCode = `
            (function() {
                try {
                    const __result__ = (function() {
                        ${code}
                    })();
                    return __result__ !== undefined ? JSON.stringify(__result__) : 'undefined';
                } catch (e) {
                    return JSON.stringify({ __error__: e.message || String(e) });
                }
            })();
        `;

        const evalResult = vm.evalCode(wrappedCode);
        const executionTimeMs = Date.now() - startTime;

        if (evalResult.error) {
            const errorValue = vm.dump(evalResult.error);
            evalResult.error.dispose();

            // Check if it was an interrupt (timeout).
            if (shouldInterrupt) {
                return {
                    success: false,
                    error: `Execution timed out after ${timeoutMs}ms`,
                    logs: logs.slice(0, 100),
                    executionTimeMs,
                };
            }

            return {
                success: false,
                error: String(errorValue),
                logs: logs.slice(0, 100),
                executionTimeMs,
            };
        }

        const rawResult = vm.dump(evalResult.value);
        evalResult.value.dispose();

        // Parse the result.
        let result: string | undefined;
        let error: string | undefined;

        if (typeof rawResult === "string") {
            try {
                const parsed = JSON.parse(rawResult) as Record<string, unknown>;
                if (parsed && typeof parsed === "object" && "__error__" in parsed) {
                    error = parsed.__error__ as string;
                } else {
                    result = rawResult;
                }
            } catch {
                result = rawResult;
            }
        } else {
            result = JSON.stringify(rawResult);
        }

        if (!result && !error) {
            result = [
                "<warning>",
                "<tool>There is no result from the execution.</tool>",
                "<notice>Please ensure your code returns a value or uses console.log() to output results.</notice>",
                "</warning>",
            ].join("\n");
        }

        // Truncate output if too long.
        if (result && result.length > MAX_OUTPUT_LENGTH) {
            result = result.substring(0, MAX_OUTPUT_LENGTH) +
                "\n... (output truncated)";
        }

        return {
            success: !error,
            result,
            error,
            logs: logs.slice(0, 100),
            executionTimeMs,
        };
    } finally {
        clearTimeout(timeoutId);
        vm.dispose();
        runtime.dispose();
    }
}

/**
 * Set up console object in the QuickJS context.
 * @param vm - The QuickJS context.
 * @param logs - Array to capture log output.
 */
function setupConsole(vm: QuickJSContext, logs: string[]): void {
    const consoleHandle = vm.newObject();

    const createLogFn = (prefix?: string) => {
        return vm.newFunction("log", (...args) => {
            const parts: string[] = prefix ? [prefix] : [];
            for (const arg of args) {
                const value = vm.dump(arg);
                if (typeof value === "object") {
                    try {
                        parts.push(JSON.stringify(value, null, 2));
                    } catch {
                        parts.push(String(value));
                    }
                } else {
                    parts.push(String(value));
                }
            }
            logs.push(parts.join(" "));
        });
    };

    const logFn = createLogFn();
    const warnFn = createLogFn("[WARN]");
    const errorFn = createLogFn("[ERROR]");
    const infoFn = createLogFn("[INFO]");

    vm.setProp(consoleHandle, "log", logFn);
    vm.setProp(consoleHandle, "warn", warnFn);
    vm.setProp(consoleHandle, "error", errorFn);
    vm.setProp(consoleHandle, "info", infoFn);
    vm.setProp(vm.global, "console", consoleHandle);

    logFn.dispose();
    warnFn.dispose();
    errorFn.dispose();
    infoFn.dispose();
    consoleHandle.dispose();
}

/**
 * Format the execution result for display.
 * @param result - The execution result.
 * @returns Formatted string output.
 */
function formatResult(result: ExecutionResult): string {
    const parts: string[] = [];

    parts.push(`Status: ${result.success ? "Success" : "Error"}`);
    parts.push(`Execution Time: ${result.executionTimeMs}ms`);

    if (result.logs.length > 0) {
        parts.push("\nConsole Output:");
        parts.push(result.logs.join("\n"));
    }

    if (result.success && result.result !== undefined) {
        parts.push("\nResult:");
        parts.push(result.result);
    } else if (result.error) {
        parts.push("\nError:");
        parts.push(result.error);
    }

    return parts.join("\n");
}

/**
 * Create a code execution tool using QuickJS WASM sandbox.
 * @returns The configured code execution tool.
 */
export function createCodeExecution(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "CodeExecution",
        description: [
            "Execute JavaScript code in a secure QuickJS WASM sandbox.",
            "",
            "GUIDELINES:",
            "- Use this tool for ANY mathematical operations, logic verification, or data processing, no matter how simple (even 1+1).",
            "- DO NOT rely on your internal text prediction for numerical results; always verify via this tool to guarantee 100% accuracy.",
            "- For large integers (exceeding 15 digits), you MUST use BigInt (e.g., 100n) and return the result as a string (.toString()) to avoid precision loss.",
            "- This is your primary engine for factual consistency in math and logic.",
            "",
            "The sandbox provides:",
            "- Isolated QuickJS engine (ES2023 supported).",
            "- Math, JSON, Date, and BigInt built-in objects.",
            "- Synchronous execution only (no async/await).",
            "",
            "Return the last expression value to see the result, or use console.log() for output.",
        ].join("\n"),
        schema: z.object({
            code: z.string().describe(
                "The JavaScript code to execute. Return a value or use console.log() to see output.",
            ),
            timeoutMs: z.number().default(DEFAULT_TIMEOUT_MS).describe(
                `Maximum execution time in milliseconds. Default: ${DEFAULT_TIMEOUT_MS}ms, Max: 30000ms.`,
            ),
        }),
        func: async ({ code, timeoutMs }: { code: string; timeoutMs: number }) => {
            if (!code || code.trim().length === 0) {
                return "Error: No code provided to execute.";
            }

            const result = await executeInSandbox(
                code,
                Math.min(timeoutMs ?? DEFAULT_TIMEOUT_MS, 30000),
            );

            return formatResult(result);
        },
    });
}
