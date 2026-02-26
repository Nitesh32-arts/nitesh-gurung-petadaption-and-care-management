from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LostPetReportViewSet,
    FoundPetReportViewSet,
    MatchViewSet,
    MatchNotificationViewSet
)

router = DefaultRouter()
router.register(r'lost', LostPetReportViewSet, basename='lost-pet-report')
router.register(r'found', FoundPetReportViewSet, basename='found-pet-report')
router.register(r'matches', MatchViewSet, basename='match')
router.register(r'notifications', MatchNotificationViewSet, basename='match-notification')

app_name = 'lost_found'

urlpatterns = [
    path('', include(router.urls)),
]

