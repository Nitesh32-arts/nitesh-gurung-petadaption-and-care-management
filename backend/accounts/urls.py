from django.urls import path
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
)

from .views import (
    RegisterView,
    LoginView,
    UserProfileView,
    VerificationStatusView,
    VerificationSubmitView,
    VerificationNotificationsView,
    VerificationPendingListView,
    VerificationDetailView,
    VerificationDocumentDownloadView,
    VerificationApproveView,
    VerificationRejectView,
)

app_name = 'accounts'

urlpatterns = [
    # Authentication endpoints
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('me/', UserProfileView.as_view(), name='user-profile'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token-verify'),
    # Verification (Vet/Shelter)
    path('verification/status/', VerificationStatusView.as_view(), name='verification-status'),
    path('verification/submit/', VerificationSubmitView.as_view(), name='verification-submit'),
    path('verification/notifications/', VerificationNotificationsView.as_view(), name='verification-notifications'),
    # Admin verification panel
    path('verification/pending/', VerificationPendingListView.as_view(), name='verification-pending'),
    path('verification/<int:user_id>/', VerificationDetailView.as_view(), name='verification-detail'),
    path('verification/<int:user_id>/document/<str:field_name>/', VerificationDocumentDownloadView.as_view(), name='verification-document'),
    path('verification/<int:user_id>/approve/', VerificationApproveView.as_view(), name='verification-approve'),
    path('verification/<int:user_id>/reject/', VerificationRejectView.as_view(), name='verification-reject'),
]
