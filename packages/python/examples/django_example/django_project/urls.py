"""
Django URL configuration for analytics project.
"""
 
from django.urls import path
from analytics.views import health_check, handle_unisights_event
 
urlpatterns = [
    path('health/', health_check, name='health'),
    path('api/events/', handle_unisights_event, name='unisights_events'),
]