import django_filters
from django.db.models import Q
from .models import LostPetReport, FoundPetReport


class LostPetReportFilter(django_filters.FilterSet):
    pet_type = django_filters.CharFilter(field_name='pet__pet_type', lookup_expr='iexact')
    breed = django_filters.CharFilter(field_name='pet__breed', lookup_expr='icontains')
    location = django_filters.CharFilter(field_name='last_seen_location', lookup_expr='icontains')
    status = django_filters.CharFilter(field_name='status', lookup_expr='iexact')
    search = django_filters.CharFilter(method='filter_search')

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            Q(pet__name__icontains=value) |
            Q(pet__breed__icontains=value) |
            Q(description__icontains=value)
        )

    class Meta:
        model = LostPetReport
        fields = ['pet_type', 'breed', 'status', 'location']


class FoundPetReportFilter(django_filters.FilterSet):
    pet_type = django_filters.CharFilter(field_name='pet_type', lookup_expr='iexact')
    breed = django_filters.CharFilter(field_name='breed', lookup_expr='icontains')
    color = django_filters.CharFilter(field_name='color', lookup_expr='icontains')
    location = django_filters.CharFilter(field_name='location_found', lookup_expr='icontains')
    status = django_filters.CharFilter(field_name='status', lookup_expr='iexact')
    search = django_filters.CharFilter(method='filter_search')

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            Q(description__icontains=value) |
            Q(breed__icontains=value)
        )

    class Meta:
        model = FoundPetReport
        fields = ['pet_type', 'breed', 'color', 'status', 'location']
