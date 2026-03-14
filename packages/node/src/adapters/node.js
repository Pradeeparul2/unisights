import { parseBody } from "../parseBody.js";
export function nodeAdapter(config) {
    const { path, handler } = config;
    return async function uniSightsNode(req, res, next) {
        if (getPath(req) !== path) {
            next?.();
            return;
        }
        if (req.method === "OPTIONS") {
            writeJson(res, 200, { ok: true });
            return;
        }
        if (req.method === "POST") {
            try {
                const payload = (await parseBody(req));
                if (handler) {
                    await handler(payload, req);
                }
            }
            catch {
            }
        }
        writeJson(res, 200, { ok: true });
    };
}
function getPath(req) {
    const url = req.path ?? req.url ?? "/";
    return url.split("?")[0];
}
function writeJson(res, status, body) {
    if (typeof res.status === "function" && typeof res.json === "function") {
        const chained = res.status(status);
        chained.json(body);
        return;
    }
    if (!res.headersSent) {
        res.writeHead(status, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify(body));
}
