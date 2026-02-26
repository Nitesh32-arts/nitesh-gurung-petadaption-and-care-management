from django.contrib import admin
from .models import Pet, PetImage


@admin.register(Pet)
class PetAdmin(admin.ModelAdmin):
    list_display = ['name', 'pet_type', 'breed', 'age', 'status', 'shelter', 'created_at']
    list_filter = ['pet_type', 'status', 'gender', 'created_at']
    search_fields = ['name', 'breed', 'description', 'shelter__username']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'pet_type', 'breed', 'age', 'gender')
        }),
        ('Details', {
            'fields': ('description', 'health_status', 'location')
        }),
        ('Status', {
            'fields': ('shelter', 'status')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(PetImage)
class PetImageAdmin(admin.ModelAdmin):
    list_display = ['pet', 'is_primary', 'created_at']
    list_filter = ['is_primary', 'created_at']
    search_fields = ['pet__name']
    readonly_fields = ['created_at']
