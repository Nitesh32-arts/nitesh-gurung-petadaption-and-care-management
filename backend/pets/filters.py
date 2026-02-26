import django_filters
from django.db import models
from .models import Pet


class PetFilter(django_filters.FilterSet):
    """
    FilterSet for Pet model with search and filter capabilities
    """
    pet_type = django_filters.CharFilter(
        field_name='pet_type', 
        lookup_expr='iexact',
        help_text='Filter by pet type (dog, cat, bird, etc.)'
    )
    breed = django_filters.CharFilter(
        field_name='breed', 
        lookup_expr='icontains',
        help_text='Filter by breed (case-insensitive partial match)'
    )
    min_age = django_filters.NumberFilter(
        field_name='age', 
        lookup_expr='gte',
        help_text='Minimum age in months'
    )
    max_age = django_filters.NumberFilter(
        field_name='age', 
        lookup_expr='lte',
        help_text='Maximum age in months'
    )
    location = django_filters.CharFilter(
        field_name='location', 
        lookup_expr='icontains',
        help_text='Filter by location (case-insensitive partial match)'
    )
    status = django_filters.CharFilter(
        field_name='status', 
        lookup_expr='iexact',
        help_text='Filter by status (available, pending, adopted)'
    )
    search = django_filters.CharFilter(
        method='filter_search',
        help_text='Search in name, description, and breed'
    )
    
    def filter_search(self, queryset, name, value):
        """
        Custom search filter that searches in name, description, and breed
        """
        return queryset.filter(
            models.Q(name__icontains=value) |
            models.Q(description__icontains=value) |
            models.Q(breed__icontains=value)
        )
    
    class Meta:
        model = Pet
        fields = ['pet_type', 'breed', 'age', 'location', 'status', 'shelter']

