from django.contrib import admin
from .models import LostPetReport, FoundPetReport, LostFoundImage, Match, MatchNotification


class LostFoundImageInline(admin.TabularInline):
    model = LostFoundImage
    extra = 0


@admin.register(LostPetReport)
class LostPetReportAdmin(admin.ModelAdmin):
    list_display = ['id', 'pet', 'owner', 'last_seen_location', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['pet__name', 'description', 'owner__username', 'last_seen_location']
    readonly_fields = ['created_at', 'updated_at', 'resolved_at']
    inlines = [LostFoundImageInline]
    raw_id_fields = ['pet', 'owner']
    fieldsets = (
        ('Pet & Owner', {'fields': ('pet', 'owner')}),
        ('Details', {'fields': ('last_seen_location', 'last_seen_date', 'color', 'size', 'description')}),
        ('Status', {'fields': ('status',)}),
        ('Timestamps', {'fields': ('created_at', 'updated_at', 'resolved_at'), 'classes': ('collapse',)}),
    )


@admin.register(FoundPetReport)
class FoundPetReportAdmin(admin.ModelAdmin):
    list_display = ['id', 'pet_type', 'reporter', 'location_found', 'status', 'created_at']
    list_filter = ['pet_type', 'status', 'created_at']
    search_fields = ['description', 'reporter__username', 'location_found']
    readonly_fields = ['created_at', 'updated_at', 'resolved_at']
    inlines = [LostFoundImageInline]
    raw_id_fields = ['reporter']
    fieldsets = (
        ('Reporter', {'fields': ('reporter',)}),
        ('Pet Info', {'fields': ('pet_type', 'breed', 'color', 'size')}),
        ('Details', {'fields': ('description', 'location_found', 'date_found')}),
        ('Contact', {'fields': ('contact_phone', 'contact_email')}),
        ('Status', {'fields': ('status',)}),
        ('Timestamps', {'fields': ('created_at', 'updated_at', 'resolved_at'), 'classes': ('collapse',)}),
    )


@admin.register(LostFoundImage)
class LostFoundImageAdmin(admin.ModelAdmin):
    list_display = ['id', 'lost_report', 'found_report', 'is_primary', 'created_at']
    list_filter = ['is_primary', 'created_at']


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ['id', 'lost_report', 'found_report', 'match_score', 'status', 'created_at']
    list_filter = ['status', 'match_score', 'created_at']
    search_fields = ['lost_report__pet__name', 'found_report__pet_type']
    readonly_fields = ['created_at', 'updated_at', 'resolved_at']
    raw_id_fields = ['lost_report', 'found_report']
    fieldsets = (
        ('Reports', {'fields': ('lost_report', 'found_report')}),
        ('Match Details', {'fields': ('match_score', 'match_reasons', 'status')}),
        ('Confirmation', {'fields': ('confirmed_by_lost_owner', 'confirmed_by_finder')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at', 'resolved_at'), 'classes': ('collapse',)}),
    )


@admin.register(MatchNotification)
class MatchNotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'notification_type', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read', 'created_at']
    search_fields = ['title', 'message', 'user__username']
    readonly_fields = ['created_at', 'read_at']
