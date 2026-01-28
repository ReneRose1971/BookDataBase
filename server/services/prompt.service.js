import fs from "fs/promises";
import path from "path";

const PROMPTS_DIR = path.resolve(process.cwd(), "prompts");
const PROMPT_FILES = {
    book_summary: {
        system: "book_summary.system.md",
        user: "book_summary.user.md"
    }
};

const promptCache = new Map();

function getPromptDefinition(promptName) {
    const definition = PROMPT_FILES[promptName];
    if (!definition) {
        const error = new Error("Unbekannter Prompt-Name.");
        error.status = 400;
        throw error;
    }
    return definition;
}

export async function getPrompt(promptName) {
    const cached = promptCache.get(promptName);
    if (cached) {
        return cached;
    }

    const definition = getPromptDefinition(promptName);
    const [systemPrompt, userPrompt] = await Promise.all([
        fs.readFile(path.join(PROMPTS_DIR, definition.system), "utf-8"),
        fs.readFile(path.join(PROMPTS_DIR, definition.user), "utf-8")
    ]);

    const payload = {
        systemPrompt,
        userPrompt
    };

    promptCache.set(promptName, payload);
    return payload;
}

export async function savePrompt(promptName, { systemPrompt, userPrompt }) {
    const definition = getPromptDefinition(promptName);
    await fs.mkdir(PROMPTS_DIR, { recursive: true });

    await Promise.all([
        fs.writeFile(path.join(PROMPTS_DIR, definition.system), systemPrompt),
        fs.writeFile(path.join(PROMPTS_DIR, definition.user), userPrompt)
    ]);

    const payload = {
        systemPrompt,
        userPrompt
    };
    promptCache.set(promptName, payload);
    return payload;
}
