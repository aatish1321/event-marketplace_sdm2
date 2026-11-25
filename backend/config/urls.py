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

from . import (
    account_views,
    admin_views,
    auth_views,
    checkout_views,
    discovery_views,
    event_views,
    receipt_views,
)

urlpatterns = [
    path("api/tickets/", account_views.my_tickets, name="my-tickets"),
    path("api/admin/logs/", admin_views.system_logs, name="admin-logs"),
    path("api/auth/register/", auth_views.register, name="auth-register"),
    path("api/auth/login/", auth_views.login, name="auth-login"),
    path("api/user/tickets/", receipt_views.user_tickets, name="user-tickets"),
    path("api/organizer/analytics/", account_views.organizer_analytics, name="organizer-analytics"),
    path("api/legacy/organizer/analytics/", receipt_views.organizer_analytics, name="legacy-organizer-analytics"),
    path("api/account/", account_views.account, name="account"),
    path("api/account/password/", account_views.change_password, name="change-password"),
    path("api/check-in/", account_views.check_in, name="check-in"),
    path("api/admin/users/", admin_views.users, name="admin-users"),
    path("api/admin/users/<str:user_id>/", admin_views.user_access, name="admin-user-access"),
    path("api/admin/events/", admin_views.events, name="admin-events"),
    path("api/admin/events/<str:event_id>/", admin_views.moderate_event, name="admin-moderate-event"),
    path("api/checkout/", checkout_views.checkout, name="checkout"),
    path("api/events/", event_views.events, name="events"),
    path("api/events/nearby/", discovery_views.nearby_events, name="events-nearby"),
    path("api/events/<str:event_id>/", event_views.event_detail, name="event-detail"),
    path("api/events/<str:event_id>/cover/", event_views.event_cover, name="event-cover"),
]
