from flask import Flask, jsonify, request as flask_request
from unisights import UnisightsOptions
from unisights.flask import unisights_flask
from flask_cors import CORS
import logging

logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)

CORS(app,
     origins=[
         "http://localhost:3000",
         "http://127.0.0.1:3000"
     ],
     supports_credentials=True)

@app.before_request
def log_request():
    print(f"[DEBUG] {flask_request.method} {flask_request.path}")
    print(f"[DEBUG] Content-Type: {flask_request.content_type}")
    print(f"[DEBUG] Raw Data: {flask_request.data}")

# Use app.config to store events for thread-safe access
app.config['EVENTS'] = []


def handle_event(payload, req):
    # payload is UnisightsPayload, convert to dict for JSON serialization
    print(f"[DEBUG] Received event-----: {payload}")
    app.config['EVENTS'].append(payload.model_dump() if hasattr(payload, 'model_dump') else payload)

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/test/events")
def get_events():
    events = app.config['EVENTS']
    return jsonify(events[-1] if events else None)

@app.route("/test/clear")
def clear_events():
    app.config['EVENTS'] = []
    return jsonify({"cleared": True})

options = UnisightsOptions(
    path="/collect-flask/event",
    handler=handle_event,
    debug=True
)

bp = unisights_flask(options)

CORS(bp,
     origins=[
         "http://localhost:3000",
         "http://127.0.0.1:3000"
     ],
     supports_credentials=True)


app.register_blueprint(bp)

if __name__ == "__main__":
    app.run(port=3003, debug=True)
