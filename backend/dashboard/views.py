"""
Single-request dashboard API. One GET per role returns all data needed for the dashboard.
"""
from concurrent.futures import ThreadPoolExecutor
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Q, Count
from django.utils import timezone
from datetime import timedelta

from accounts.permissions import IsAdopterUser, IsVeterinarianUser, IsShelterUser, IsAdminUser
from pets.models import AdoptionRequest, SavedPet, Pet, Message, RewardPoint
from pets.serializers import (
    AdoptionRequestSerializer,
    PetSerializer,
    SavedPetSerializer,
)
from veterinary.models import MedicalRecord, HealthReminder
from veterinary.serializers import MedicalRecordSerializer, MedicalRecordListSerializer, HealthReminderSerializer

# Limits for fast dashboard responses
VET_HEALTH_RECORDS_LIMIT = 50
VET_REMINDERS_LIMIT = 30
ADOPTER_REQUESTS_LIMIT = 100
ADOPTER_HEALTH_RECORDS_LIMIT = 100


def _adopter_task_requests(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    return list(
        AdoptionRequest.objects.filter(adopter=user)
        .select_related('pet', 'adopter', 'shelter').prefetch_related('pet__images')
        .order_by('-request_date')[:ADOPTER_REQUESTS_LIMIT]
    )

def _adopter_task_adopted(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    return list(
        AdoptionRequest.objects.filter(adopter=user, status__in=('approved', 'adopted'))
        .select_related('pet').prefetch_related('pet__images')
    )

def _adopter_task_messages(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    return Message.objects.filter(recipient=user, is_read=False).count()

def _adopter_task_rewards(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    return RewardPoint.objects.filter(user=user).aggregate(total=Sum('points'))['total'] or 0

def _adopter_task_saved(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    return list(
        SavedPet.objects.filter(user=user).select_related('pet').prefetch_related('pet__images')
    )

def _adopter_task_lost(user_id):
    from django.contrib.auth import get_user_model
    from lost_found.models import LostPetReport
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    return list(
        LostPetReport.objects.filter(owner=user).select_related('pet').prefetch_related('images', 'pet__images').order_by('-created_at')
    )

def _adopter_task_history(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    return list(
        AdoptionRequest.objects.filter(adopter=user, status__in=('approved', 'adopted'))
        .select_related('pet', 'adopter', 'shelter').prefetch_related('pet__images')
        .order_by('-reviewed_date', '-request_date')[:ADOPTER_REQUESTS_LIMIT]
    )


class AdopterDashboardView(APIView):
    """Single endpoint returning all adopter dashboard data."""
    permission_classes = [IsAuthenticated, IsAdopterUser]

    def get(self, request):
        user = request.user
        user_id = user.pk
        ctx = {'request': request}
        adoption_requests_list = adopted_requests_list = saved_list = adoption_history_list = None
        messages_unread = rewards_points = 0
        lost_list = []

        with ThreadPoolExecutor(max_workers=7) as executor:
            fut_requests = executor.submit(_adopter_task_requests, user_id)
            fut_adopted = executor.submit(_adopter_task_adopted, user_id)
            fut_messages = executor.submit(_adopter_task_messages, user_id)
            fut_rewards = executor.submit(_adopter_task_rewards, user_id)
            fut_saved = executor.submit(_adopter_task_saved, user_id)
            fut_lost = executor.submit(_adopter_task_lost, user_id)
            fut_history = executor.submit(_adopter_task_history, user_id)
            adoption_requests_list = fut_requests.result()
            adopted_requests_list = fut_adopted.result()
            messages_unread = fut_messages.result()
            rewards_points = fut_rewards.result()
            saved_list = fut_saved.result()
            try:
                lost_list = fut_lost.result()
            except Exception:
                pass
            adoption_history_list = fut_history.result()

        adopted_pet_ids = [req.pet_id for req in adopted_requests_list]

        adoption_requests = AdoptionRequestSerializer(
            adoption_requests_list, many=True, context=ctx
        ).data
        adopted_pets = [
            PetSerializer(req.pet, context=ctx).data for req in adopted_requests_list
        ]
        saved_pets = SavedPetSerializer(saved_list, many=True, context=ctx).data
        try:
            from lost_found.serializers import LostPetReportSerializer
            lost_reports = LostPetReportSerializer(lost_list, many=True, context=ctx).data
        except Exception:
            lost_reports = []
        adoption_history = AdoptionRequestSerializer(
            adoption_history_list, many=True, context=ctx
        ).data

        today = timezone.now().date()
        thirty_days_later = today + timedelta(days=30)
        upcoming_qs = HealthReminder.objects.filter(
            pet_id__in=adopted_pet_ids,
            due_date__gte=today,
            due_date__lte=thirty_days_later,
            status__in=['pending', 'sent']
        ).select_related('pet', 'medical_record').order_by('due_date')
        overdue_qs = HealthReminder.objects.filter(
            pet_id__in=adopted_pet_ids,
            due_date__lt=today,
            status__in=['pending', 'sent']
        ).select_related('pet', 'medical_record').order_by('due_date')
        health_records_qs = []
        if adopted_pet_ids:
            health_records_qs = list(
                MedicalRecord.objects.filter(pet_id__in=adopted_pet_ids)
                .select_related('pet', 'veterinarian').order_by('-date')[:ADOPTER_HEALTH_RECORDS_LIMIT]
            )
        upcoming_reminders = HealthReminderSerializer(upcoming_qs, many=True).data
        overdue_reminders = HealthReminderSerializer(overdue_qs, many=True).data
        health_records = MedicalRecordListSerializer(health_records_qs, many=True, context=ctx).data

        return Response({
            'adoption_requests': adoption_requests,
            'adopted_pets': adopted_pets,
            'messages_unread_count': messages_unread,
            'rewards_points': rewards_points,
            'saved_pets': saved_pets,
            'lost_reports': lost_reports,
            'store_orders': [],
            'adoption_history': adoption_history,
            'upcoming_reminders': upcoming_reminders,
            'overdue_reminders': overdue_reminders,
            'health_records': health_records,
        })


def _vet_task_assigned_pets(user_id, request):
    from django.contrib.auth import get_user_model
    from pets.serializers import PetSerializer
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    ctx = {'request': request}
    assigned_qs = Pet.objects.filter(
        medical_records__veterinarian=user
    ).select_related('shelter').prefetch_related('images').distinct()
    assigned_list = list(assigned_qs)
    pet_ids = [p.id for p in assigned_list]
    adoptions_by_pet = {}
    if pet_ids:
        for ar in AdoptionRequest.objects.filter(
            pet_id__in=pet_ids, status__in=('approved', 'adopted')
        ).select_related('adopter'):
            adoptions_by_pet[ar.pet_id] = ar
    assigned_data = PetSerializer(assigned_list, many=True, context=ctx).data
    for i, pet_data in enumerate(assigned_data):
        pet_id = pet_data.get('id')
        adoption = adoptions_by_pet.get(pet_id) if pet_id else None
        if adoption and adoption.adopter:
            assigned_data[i]['adopter_id'] = adoption.adopter.id
            assigned_data[i]['adopter_name'] = (adoption.adopter.get_full_name() or '').strip() or adoption.adopter.username
    return assigned_data


def _vet_task_health_records(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    records_qs = MedicalRecord.objects.filter(
        veterinarian=user
    ).select_related('pet', 'veterinarian').order_by('-date')[:VET_HEALTH_RECORDS_LIMIT]
    return list(records_qs)


def _vet_task_upcoming_reminders(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    today = timezone.now().date()
    thirty_days_later = today + timedelta(days=30)
    return list(HealthReminder.objects.filter(
        medical_record__veterinarian=user,
        due_date__gte=today,
        due_date__lte=thirty_days_later,
        status__in=['pending', 'sent']
    ).select_related('pet', 'medical_record').order_by('due_date')[:VET_REMINDERS_LIMIT])


def _vet_task_overdue_reminders(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    today = timezone.now().date()
    return list(HealthReminder.objects.filter(
        medical_record__veterinarian=user,
        due_date__lt=today,
        status__in=['pending', 'sent']
    ).select_related('pet', 'medical_record').order_by('due_date')[:VET_REMINDERS_LIMIT])


def _vet_task_messages_count(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    return Message.objects.filter(recipient=user, is_read=False).count()


def _vet_task_health_records_total(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    return MedicalRecord.objects.filter(veterinarian=user).count()


class VeterinarianDashboardView(APIView):
    """Single endpoint returning all veterinarian dashboard data. Queries run in parallel."""
    permission_classes = [IsAuthenticated, IsVeterinarianUser]

    def get(self, request):
        user_id = request.user.pk
        ctx = {'request': request}

        with ThreadPoolExecutor(max_workers=6) as executor:
            fut_assigned = executor.submit(_vet_task_assigned_pets, user_id, request)
            fut_records = executor.submit(_vet_task_health_records, user_id)
            fut_upcoming = executor.submit(_vet_task_upcoming_reminders, user_id)
            fut_overdue = executor.submit(_vet_task_overdue_reminders, user_id)
            fut_messages = executor.submit(_vet_task_messages_count, user_id)
            fut_total = executor.submit(_vet_task_health_records_total, user_id)

            assigned_data = fut_assigned.result()
            records_list = fut_records.result()
            upcoming_list = fut_upcoming.result()
            overdue_list = fut_overdue.result()
            messages_unread = fut_messages.result()
            health_records_total = fut_total.result()

        health_records = MedicalRecordListSerializer(records_list, many=True, context=ctx).data
        upcoming_reminders = HealthReminderSerializer(upcoming_list, many=True).data
        overdue_reminders = HealthReminderSerializer(overdue_list, many=True).data

        return Response({
            'assigned_pets': {'results': assigned_data, 'count': len(assigned_data)},
            'health_records': {'results': health_records, 'count': health_records_total},
            'upcoming_reminders': upcoming_reminders,
            'overdue_reminders': overdue_reminders,
            'messages_unread_count': messages_unread,
        })


# Limit list sizes so shelter dashboard responds instantly
SHELTER_PETS_LIMIT = 100
SHELTER_ADOPTION_HISTORY_LIMIT = 30
SHELTER_LOST_REPORTS_LIMIT = 20


def _shelter_task_stats(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    return Pet.objects.filter(shelter=user).aggregate(
        total=Count('id'),
        available=Count('id', filter=Q(status='available')),
        pending=Count('id', filter=Q(status='pending')),
        adopted=Count('id', filter=Q(status='adopted')),
    )


def _shelter_task_pets(user_id, status_filter):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    qs = Pet.objects.filter(shelter=user).select_related('shelter').prefetch_related('images').order_by('-created_at')
    if status_filter and status_filter != 'all':
        qs = qs.filter(status=status_filter)
    return list(qs[:SHELTER_PETS_LIMIT])


def _shelter_task_pending_count(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    return AdoptionRequest.objects.filter(shelter=user, status='pending').count()


def _shelter_task_messages(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    return Message.objects.filter(recipient=user, is_read=False).count()


def _shelter_task_lost(user_id):
    from django.contrib.auth import get_user_model
    from lost_found.models import LostPetReport
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    count = LostPetReport.objects.filter(status='active').count()
    qs = LostPetReport.objects.filter(status='active').select_related('owner', 'pet').prefetch_related('images').order_by('-created_at')[:SHELTER_LOST_REPORTS_LIMIT]
    return (count, list(qs))


def _shelter_task_adoption_requests(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    return list(
        AdoptionRequest.objects.filter(shelter=user, status__in=('pending', 'updated'))
        .select_related('pet', 'adopter', 'shelter').prefetch_related('pet__images').order_by('-request_date')
    )


def _shelter_task_adoption_history(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.get(pk=user_id)
    return list(
        AdoptionRequest.objects.filter(shelter=user, status__in=('approved', 'adopted'))
        .select_related('pet', 'adopter', 'shelter').prefetch_related('pet__images')
        .order_by('-reviewed_date', '-request_date')[:SHELTER_ADOPTION_HISTORY_LIMIT]
    )


class ShelterDashboardView(APIView):
    """Single endpoint returning all shelter dashboard data. Queries run in parallel for instant load."""
    permission_classes = [IsAuthenticated, IsShelterUser]

    def get(self, request):
        user = request.user
        user_id = user.pk
        status_filter = request.query_params.get('status', 'all')
        ctx = {'request': request}

        with ThreadPoolExecutor(max_workers=7) as executor:
            fut_stats = executor.submit(_shelter_task_stats, user_id)
            fut_pets = executor.submit(_shelter_task_pets, user_id, status_filter)
            fut_pending = executor.submit(_shelter_task_pending_count, user_id)
            fut_messages = executor.submit(_shelter_task_messages, user_id)
            fut_lost = executor.submit(_shelter_task_lost, user_id)
            fut_requests = executor.submit(_shelter_task_adoption_requests, user_id)
            fut_history = executor.submit(_shelter_task_adoption_history, user_id)

            stats_agg = fut_stats.result()
            pets_list = fut_pets.result()
            pending_requests = fut_pending.result()
            messages_unread = fut_messages.result()
            try:
                lost_found_active, lost_list = fut_lost.result()
            except Exception:
                lost_found_active = 0
                lost_list = []
            adoption_requests_list = fut_requests.result()
            adoption_history_list = fut_history.result()

        from pets.serializers import PetSerializer
        total_pets = stats_agg.get('total') or 0
        available_pets = stats_agg.get('available') or 0
        pending_pets = stats_agg.get('pending') or 0
        adopted_pets_count = stats_agg.get('adopted') or 0

        pets_data = PetSerializer(pets_list, many=True, context=ctx).data
        adoption_requests = AdoptionRequestSerializer(adoption_requests_list, many=True, context=ctx).data
        adoption_history = AdoptionRequestSerializer(adoption_history_list, many=True, context=ctx).data
        try:
            from lost_found.serializers import LostPetReportSerializer
            lost_found_reports = LostPetReportSerializer(lost_list, many=True, context=ctx).data
        except Exception:
            lost_found_reports = []

        return Response({
            'stats': {
                'totalPets': total_pets,
                'availablePets': available_pets,
                'pendingPets': pending_pets,
                'adoptedPets': adopted_pets_count,
                'pendingAdoptionRequests': pending_requests,
                'messages': messages_unread,
                'lostFoundAlerts': lost_found_active,
            },
            'pets': {'results': pets_data},
            'adoption_requests': {'results': adoption_requests},
            'adoption_history': adoption_history,
            'lost_found_reports': {'results': lost_found_reports},
        })


class AdminDashboardView(APIView):
    """Single endpoint returning all admin dashboard data including pending verifications."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        from django.contrib.auth import get_user_model
        from accounts.serializers import VerificationListSerializer
        User = get_user_model()
        total_users = User.objects.count()
        pending_shelters = User.objects.filter(role='shelter', is_active=False).count()
        total_reports = AdoptionRequest.objects.count()
        platform_stats = {
            'pets': Pet.objects.count(),
            'adoption_requests': total_reports,
        }
        try:
            from lost_found.models import LostPetReport, FoundPetReport
            platform_stats['lost_reports'] = LostPetReport.objects.count()
            platform_stats['found_reports'] = FoundPetReport.objects.count()
        except Exception:
            platform_stats['lost_reports'] = 0
            platform_stats['found_reports'] = 0
        # Pending verification requests (only users with actual documents to review)
        has_vet_docs = Q(
            role='veterinarian',
            license_document__isnull=False,
            certification_document__isnull=False,
        ) & ~Q(license_document='') & ~Q(certification_document='')
        has_shelter_docs = Q(
            role='shelter',
            registration_certificate__isnull=False,
            organization_document__isnull=False,
        ) & ~Q(registration_certificate='') & ~Q(organization_document='')
        pending_verifications_qs = User.objects.filter(
            role__in=('veterinarian', 'shelter'),
            verification_status='pending',
        ).filter(has_vet_docs | has_shelter_docs).order_by('-verification_submitted_at')
        pending_verifications = VerificationListSerializer(pending_verifications_qs, many=True).data
        return Response({
            'totalUsers': total_users,
            'pendingShelters': pending_shelters,
            'totalReports': total_reports,
            'platformStats': platform_stats,
            'pendingVerifications': pending_verifications,
            'pendingVerificationsCount': len(pending_verifications),
        })
