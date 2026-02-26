from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied, ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Q

from accounts.permissions import IsAdopterUser
from pets.models import AdoptionRequest
from .models import LostPetReport, FoundPetReport, LostFoundImage, Match, MatchNotification
from .serializers import (
    LostPetReportSerializer,
    LostPetReportCreateSerializer,
    FoundPetReportSerializer,
    FoundPetReportCreateSerializer,
    LostFoundImageSerializer,
    MatchSerializer,
    MatchNotificationSerializer,
)
from .filters import LostPetReportFilter, FoundPetReportFilter
from .matching import (
    find_matches_for_lost_report,
    find_matches_for_found_report,
    create_match,
)


def _create_match_notifications(match):
    """Notify lost owner and finder when a match is created."""
    MatchNotification.objects.create(
        match=match,
        user=match.lost_report.owner,
        notification_type='match_found',
        title='Potential match for your lost pet',
        message=f'A pet matching "{match.lost_report.pet.name}" may have been found. Check the match details.',
    )
    MatchNotification.objects.create(
        match=match,
        user=match.found_report.reporter,
        notification_type='match_found',
        title='Potential match for a found pet',
        message=f'A lost pet report may match a pet you found. Check the match details.',
    )


class LostPetReportViewSet(viewsets.ModelViewSet):
    """
    Lost pet reports. Only adopters can create; must link to adopted pet.
    Prevents duplicate active reports per pet.
    """
    queryset = LostPetReport.objects.select_related('pet', 'owner').prefetch_related('images', 'pet__images').all()
    serializer_class = LostPetReportSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = LostPetReportFilter
    search_fields = ['pet__name', 'pet__breed', 'description']
    ordering_fields = ['created_at', 'last_seen_date']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        if self.action == 'create':
            return [IsAuthenticated(), IsAdopterUser()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return qs.none()
        if getattr(user, 'is_admin_user', False) or getattr(user, 'is_superuser', False):
            status_param = self.request.query_params.get('status')
            if status_param:
                qs = qs.filter(status=status_param)
            return qs
        qs = qs.filter(owner=user)
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def get_serializer_class(self):
        return LostPetReportCreateSerializer if self.action == 'create' else LostPetReportSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pet = serializer.validated_data.get('pet')
        if LostPetReport.objects.filter(pet=pet, status='active').exists():
            raise ValidationError({'pet': 'An active lost report already exists for this pet.'})
        report = serializer.save()
        min_score = 50.0
        try:
            matches_data = find_matches_for_lost_report(report, min_score)
            for m in matches_data[:10]:
                match = create_match(report, m['found_report'], min_score)
                if match:
                    report.status = 'matched'
                    report.save(update_fields=['status'])
                    m['found_report'].status = 'matched'
                    m['found_report'].save(update_fields=['status'])
                    _create_match_notifications(match)
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception('Lost report matching failed: %s', e)
        out_serializer = LostPetReportSerializer(report, context={'request': request})
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        report = self.get_object()
        if report.owner != self.request.user:
            raise PermissionDenied('Only the owner can update this report.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.owner != self.request.user:
            raise PermissionDenied('Only the owner can delete this report.')
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def upload_image(self, request, pk=None):
        report = self.get_object()
        if report.owner != request.user:
            return Response({'detail': 'You can only add images to your own reports.'}, status=status.HTTP_403_FORBIDDEN)
        ser = LostFoundImageSerializer(data=request.data, context={'request': request})
        if ser.is_valid():
            ser.save(lost_report=report)
            return Response({'message': 'Image uploaded', 'data': ser.data}, status=status.HTTP_201_CREATED)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def mark_resolved(self, request, pk=None):
        report = self.get_object()
        if report.owner != request.user:
            return Response({'detail': 'Only the owner can resolve this report.'}, status=status.HTTP_403_FORBIDDEN)
        report.status = 'resolved'
        report.resolved_at = timezone.now()
        report.save()
        return Response({
            'message': 'Report marked as resolved',
            'data': LostPetReportSerializer(report, context={'request': request}).data
        })

    @action(detail=True, methods=['get'], permission_classes=[AllowAny], url_path='share')
    def share(self, request, pk=None):
        """Public shareable view for one lost report (for social sharing)."""
        report = LostPetReport.objects.filter(pk=pk).select_related('pet', 'owner').prefetch_related('images', 'pet__images').first()
        if not report:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = LostPetReportSerializer(report, context={'request': request})
        return Response(serializer.data)


class FoundPetReportViewSet(viewsets.ModelViewSet):
    """
    Found pet reports. Adopters and shelters can create.
    Veterinarians and admins cannot report found pets.
    """
    queryset = FoundPetReport.objects.select_related('reporter').prefetch_related('images').all()
    serializer_class = FoundPetReportSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = FoundPetReportFilter
    search_fields = ['description', 'breed', 'color']
    ordering_fields = ['created_at', 'date_found']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status', 'active')
        user = self.request.user
        if user.is_authenticated:
            qs = qs.filter(Q(status=status_param) | Q(reporter=user)) if status_param else qs.filter(reporter=user)
        elif status_param:
            qs = qs.filter(status=status_param)
        return qs

    def get_serializer_class(self):
        return FoundPetReportCreateSerializer if self.action == 'create' else FoundPetReportSerializer

    def perform_create(self, serializer):
        user = self.request.user
        if not (getattr(user, 'is_adopter', False) or getattr(user, 'is_shelter', False)):
            raise PermissionDenied('Only adopters and shelters can report found pets.')
        serializer.save()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Validate: Prevent owner from reporting their own lost pet as found
        user = request.user
        validated_data = serializer.validated_data
        
        # Check if user owns any active lost reports
        user_lost_reports = LostPetReport.objects.filter(
            owner=user,
            status='active'
        ).select_related('pet')
        
        if user_lost_reports.exists():
            # Create a temporary FoundPetReport instance to test matching
            temp_found_report = FoundPetReport(
                reporter=user,
                pet_type=validated_data.get('pet_type'),
                breed=validated_data.get('breed', ''),
                color=validated_data.get('color', ''),
                size=validated_data.get('size'),
                location_found=validated_data.get('location_found', ''),
                date_found=validated_data.get('date_found'),
            )
            
            # Check if this found report would match any of the user's lost reports
            from .matching import calculate_match_score
            min_score = 50.0
            
            for lost_report in user_lost_reports:
                score, reasons = calculate_match_score(lost_report, temp_found_report)
                if score >= min_score:
                    # User is trying to report their own lost pet as found
                    return Response(
                        {
                            'detail': 'You cannot report your own lost pet as found. Please mark your lost report as resolved instead.',
                            'lost_report_id': lost_report.id,
                            'lost_pet_name': lost_report.pet.name if lost_report.pet else 'Unknown',
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
        
        self.perform_create(serializer)
        report = serializer.instance
        min_score = 50.0
        try:
            matches_data = find_matches_for_found_report(report, min_score)
            for m in matches_data[:10]:
                # Skip matches where the reporter is the lost report owner (shouldn't happen due to validation above, but extra safety)
                if m['lost_report'].owner == report.reporter:
                    continue
                match = create_match(m['lost_report'], report, min_score)
                if match:
                    report.status = 'matched'
                    report.save(update_fields=['status'])
                    m['lost_report'].status = 'matched'
                    m['lost_report'].save(update_fields=['status'])
                    _create_match_notifications(match)
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception('Found report matching failed: %s', e)
        out_serializer = FoundPetReportSerializer(report, context={'request': request})
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        report = self.get_object()
        if report.reporter != self.request.user:
            raise PermissionDenied('Only the reporter can update this report.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.reporter != self.request.user:
            raise PermissionDenied('Only the reporter can delete this report.')
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def upload_image(self, request, pk=None):
        report = self.get_object()
        if report.reporter != request.user:
            return Response({'detail': 'You can only add images to your own reports.'}, status=status.HTTP_403_FORBIDDEN)
        ser = LostFoundImageSerializer(data=request.data, context={'request': request})
        if ser.is_valid():
            ser.save(found_report=report)
            return Response({'message': 'Image uploaded', 'data': ser.data}, status=status.HTTP_201_CREATED)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def mark_resolved(self, request, pk=None):
        report = self.get_object()
        if report.reporter != request.user:
            return Response({'detail': 'Only the reporter can resolve this report.'}, status=status.HTTP_403_FORBIDDEN)
        report.status = 'resolved'
        report.resolved_at = timezone.now()
        report.save()
        return Response({
            'message': 'Report marked as resolved',
            'data': FoundPetReportSerializer(report, context={'request': request}).data
        })

    @action(detail=True, methods=['get'], permission_classes=[AllowAny], url_path='share')
    def share(self, request, pk=None):
        """Public shareable view for one found report (for social sharing)."""
        report = FoundPetReport.objects.filter(pk=pk).select_related('reporter').prefetch_related('images').first()
        if not report:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = FoundPetReportSerializer(report, context={'request': request})
        return Response(serializer.data)


class MatchViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Matches between lost and found reports.
    Users can confirm, reject, or resolve matches they are involved in.
    """
    serializer_class = MatchSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    ordering_fields = ['match_score', 'created_at']
    ordering = ['-match_score', '-created_at']

    def get_queryset(self):
        user = self.request.user
        return Match.objects.filter(
            Q(lost_report__owner=user) | Q(found_report__reporter=user)
        ).select_related('lost_report', 'lost_report__pet', 'found_report')

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        match = self.get_object()
        user = request.user
        if match.lost_report.owner != user and match.found_report.reporter != user:
            return Response({'detail': 'You are not involved in this match.'}, status=status.HTTP_403_FORBIDDEN)
        if match.lost_report.owner == user:
            match.confirmed_by_lost_owner = True
        if match.found_report.reporter == user:
            match.confirmed_by_finder = True
        if match.is_confirmed():
            match.status = 'confirmed'
            MatchNotification.objects.create(
                match=match, user=match.lost_report.owner,
                notification_type='match_confirmed',
                title='Match Confirmed!',
                message=f'Your lost pet "{match.lost_report.pet.name}" has been confirmed as found!'
            )
            MatchNotification.objects.create(
                match=match, user=match.found_report.reporter,
                notification_type='match_confirmed',
                title='Match Confirmed!',
                message=f'The owner has confirmed that you found their pet "{match.lost_report.pet.name}"!'
            )
        match.save()
        return Response({'message': 'Match confirmed', 'data': MatchSerializer(match, context={'request': request}).data})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        match = self.get_object()
        user = request.user
        if match.lost_report.owner != user and match.found_report.reporter != user:
            return Response({'detail': 'You are not involved in this match.'}, status=status.HTTP_403_FORBIDDEN)
        match.status = 'rejected'
        match.save()
        return Response({'message': 'Match rejected', 'data': MatchSerializer(match, context={'request': request}).data})

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        match = self.get_object()
        user = request.user
        if match.lost_report.owner != user and match.found_report.reporter != user:
            return Response({'detail': 'You are not involved in this match.'}, status=status.HTTP_403_FORBIDDEN)
        if not match.is_confirmed():
            return Response({'detail': 'Match must be confirmed by both parties before resolving.'}, status=status.HTTP_400_BAD_REQUEST)
        match.status = 'resolved'
        match.resolved_at = timezone.now()
        match.save()
        match.lost_report.status = 'resolved'
        match.lost_report.resolved_at = timezone.now()
        match.lost_report.save()
        match.found_report.status = 'resolved'
        match.found_report.resolved_at = timezone.now()
        match.found_report.save()
        return Response({
            'message': 'Match resolved successfully',
            'data': MatchSerializer(match, context={'request': request}).data
        })


class MatchNotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """Match notifications for the current user."""
    serializer_class = MatchNotificationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'is_read']
    ordering = ['-created_at']

    def get_queryset(self):
        return MatchNotification.objects.filter(user=self.request.user).select_related(
            'match', 'match__lost_report', 'match__lost_report__pet', 'match__found_report'
        )

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.mark_as_read()
        return Response({'message': 'Notification marked as read', 'data': MatchNotificationSerializer(notification).data})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True, read_at=timezone.now())
        return Response({'message': f'Marked {updated} notifications as read'})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'unread_count': count})
