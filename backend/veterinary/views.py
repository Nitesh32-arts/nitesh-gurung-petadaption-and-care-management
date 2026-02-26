from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied, ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.core.files.uploadedfile import InMemoryUploadedFile, TemporaryUploadedFile
from django.http import QueryDict
from datetime import timedelta
import logging

from .models import MedicalRecord, Vaccination, Treatment, HealthReminder, Notification

logger = logging.getLogger(__name__)


def _make_uploaded_files_picklable(data):
    """
    Replace TemporaryUploadedFile (uses disk, not picklable) with InMemoryUploadedFile.
    Fixes "cannot pickle '_io.BufferedRandom' object" when request.data contains file uploads.
    """
    if not data or not hasattr(data, 'keys'):
        return data
    mutable = data.copy() if hasattr(data, 'copy') else data
    for key in list(mutable.keys()):
        val = mutable.get(key)
        if isinstance(val, TemporaryUploadedFile):
            try:
                val.open('rb')
                content = val.read()
                val.close()
                mutable[key] = InMemoryUploadedFile(
                    file=content,
                    field_name=val.field_name,
                    name=val.name,
                    content_type=val.content_type,
                    size=len(content),
                    charset=val.charset,
                )
            except Exception:
                pass
    return mutable


from .serializers import (
    MedicalRecordSerializer,
    MedicalRecordCreateSerializer,
    VaccinationSerializer,
    TreatmentSerializer,    
    HealthReminderSerializer,
    HealthReminderCreateSerializer,
    NotificationSerializer
)
from .filters import MedicalRecordFilter, HealthReminderFilter
from accounts.permissions import IsVeterinarianUser, IsVerifiedVeterinarian, IsAdopterUser, IsVeterinarianOrAdopter
from pets.models import AdoptionRequest, Pet
from pets.serializers import PetSerializer


class MedicalRecordViewSet(viewsets.ModelViewSet):
    """
    ViewSet for MedicalRecord CRUD operations
    
    List: Veterinarians (all records) or Adopters (their pets' records)
    Retrieve: Veterinarians (all records) or Adopters (their pets' records)
    Create: Veterinarian only
    Update: Veterinarian only (owner)
    Delete: Veterinarian only (owner)
    """
    queryset = MedicalRecord.objects.select_related('pet', 'veterinarian').prefetch_related(
        'vaccination', 'treatments'
    ).all()
    serializer_class = MedicalRecordSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = MedicalRecordFilter
    search_fields = ['title', 'description']
    ordering_fields = ['date', 'created_at']
    ordering = ['-date', '-created_at']
    
    def get_permissions(self):
        """Assign permissions based on action. Write actions require verified veterinarian."""
        if self.action in ['list', 'retrieve']:
            permission_classes = [IsAuthenticated, IsVeterinarianOrAdopter]
        else:
            permission_classes = [IsAuthenticated, IsVerifiedVeterinarian]
        return [permission() for permission in permission_classes]
    
    def get_serializer_class(self):
        """Use different serializer for create action"""
        if self.action == 'create':
            return MedicalRecordCreateSerializer
        return MedicalRecordSerializer
    
    def get_queryset(self):
        """Filter queryset based on user role. This viewset is not nested under a pet; do not use self.pet."""
        queryset = super().get_queryset()
        user = getattr(self, 'request', None) and getattr(self.request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return queryset.none()
        
        # Veterinarians: only show records they created
        if getattr(user, 'is_veterinarian', False):
            return queryset.filter(veterinarian=user)
        
        # Adopters: only show records for pets they've adopted (use adopted_pet_ids, never self.pet)
        if getattr(user, 'is_adopter', False):
            adopted_pet_ids = list(
                AdoptionRequest.objects.filter(
                    adopter=user,
                    status__in=('approved', 'adopted')
                ).values_list('pet_id', flat=True)
            )
            return queryset.filter(pet_id__in=adopted_pet_ids)
        
        # Shelters: show records for pets they own
        if getattr(user, 'is_shelter', False):
            return queryset.filter(pet__shelter=user)
        
        # Other roles get no records
        return queryset.none()
    
    def create(self, request, *args, **kwargs):
        """Create medical record with validation and safe error handling."""
        try:
            # Role check - only veterinarians can create (avoid 500 on invalid role)
            user_role = getattr(request.user, 'role', None)
            if not user_role or str(user_role).lower() != 'veterinarian':
                return Response(
                    {'detail': 'Only veterinarians can create medical records.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Safe extraction of pet_id (works with QueryDict and dict)
            data = request.data
            pet_id = data.get('pet') if data else None
            if isinstance(pet_id, list):
                pet_id = pet_id[0] if pet_id else None
            if pet_id is None or pet_id == '':
                return Response(
                    {'pet': ['This field is required.']},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate pet exists before serializer runs
            try:
                Pet.objects.get(pk=pet_id)
            except (Pet.DoesNotExist, ValueError, TypeError):
                return Response(
                    {'pet': ['Invalid pet ID or pet does not exist.']},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Proceed with normal DRF create flow (serializer validates title, description, date, etc.)
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            # Return full record; fall back to basic data if read serializer fails
            try:
                output_serializer = MedicalRecordSerializer(
                    serializer.instance, context={'request': request}
                )
                response_data = output_serializer.data
            except Exception as ser_err:
                logger.warning('MedicalRecordSerializer failed, using minimal response: %s', ser_err)
                response_data = {
                    'id': serializer.instance.id,
                    'pet': serializer.instance.pet_id,
                    'record_type': serializer.instance.record_type,
                    'title': serializer.instance.title,
                    'date': str(serializer.instance.date),
                }
            headers = self.get_success_headers(response_data)
            return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)
            
        except ValidationError as e:
            err_detail = e.detail if hasattr(e, 'detail') else {'detail': str(e)}
            logger.warning('Medical record validation failed: %s | request.data keys: %s', err_detail, list(request.data.keys()) if hasattr(request.data, 'keys') else 'n/a')
            return Response(err_detail, status=status.HTTP_400_BAD_REQUEST)
        except PermissionDenied as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.error('Medical record creation failed: %s', str(e))
            err_msg = str(e) if str(e) else 'Please check your input.'
            return Response(
                {'detail': f'Failed to create medical record: {err_msg}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def perform_create(self, serializer):
        """Set the veterinarian to the current user when creating a record"""
        serializer.save(veterinarian=self.request.user)
    
    def perform_update(self, serializer):
        """Ensure only the veterinarian owner can update their record"""
        record = self.get_object()
        if record.veterinarian != self.request.user:
            raise PermissionDenied('You do not have permission to update this record.')
        serializer.save()
    
    def perform_destroy(self, instance):
        """Ensure only the veterinarian owner can delete their record"""
        if instance.veterinarian != self.request.user:
            raise PermissionDenied('You do not have permission to delete this record.')
        instance.delete()
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsVerifiedVeterinarian])
    def add_vaccination(self, request, pk=None):
        """Add vaccination to a medical record"""
        medical_record = self.get_object()
        
        if medical_record.veterinarian != request.user:
            return Response(
                {'detail': 'You can only add vaccinations to your own records.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = VaccinationSerializer(
            data=request.data,
            context={'medical_record': medical_record}
        )
        
        if serializer.is_valid():
            serializer.save(medical_record=medical_record)
            return Response(
                {'message': 'Vaccination added successfully', 'data': serializer.data},
                status=status.HTTP_201_CREATED
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsVerifiedVeterinarian])
    def add_treatment(self, request, pk=None):
        """Add treatment to a medical record"""
        medical_record = self.get_object()
        
        if medical_record.veterinarian != request.user:
            return Response(
                {'detail': 'You can only add treatments to your own records.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = TreatmentSerializer(
            data=request.data,
            context={'medical_record': medical_record}
        )
        
        if serializer.is_valid():
            serializer.save(medical_record=medical_record)
            return Response(
                {'message': 'Treatment added successfully', 'data': serializer.data},
                status=status.HTTP_201_CREATED
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsVerifiedVeterinarian])
    def assigned_pets(self, request):
        """Get all pets assigned to this veterinarian (pets with medical records). Includes adopter_id for adopted pets."""
        pets_qs = (
            Pet.objects.filter(medical_records__veterinarian=request.user)
            .select_related('shelter')
            .prefetch_related('images')
            .distinct()
        )
        serializer = PetSerializer(pets_qs, many=True, context={'request': request})
        results = list(serializer.data)
        for i, pet_data in enumerate(results):
            pet_id = pet_data.get('id')
            if pet_id:
                adoption = AdoptionRequest.objects.filter(
                    pet_id=pet_id, status__in=('approved', 'adopted')
                ).select_related('adopter').first()
                if adoption and adoption.adopter:
                    results[i]['adopter_id'] = adoption.adopter.id
                    results[i]['adopter_name'] = (adoption.adopter.get_full_name() or '').strip() or adoption.adopter.username
        return Response({
            'results': results,
            'count': len(results)
        })
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def vaccinations_by_pet(self, request):
        """Get all vaccinations for a specific pet"""
        pet_id = request.query_params.get('pet_id')
        if not pet_id:
            return Response(
                {'detail': 'pet_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check permissions
        user = request.user
        try:
            pet = Pet.objects.get(pk=pet_id)
        except Pet.DoesNotExist:
            return Response(
                {'detail': 'Pet not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Permission check
        if user.is_adopter:
            # Check if pet is adopted by user
            if not AdoptionRequest.objects.filter(adopter=user, pet=pet, status__in=('approved', 'adopted')).exists():
                return Response(
                    {'detail': 'You can only view vaccinations for your adopted pets'},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif user.is_shelter:
            # Check if pet belongs to shelter
            if pet.shelter != user:
                return Response(
                    {'detail': 'You can only view vaccinations for your shelter pets'},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif not user.is_veterinarian:
            return Response(
                {'detail': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get vaccinations
        vaccinations = Vaccination.objects.filter(
            medical_record__pet=pet
        ).select_related('medical_record', 'medical_record__veterinarian').order_by('-administered_date')
        
        serializer = VaccinationSerializer(vaccinations, many=True)
        return Response(serializer.data)


class HealthReminderViewSet(viewsets.ModelViewSet):
    """
    ViewSet for HealthReminder CRUD operations
    
    List: Veterinarians and Adopters (their pets' reminders)
    Retrieve: Veterinarians and Adopters
    Create: Veterinarian only
    Update: Veterinarian only
    Delete: Veterinarian only
    """
    queryset = HealthReminder.objects.select_related('pet', 'medical_record').all()
    serializer_class = HealthReminderSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = HealthReminderFilter
    search_fields = ['title', 'description']
    ordering_fields = ['due_date', 'reminder_date', 'created_at']
    ordering = ['due_date', 'reminder_date']
    
    def get_permissions(self):
        """Assign permissions based on action. Write actions require verified veterinarian."""
        if self.action in ['list', 'retrieve', 'upcoming', 'overdue']:
            permission_classes = [IsAuthenticated, IsVeterinarianOrAdopter]
        else:
            permission_classes = [IsAuthenticated, IsVerifiedVeterinarian]
        return [permission() for permission in permission_classes]
    
    def get_serializer_class(self):
        """Use different serializer for create action"""
        if self.action == 'create':
            return HealthReminderCreateSerializer
        return HealthReminderSerializer
    
    def get_queryset(self):
        """Filter queryset based on user role"""
        queryset = super().get_queryset()
        user = self.request.user
        
        # Veterinarians: only show reminders for their medical records
        if user.is_veterinarian:
            return queryset.filter(medical_record__veterinarian=user)
        
        # Adopters: only show reminders for their adopted pets
        if user.is_adopter:
            adopted_pet_ids = AdoptionRequest.objects.filter(
                adopter=user,
                status__in=('approved', 'adopted')
            ).values_list('pet_id', flat=True)
            return queryset.filter(pet_id__in=adopted_pet_ids)
        
        # Other roles get no reminders
        return queryset.none()
    
    def perform_create(self, serializer):
        """Create reminder and create notification for adopter"""
        user = self.request.user
        medical_record = serializer.validated_data.get('medical_record')
        
        # Enforce veterinarian ownership of medical record
        if user.is_veterinarian:
            if not medical_record:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({
                    'medical_record': ['medical_record is required for veterinarians.']
                })
            
            # Verify medical record belongs to this vet
            if medical_record.veterinarian != user:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({
                    'medical_record': ['You can only create reminders for your own medical records.']
                })
        
        # Pet should already be set by serializer.validate() method
        # But ensure it exists as a fallback
        if 'pet' not in serializer.validated_data or not serializer.validated_data.get('pet'):
            if medical_record:
                serializer.validated_data['pet'] = medical_record.pet
            else:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({
                    'pet': ['Pet is required. Either provide pet directly or select a medical record with a pet.']
                })
        
        reminder = serializer.save()
        pet = reminder.pet
        
        # Create notification for adopter (if pet is adopted)
        try:
            adoption_request = AdoptionRequest.objects.filter(
                pet=pet,
                status__in=('approved', 'adopted')
            ).select_related('adopter').first()
            
            if adoption_request:
                Notification.objects.create(
                    user=adoption_request.adopter,
                    pet=pet,
                    health_reminder=reminder,
                    notification_type=reminder.reminder_type,
                    title=f"Health Reminder: {reminder.title}",
                    message=f"Your pet {pet.name} has a {reminder.get_reminder_type_display()} due on {reminder.due_date.strftime('%B %d, %Y')}. {reminder.description}"
                )
        except Exception as e:
            # Log but don't fail the reminder creation
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create notification for reminder {reminder.id}: {e}")
        
        return reminder
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsVeterinarianOrAdopter])
    def upcoming(self, request):
        """Get upcoming reminders (due within next 30 days)"""
        today = timezone.now().date()
        thirty_days_later = today + timedelta(days=30)
        
        queryset = self.get_queryset().filter(
            due_date__gte=today,
            due_date__lte=thirty_days_later,
            status__in=['pending', 'sent']
        )
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsVeterinarianOrAdopter])
    def overdue(self, request):
        """Get overdue reminders"""
        today = timezone.now().date()
        
        queryset = self.get_queryset().filter(
            due_date__lt=today,
            status__in=['pending', 'sent']
        )
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsVerifiedVeterinarian])
    def mark_completed(self, request, pk=None):
        """Mark reminder as completed"""
        reminder = self.get_object()
        
        # Enforce veterinarian ownership
        if reminder.medical_record and reminder.medical_record.veterinarian != request.user:
            raise PermissionDenied('You can only update reminders for your own medical records.')
        
        reminder.status = 'completed'
        reminder.save()
        
        serializer = self.get_serializer(reminder)
        return Response({
            'message': 'Reminder marked as completed',
            'data': serializer.data
        })
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsVerifiedVeterinarian])
    def mark_sent(self, request, pk=None):
        """Mark reminder as sent"""
        reminder = self.get_object()
        
        # Enforce veterinarian ownership
        if reminder.medical_record and reminder.medical_record.veterinarian != request.user:
            raise PermissionDenied('You can only update reminders for your own medical records.')
        
        reminder.status = 'sent'
        reminder.sent_at = timezone.now()
        reminder.save()
        
        serializer = self.get_serializer(reminder)
        return Response({
            'message': 'Reminder marked as sent',
            'data': serializer.data
        })
    
    def perform_update(self, serializer):
        """Ensure only the veterinarian owner can update their reminder"""
        reminder = self.get_object()
        user = self.request.user
        
        if user.is_veterinarian:
            if not reminder.medical_record or reminder.medical_record.veterinarian != user:
                raise PermissionDenied('You can only update reminders for your own medical records.')
        
        serializer.save()
    
    def perform_destroy(self, instance):
        """Ensure only the veterinarian owner can delete their reminder"""
        user = self.request.user
        
        if user.is_veterinarian:
            if not instance.medical_record or instance.medical_record.veterinarian != user:
                raise PermissionDenied('You can only delete reminders for your own medical records.')
        
        instance.delete()


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Notification operations (Read-only for adopters)
    
    List: Adopters can view their notifications
    Retrieve: Adopters can view notification details
    Mark as read: Adopters can mark notifications as read
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated, IsAdopterUser]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'is_read']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter notifications for current user"""
        return Notification.objects.filter(user=self.request.user).select_related('pet', 'health_reminder')
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark notification as read"""
        notification = self.get_object()
        notification.mark_as_read()
        
        serializer = self.get_serializer(notification)
        return Response({
            'message': 'Notification marked as read',
            'data': serializer.data
        })
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read"""
        unread_count = self.get_queryset().filter(is_read=False).update(
            is_read=True,
            read_at=timezone.now()
        )
        
        return Response({
            'message': f'Marked {unread_count} notifications as read'
        })
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications"""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'unread_count': count})
