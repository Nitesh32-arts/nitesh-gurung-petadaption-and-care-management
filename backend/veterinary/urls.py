from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MedicalRecordViewSet, HealthReminderViewSet, NotificationViewSet

router = DefaultRouter()
router.register(r'medical-records', MedicalRecordViewSet, basename='medical-record')
router.register(r'reminders', HealthReminderViewSet, basename='health-reminder')
router.register(r'notifications', NotificationViewSet, basename='notification')

app_name = 'veterinary'

urlpatterns = [
    path('', include(router.urls)),
]

