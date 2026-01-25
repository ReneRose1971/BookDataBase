export async function loadHtml(target, path) {
    if (!target) {
        throw new Error('Target element missing for loadHtml.');
    }
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load HTML: ${path} (Status: ${response.status})`);
    }
    const html = await response.text();
    target.innerHTML = html;
}

export async function loadPart(target, part, ctx, disposables) {
    if (!part || !part.html) {
        throw new Error('Part definition missing html path.');
    }
    await loadHtml(target, part.html);

    if (part.module) {
        const module = await import(part.module);
        if (module && typeof module.mount === 'function') {
            const result = await module.mount({
                ...ctx,
                root: target,
                part
            });
            if (result) {
                if (typeof result === 'function') {
                    if (disposables) disposables.add(result);
                } else if (typeof result.dispose === 'function') {
                    if (disposables) disposables.add(() => result.dispose());
                }
            }
        }
    }
}
