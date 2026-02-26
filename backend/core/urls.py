"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
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
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from accounts.views import UserProfileView
from store.views import EsewaVerifyView, EsewaInitiateView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/profile/', UserProfileView.as_view(), name='profile'),
    path('api/veterinary/', include('veterinary.urls')),
    path('api/lost-found/', include('lost_found.urls')),
    path('api/dashboard/', include('dashboard.urls')),
    path('api/store/', include('store.urls')),
    path('api/payments/esewa/initiate/', EsewaInitiateView.as_view(), name='esewa-initiate'),
    path('api/payments/esewa/verify/', EsewaVerifyView.as_view(), name='esewa-verify'),
    path('api/', include('pets.urls')),
]

# Serve media files during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
