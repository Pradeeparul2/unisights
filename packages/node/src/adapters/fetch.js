const OK_RESPONSE = JSON.stringify({ ok: true });
const JSON_HEADERS = { "Content-Type": "application/json" };
export function fetchAdapter(config) {
    const { path, handler } = config;
    return async function unisightsFetch(request) {
        const url = new URL(request.url);
        if (url.pathname !== path)
            return null;
        if (request.method === "POST") {
            try {
                const payload = (await request.json().catch(() => ({})));
                if (handler) {
                    await handler(payload, request);
                }
            }
            catch {
            }
        }
        return new Response(OK_RESPONSE, {
            status: 200,
            headers: JSON_HEADERS,
        });
    };
}
