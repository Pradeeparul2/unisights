import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .collector import Unisights
import asyncio

def unisights_django(handler=None):

    collector = Unisights(handler)

    @csrf_exempt
    def view(request):

        if request.method != "POST":
            return JsonResponse({"error": "method not allowed"}, status=405)

        payload = json.loads(request.body)

        asyncio.run(collector.process(payload, request))

        return JsonResponse({"status": "ok"})

    return view