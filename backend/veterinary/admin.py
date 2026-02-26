from django.contrib import admin
from .models import MedicalRecord, Vaccination, Treatment, HealthReminder, Notification


class VaccinationInline(admin.TabularInline):
    model = Vaccination
    extra = 0


class TreatmentInline(admin.TabularInline):
    model = Treatment
    extra = 0


@admin.register(MedicalRecord)
class MedicalRecordAdmin(admin.ModelAdmin):
    list_display = ['title', 'pet', 'record_type', 'veterinarian', 'date', 'created_at']
    list_filter = ['record_type', 'date', 'created_at']
    search_fields = ['title', 'description', 'pet__name', 'veterinarian__username']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [VaccinationInline, TreatmentInline]
    fieldsets = (
        ('Pet Information', {
            'fields': ('pet', 'veterinarian')
        }),
        ('Record Details', {
            'fields': ('record_type', 'title', 'description', 'date', 'next_due_date', 'cost')
        }),
        ('Documents', {
            'fields': ('documents',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Vaccination)
class VaccinationAdmin(admin.ModelAdmin):
    list_display = ['vaccine_name', 'vaccine_type', 'medical_record', 'administered_date', 'next_due_date']
    list_filter = ['vaccine_type', 'is_booster', 'administered_date']
    search_fields = ['vaccine_name', 'medical_record__pet__name']
    readonly_fields = ['id']


@admin.register(Treatment)
class TreatmentAdmin(admin.ModelAdmin):
    list_display = ['treatment_name', 'treatment_type', 'medical_record', 'start_date', 'end_date']
    list_filter = ['treatment_type', 'start_date']
    search_fields = ['treatment_name', 'medical_record__pet__name']


@admin.register(HealthReminder)
class HealthReminderAdmin(admin.ModelAdmin):
    list_display = ['title', 'pet', 'reminder_type', 'due_date', 'reminder_date', 'status']
    list_filter = ['reminder_type', 'status', 'is_recurring', 'due_date']
    search_fields = ['title', 'description', 'pet__name']
    readonly_fields = ['created_at', 'updated_at', 'sent_at']
    fieldsets = (
        ('Pet Information', {
            'fields': ('pet', 'medical_record')
        }),
        ('Reminder Details', {
            'fields': ('reminder_type', 'title', 'description')
        }),
        ('Dates', {
            'fields': ('due_date', 'reminder_date')
        }),
        ('Status', {
            'fields': ('status', 'is_recurring', 'recurrence_interval')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'sent_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'pet', 'notification_type', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read', 'created_at']
    search_fields = ['title', 'message', 'user__username', 'pet__name']
    readonly_fields = ['created_at', 'read_at']
    fieldsets = (
        ('Recipient', {
            'fields': ('user', 'pet')
        }),
        ('Notification Details', {
            'fields': ('health_reminder', 'notification_type', 'title', 'message')
        }),
        ('Status', {
            'fields': ('is_read',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'read_at'),
            'classes': ('collapse',)
        }),
    )
