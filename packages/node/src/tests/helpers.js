import { EventEmitter } from "node:events";
export function makeMockReq(options = {}) {
    const emitter = new EventEmitter();
    emitter.method = options.method ?? "POST";
    emitter.url = options.url ?? "/events";
    emitter.path = options.path;
    emitter.headers = { "content-type": "application/json", ...options.headers };
    emitter.body = options.body;
    emitter.simulateBody = (json) => {
        const chunk = Buffer.from(JSON.stringify(json));
        process.nextTick(() => {
            emitter.emit("data", chunk);
            emitter.emit("end");
        });
    };
    return emitter;
}
export function makeMockRes() {
    let resolve;
    const done = new Promise((r) => (resolve = r));
    const res = {
        statusCode: 200,
        headers: {},
        body: "",
        headersSent: false,
        done,
        status(code) {
            res.statusCode = code;
            return res;
        },
        json(body) {
            res.body = JSON.stringify(body);
            resolve({
                statusCode: res.statusCode,
                body: res.body,
                headers: res.headers,
            });
        },
        writeHead(code, headers = {}) {
            res.statusCode = code;
            res.headers = { ...res.headers, ...headers };
            res.headersSent = true;
        },
        end(body = "") {
            res.body = body;
            resolve({
                statusCode: res.statusCode,
                body: res.body,
                headers: res.headers,
            });
        },
    };
    return res;
}
export function makeFetchRequest(options = {}) {
    const { method = "POST", url = "http://localhost/events", body, headers = {}, } = options;
    return new Request(url, {
        method,
        headers: { "content-type": "application/json", ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
}
export function makeMockHonoCtx(options = {}) {
    const { url = "http://localhost/events", method = "POST", body = {}, } = options;
    const ctx = {
        req: {
            url,
            method,
            json: async () => body,
        },
        json(responseBody, _status = 200) {
            const res = new Response(JSON.stringify(responseBody), {
                status: _status ?? 200,
                headers: { "Content-Type": "application/json" },
            });
            ctx._response = res;
            return res;
        },
        _response: null,
    };
    return ctx;
}
export function makeMockKoaCtx(options = {}) {
    const req = makeMockReq({
        method: options.method ?? "POST",
        url: options.path ?? "/events",
    });
    return {
        path: options.path ?? "/events",
        method: options.method ?? "POST",
        status: 200,
        body: null,
        req,
        request: { body: options.requestBody },
    };
}
export function makeMockElysiaCtx(body = {}) {
    return { body, set: {} };
}
export function makeMockElysiaApp() {
    const app = {
        routes: [],
        post(path, handler) {
            app.routes.push({ path, handler });
            return app;
        },
        async callPost(body) {
            const route = app.routes[0];
            if (!route)
                throw new Error("No route registered");
            return route.handler(makeMockElysiaCtx(body));
        },
    };
    return app;
}
