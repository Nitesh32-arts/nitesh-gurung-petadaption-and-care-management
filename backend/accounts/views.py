from rest_framework import status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.http import FileResponse, Http404
from django.conf import settings
import logging

from .models import VerificationActionLog, VerificationNotification
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserSerializer,
    RoleBasedProfileSerializer,
    VerificationSubmitSerializer,
    VerificationStatusSerializer,
    VerificationListSerializer,
)
from .permissions import IsAdminUser

User = get_user_model()
logger = logging.getLogger(__name__)


def get_tokens_for_user(user):
    """
    Generate JWT tokens for a user
    """
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


class RegisterView(generics.CreateAPIView):
    """
    API endpoint for user registration (signup)
    
    POST /api/auth/register/
    
    Request Body:
    {
        "username": "string",
        "email": "string",
        "password": "string",
        "password_confirm": "string",
        "first_name": "string (optional)",
        "last_name": "string (optional)",
        "role": "admin|shelter|adopter|veterinarian (optional, default: adopter)",
        "phone_number": "string (optional)",
        "address": "string (optional)"
    }
    
    Response:
    {
        "message": "User registered successfully",
        "user": {...},
        "tokens": {
            "refresh": "string",
            "access": "string"
        }
    }
    """
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Generate JWT tokens
        tokens = get_tokens_for_user(user)
        
        return Response({
            'message': 'User registered successfully',
            'user': UserSerializer(user).data,
            'tokens': tokens
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """
    API endpoint for user login
    
    POST /api/auth/login/
    
    Request Body:
    {
        "username": "string (username or email)",
        "password": "string"
    }
    
    Response:
    {
        "message": "Login successful",
        "user": {...},
        "tokens": {
            "refresh": "string",
            "access": "string"
        }
    }
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = UserLoginSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if serializer.is_valid():
            user = serializer.validated_data['user']
            
            # Generate JWT tokens
            tokens = get_tokens_for_user(user)
            
            return Response({
                'message': 'Login successful',
                'user': UserSerializer(user).data,
                'tokens': tokens
            }, status=status.HTTP_200_OK)
        
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    API endpoint to get or update current user profile (role-based).
    GET /api/auth/me/ - Get current user profile (role-specific fields + read-only data)
    PUT /api/auth/me/ - Update current user profile (only allowed fields for role)
    PATCH /api/auth/me/ - Partial update
    Requires: Authentication (Bearer Token). User can only access their own profile.
    """
    serializer_class = RoleBasedProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        """Return the current authenticated user (own profile only)."""
        user = self.request.user
        ensure_verification_state_consistent(user)
        return user

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=partial
        )
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'message': 'Profile updated successfully',
            'user': serializer.data
        }, status=status.HTTP_200_OK)


# ----- Verification workflow -----

def _send_verification_email(user, subject, body):
    """Optional: send email (uses settings.EMAIL_BACKEND; console in dev)."""
    if not getattr(user, 'email', None):
        return
    try:
        from django.core.mail import send_mail
        send_mail(
            subject,
            body,
            getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@petcare.com'),
            [user.email],
            fail_silently=True,
        )
    except Exception as e:
        logger.warning('Verification email failed: %s', e)


def _document_file_exists(file_field):
    """Check if a FileField has a value and the file exists in storage."""
    if not file_field or not getattr(file_field, 'name', None):
        return False
    try:
        return file_field.storage.exists(file_field.name)
    except (ValueError, OSError):
        return False


def _has_document_field(field):
    """True if field has a stored value (path) in DB."""
    if field is None:
        return False
    name = getattr(field, 'name', None) if hasattr(field, 'name') else None
    return bool(name and str(name).strip())


def ensure_verification_state_consistent(user):
    """
    If user is pending, had previously submitted, but documents are missing (deleted from DB
    or storage), reset to rejected so they can resubmit.
    """
    user.refresh_from_db()
    role = getattr(user, 'role', None)
    if role not in ('veterinarian', 'shelter') or user.verification_status != 'pending':
        return
    # Both required document fields must have values and files must exist
    if role == 'veterinarian':
        has_both_fields = _has_document_field(user.license_document) and _has_document_field(user.certification_document)
        has_both_files = _document_file_exists(user.license_document) and _document_file_exists(user.certification_document)
    else:
        has_both_fields = _has_document_field(user.registration_certificate) and _has_document_field(user.organization_document)
        has_both_files = _document_file_exists(user.registration_certificate) and _document_file_exists(user.organization_document)
    has_submitted_log = VerificationActionLog.objects.filter(user=user, action='submitted').exists()
    had_submitted = has_submitted_log or bool(user.verification_submitted_at)
    # Reset when they submitted before but docs are now missing (fields empty or files gone)
    should_reset = had_submitted and (not has_both_fields or not has_both_files)
    if should_reset:
        user.verification_status = 'rejected'
        user.verification_submitted_at = None
        user.rejection_reason = None
        user.verified_at = None
        user.verified_by = None
        update_fields = [
            'verification_status', 'verification_submitted_at', 'rejection_reason',
            'verified_at', 'verified_by',
        ]
        if role == 'veterinarian':
            user.license_document = None
            user.certification_document = None
            update_fields.extend(['license_document', 'certification_document'])
        else:
            user.registration_certificate = None
            user.organization_document = None
            update_fields.extend(['registration_certificate', 'organization_document'])
        user.save(update_fields=update_fields)


class VerificationStatusView(APIView):
    """GET current user's verification status. Used by frontend to show banner/redirect."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        ensure_verification_state_consistent(user)
        serializer = VerificationStatusSerializer(user)
        return Response(serializer.data)


class VerificationNotificationsView(APIView):
    """GET current user's verification notifications (Vet/Shelter). Optional mark as read."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import VerificationNotification
        notifications = VerificationNotification.objects.filter(user=request.user).order_by('-created_at')[:50]
        data = [
            {'id': n.id, 'notification_type': n.notification_type, 'title': n.title, 'message': n.message, 'is_read': n.is_read, 'created_at': n.created_at}
            for n in notifications
        ]
        return Response({'results': data})

    def post(self, request):
        """Mark verification notifications as read (optional body: { "ids": [1,2] } or mark all)."""
        from .models import VerificationNotification
        ids = request.data.get('ids') or []
        if ids:
            VerificationNotification.objects.filter(user=request.user, id__in=ids).update(is_read=True)
        else:
            VerificationNotification.objects.filter(user=request.user).update(is_read=True)
        return Response({'message': 'Marked as read.'})


class VerificationSubmitView(APIView):
    """POST verification documents. Sets status=PENDING, submission time, logs and notifies."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        role = getattr(user, 'role', None)
        if role not in ('veterinarian', 'shelter'):
            return Response(
                {'detail': 'Only Veterinarian or Shelter can submit verification.'},
                status=status.HTTP_403_FORBIDDEN
            )
        if user.verification_status == 'approved':
            return Response(
                {'detail': 'Your account is already verified.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer = VerificationSubmitSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # Save files to user - only set pending when we actually persist documents
        if role == 'veterinarian':
            user.license_document = data['license_document']
            user.certification_document = data['certification_document']
        else:
            user.registration_certificate = data['registration_certificate']
            user.organization_document = data['organization_document']
        user.verification_status = 'pending'
        user.verification_submitted_at = timezone.now()
        user.rejection_reason = None
        user.save()
        VerificationActionLog.objects.create(user=user, action='submitted', performed_by=None, reason=None)
        VerificationNotification.objects.create(
            user=user,
            notification_type='submission_received',
            title='Verification submitted',
            message='Your verification documents have been received and are under review.',
        )
        _send_verification_email(
            user,
            'Verification documents received',
            'Your verification documents have been received. We will review them and notify you once the review is complete.'
        )
        return Response({
            'message': 'Verification documents submitted successfully.',
            'verification_status': user.verification_status,
            'verification_submitted_at': user.verification_submitted_at,
        }, status=status.HTTP_200_OK)


class VerificationPendingListView(APIView):
    """Admin: list users with verification_status=pending (Vet/Shelter only)."""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        qs = User.objects.filter(
            role__in=('veterinarian', 'shelter'),
            verification_status='pending'
        ).order_by('-verification_submitted_at')
        serializer = VerificationListSerializer(qs, many=True)
        return Response({'results': serializer.data, 'count': qs.count()})


class VerificationDetailView(APIView):
    """Admin: get one user's verification detail with document download URLs (relative paths for frontend to call download endpoint)."""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request, user_id):
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            raise Http404
        if user.role not in ('veterinarian', 'shelter'):
            return Response({'detail': 'User is not a veterinarian or shelter.'}, status=status.HTTP_400_BAD_REQUEST)
        doc_fields = []
        if user.role == 'veterinarian':
            if user.license_document:
                doc_fields.append({'field': 'license_document', 'name': 'License document', 'url': f'/api/auth/verification/{user_id}/document/license_document/'})
            if user.certification_document:
                doc_fields.append({'field': 'certification_document', 'name': 'Certification document', 'url': f'/api/auth/verification/{user_id}/document/certification_document/'})
        else:
            if user.registration_certificate:
                doc_fields.append({'field': 'registration_certificate', 'name': 'Registration certificate', 'url': f'/api/auth/verification/{user_id}/document/registration_certificate/'})
            if user.organization_document:
                doc_fields.append({'field': 'organization_document', 'name': 'Organization document', 'url': f'/api/auth/verification/{user_id}/document/organization_document/'})
        list_serializer = VerificationListSerializer(user)
        return Response({
            **list_serializer.data,
            'document_links': doc_fields,
        })


class VerificationDocumentDownloadView(APIView):
    """Admin only: stream verification document file."""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    ALLOWED_FIELDS = ('license_document', 'certification_document', 'registration_certificate', 'organization_document')

    def get(self, request, user_id, field_name):
        if field_name not in self.ALLOWED_FIELDS:
            raise Http404
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            raise Http404
        file_field = getattr(user, field_name, None)
        if not file_field:
            raise Http404
        try:
            return FileResponse(file_field.open('rb'), as_attachment=True, filename=file_field.name or 'document')
        except (ValueError, OSError):
            raise Http404


def _do_approve_verification(user, performed_by):
    """Shared logic: approve a vet/shelter verification. Used by API and Django admin."""
    user.verification_status = 'approved'
    user.verified_at = timezone.now()
    user.verified_by = performed_by
    user.rejection_reason = None
    user.save()
    VerificationActionLog.objects.create(
        user=user, action='approved', performed_by=performed_by, reason=None
    )
    VerificationNotification.objects.create(
        user=user,
        notification_type='approved',
        title='Account verified',
        message='Your account has been verified. You now have full access to all features for your role.',
    )
    _send_verification_email(
        user,
        'Account verified',
        'Your account has been verified. You now have full access to all features for your role.'
    )


def _do_reject_verification(user, performed_by, reason='No reason provided.'):
    """Shared logic: reject a vet/shelter verification. Used by API and Django admin."""
    reason = (reason or '').strip() or 'No reason provided.'
    user.verification_status = 'rejected'
    user.verified_at = None
    user.verified_by = performed_by
    user.rejection_reason = reason
    user.save()
    VerificationActionLog.objects.create(
        user=user, action='rejected', performed_by=performed_by, reason=reason
    )
    VerificationNotification.objects.create(
        user=user,
        notification_type='rejected',
        title='Verification rejected',
        message=f'Verification rejected: {reason}',
    )
    _send_verification_email(
        user,
        'Verification rejected',
        f'Your verification was rejected. Reason: {reason}. You may resubmit documents from your dashboard.'
    )


class VerificationApproveView(APIView):
    """Admin: approve a user's verification."""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request, user_id):
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            raise Http404
        if user.role not in ('veterinarian', 'shelter'):
            return Response({'detail': 'User is not a veterinarian or shelter.'}, status=status.HTTP_400_BAD_REQUEST)
        if user.verification_status == 'approved':
            return Response({'detail': 'User is already approved.'}, status=status.HTTP_400_BAD_REQUEST)
        _do_approve_verification(user, request.user)
        return Response({
            'message': 'Verification approved.',
            'user': VerificationListSerializer(user).data,
        }, status=status.HTTP_200_OK)


class VerificationRejectView(APIView):
    """Admin: reject with reason. User can resubmit."""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request, user_id):
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            raise Http404
        if user.role not in ('veterinarian', 'shelter'):
            return Response({'detail': 'User is not a veterinarian or shelter.'}, status=status.HTTP_400_BAD_REQUEST)
        reason = (request.data.get('rejection_reason') or '').strip() or 'No reason provided.'
        _do_reject_verification(user, request.user, reason)
        return Response({
            'message': 'Verification rejected.',
            'user': VerificationListSerializer(user).data,
        }, status=status.HTTP_200_OK)
