import json
from .collector import Unisights

def unisights_asgi(path="/collect/event", handler=None):
    collector = Unisights(handler)

    async def middleware(scope, receive, send):

        if scope["type"] != "http":
            return

        if scope["method"] == "POST" and scope["path"] == path:
            body = b""

            while True:
                message = await receive()
                body += message.get("body", b"")

                if not message.get("more_body"):
                    break

            payload = json.loads(body.decode())

            await collector.process(payload, scope)

            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": [(b"content-type", b"application/json")]
            })

            await send({
                "type": "http.response.body",
                "body": b'{"status":"ok"}'
            })

        else:
            await send({
                "type": "http.response.start",
                "status": 404,
                "headers": []
            })

            await send({
                "type": "http.response.body",
                "body": b"Not Found"
            })

    return middleware