from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .views import (
    PetViewSet, AdoptionRequestViewSet, SavedPetViewSet,
    MessageViewSet, RewardPointViewSet, AdoptedPetsView
)

router = DefaultRouter()
router.register(r'pets', PetViewSet, basename='pet')
router.register(r'adoption-requests', AdoptionRequestViewSet, basename='adoption-request')
router.register(r'saved-pets', SavedPetViewSet, basename='saved-pet')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'rewards', RewardPointViewSet, basename='reward')

app_name = 'pets'

# Test endpoint to verify routing
@api_view(['GET'])
def test_endpoint(request):
    """Test endpoint to verify API routing is working"""
    return Response({
        'message': 'Pets API is accessible',
        'method': request.method,
        'path': request.path,
        'available_endpoints': {
            'pets': '/api/pets/',
            'pets_create': 'POST /api/pets/',
            'pets_list': 'GET /api/pets/',
            'my_pets': 'GET /api/pets/my_pets/',
        }
    })

urlpatterns = [
    path('', include(router.urls)),
    path('adopted-pets/', AdoptedPetsView.as_view(), name='adopted-pets'),
    path('test/', test_endpoint, name='test-endpoint'),
]

