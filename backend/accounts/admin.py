from django.contrib import admin
from django.contrib import messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from .models import User, VerificationActionLog, VerificationNotification
from .views import _do_approve_verification, _do_reject_verification


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Admin configuration for custom User model
    """
    list_display = [
        'username', 'email', 'full_name', 'role', 'verification_status',
        'is_active', 'is_staff', 'date_joined'
    ]
    list_filter = [
        'role', 'verification_status', 'is_active', 'is_staff', 'is_superuser', 'date_joined'
    ]
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering = ['-date_joined']
    readonly_fields = ['date_joined', 'last_login', 'created_at', 'updated_at']
    actions = ['approve_verification', 'reject_verification']

    fieldsets = BaseUserAdmin.fieldsets + (
        ('Additional Information', {
            'fields': (
                'role', 'phone_number', 'address', 'profile_picture',
                'created_at', 'updated_at'
            )
        }),
        ('Verification (Vet/Shelter)', {
            'fields': (
                'verification_status', 'verification_submitted_at', 'verified_at', 'verified_by', 'rejection_reason',
                'license_document', 'certification_document', 'registration_certificate', 'organization_document',
            ),
            'classes': ('collapse',),
        }),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Additional Information', {
            'fields': (
                'email', 'first_name', 'last_name', 'role',
                'phone_number', 'address'
            )
        }),
    )

    def full_name(self, obj):
        """Display full name"""
        if obj.first_name or obj.last_name:
            return f"{obj.first_name} {obj.last_name}".strip()
        return "-"
    full_name.short_description = 'Full Name'

    def get_readonly_fields(self, request, obj=None):
        """Make username readonly on edit"""
        readonly = list(self.readonly_fields)
        if obj:
            readonly.append('username')
        return readonly

    @admin.action(description='Approve verification')
    def approve_verification(self, request, queryset):
        count = 0
        for user in queryset:
            if user.role not in ('veterinarian', 'shelter'):
                continue
            if user.verification_status == 'approved':
                continue
            _do_approve_verification(user, request.user)
            count += 1
        if count:
            self.message_user(request, f'{count} user(s) approved.', messages.SUCCESS)
        else:
            self.message_user(request, 'No pending vet/shelter selected.', messages.WARNING)

    @admin.action(description='Reject verification')
    def reject_verification(self, request, queryset):
        reason = 'Rejected from Django admin.'
        count = 0
        for user in queryset:
            if user.role not in ('veterinarian', 'shelter'):
                continue
            _do_reject_verification(user, request.user, reason)
            count += 1
        if count:
            self.message_user(request, f'{count} user(s) rejected.', messages.SUCCESS)
        else:
            self.message_user(request, 'No vet/shelter selected.', messages.WARNING)


@admin.register(VerificationActionLog)
class VerificationActionLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'performed_by', 'created_at']
    list_filter = ['action', 'created_at']
    search_fields = ['user__username', 'user__email', 'reason']
    readonly_fields = ['user', 'action', 'performed_by', 'reason', 'created_at']


@admin.register(VerificationNotification)
class VerificationNotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'notification_type', 'title', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read']
    search_fields = ['user__username', 'title', 'message']
