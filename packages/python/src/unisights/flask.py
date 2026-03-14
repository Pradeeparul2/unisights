from flask import Blueprint, request, jsonify
from .collector import Unisights
import asyncio

def unisights_flask(path="/collect/event", handler=None):

    bp = Blueprint("unisights", __name__)
    collector = Unisights(handler)

    @bp.route(path, methods=["POST"])
    def collect():

        payload = request.get_json()

        asyncio.run(collector.process(payload, request))

        return jsonify({"status": "ok"})

    return bp