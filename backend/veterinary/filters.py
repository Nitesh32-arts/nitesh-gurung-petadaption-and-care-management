import django_filters
from .models import MedicalRecord, HealthReminder


class MedicalRecordFilter(django_filters.FilterSet):
    """
    FilterSet for MedicalRecord model
    """
    pet = django_filters.NumberFilter(
        field_name='pet__id',
        help_text='Filter by pet ID'
    )
    record_type = django_filters.CharFilter(
        field_name='record_type',
        lookup_expr='iexact',
        help_text='Filter by record type'
    )
    veterinarian = django_filters.NumberFilter(
        field_name='veterinarian__id',
        help_text='Filter by veterinarian ID'
    )
    date_from = django_filters.DateFilter(
        field_name='date',
        lookup_expr='gte',
        help_text='Filter records from this date'
    )
    date_to = django_filters.DateFilter(
        field_name='date',
        lookup_expr='lte',
        help_text='Filter records up to this date'
    )
    has_vaccination = django_filters.BooleanFilter(
        field_name='vaccination',
        lookup_expr='isnull',
        exclude=True,
        help_text='Filter records that have vaccinations'
    )
    
    class Meta:
        model = MedicalRecord
        fields = ['pet', 'record_type', 'veterinarian', 'date']


class HealthReminderFilter(django_filters.FilterSet):
    """
    FilterSet for HealthReminder model
    """
    pet = django_filters.NumberFilter(
        field_name='pet__id',
        help_text='Filter by pet ID'
    )
    reminder_type = django_filters.CharFilter(
        field_name='reminder_type',
        lookup_expr='iexact',
        help_text='Filter by reminder type'
    )
    status = django_filters.CharFilter(
        field_name='status',
        lookup_expr='iexact',
        help_text='Filter by status'
    )
    due_date_from = django_filters.DateFilter(
        field_name='due_date',
        lookup_expr='gte',
        help_text='Filter reminders due from this date'
    )
    due_date_to = django_filters.DateFilter(
        field_name='due_date',
        lookup_expr='lte',
        help_text='Filter reminders due up to this date'
    )
    overdue = django_filters.BooleanFilter(
        method='filter_overdue',
        help_text='Filter overdue reminders'
    )
    
    def filter_overdue(self, queryset, name, value):
        """Filter overdue reminders"""
        from django.utils import timezone
        if value:
            return queryset.filter(
                due_date__lt=timezone.now().date(),
                status__in=['pending', 'sent']
            )
        return queryset
    
    class Meta:
        model = HealthReminder
        fields = ['pet', 'reminder_type', 'status', 'due_date']

