"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.urls import path

from . import account_views, admin_views, auth_views, checkout_views, discovery_views, event_views

urlpatterns = [
    path("api/tickets/", account_views.my_tickets, name="my-tickets"),
    path("api/organizer/analytics/", account_views.organizer_analytics, name="organizer-analytics"),
    path("api/admin/logs/", admin_views.system_logs, name="admin-logs"),
    path("api/auth/register/", auth_views.register, name="auth-register"),
    path("api/auth/login/", auth_views.login, name="auth-login"),
    path("api/checkout/", checkout_views.checkout, name="checkout"),
    path("api/events/", event_views.events, name="events"),
    path("api/events/nearby/", discovery_views.nearby_events, name="events-nearby"),
    path("api/events/<str:event_id>/", event_views.event_detail, name="event-detail"),
    path("api/events/<str:event_id>/cover/", event_views.event_cover, name="event-cover"),
]
