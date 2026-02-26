from django.urls import path
from .views import (
    AdopterDashboardView,
    VeterinarianDashboardView,
    ShelterDashboardView,
    AdminDashboardView,
)

app_name = 'dashboard'

urlpatterns = [
    path('adopter/', AdopterDashboardView.as_view(), name='adopter'),
    path('veterinarian/', VeterinarianDashboardView.as_view(), name='veterinarian'),
    path('shelter/', ShelterDashboardView.as_view(), name='shelter'),
    path('admin/', AdminDashboardView.as_view(), name='admin'),
]
