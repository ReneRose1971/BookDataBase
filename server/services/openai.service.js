const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

export async function createChatCompletion({ apiKey, systemPrompt, userPrompt, model = DEFAULT_MODEL }) {
    const response = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.4
        })
    });

    if (!response.ok) {
        let errorMessage = `OpenAI API Fehler (Status ${response.status}).`;
        try {
            const payload = await response.json();
            if (payload?.error?.message) {
                errorMessage = payload.error.message;
            }
        } catch (error) {
            // Ignore JSON parse errors, keep fallback message.
        }
        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content || !content.trim()) {
        const error = new Error("OpenAI hat keine Zusammenfassung geliefert.");
        error.status = 502;
        throw error;
    }

    return content.trim();
}
