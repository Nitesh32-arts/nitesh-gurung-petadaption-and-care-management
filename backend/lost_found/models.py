from django.db import models
from django.utils import timezone
from accounts.models import User
from pets.models import Pet


class LostPetReport(models.Model):
    """
    Model for lost pet reports. Must be linked to an adopted pet.
    Only adopters (pet owners) can create; prevents duplicate active reports per pet.
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('matched', 'Matched'),
        ('resolved', 'Resolved'),
        ('cancelled', 'Cancelled'),
    ]

    pet = models.ForeignKey(
        Pet,
        on_delete=models.CASCADE,
        related_name='lost_pet_reports',
        help_text='Adopted pet that is lost'
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='lost_pet_reports',
        limit_choices_to={'role': 'adopter'},
        help_text='Pet owner (adopter) who reported'
    )
    last_seen_location = models.CharField(
        max_length=200,
        help_text='Location where pet was last seen'
    )
    last_seen_date = models.DateField(
        help_text='Date when pet was last seen'
    )
    color = models.CharField(max_length=100, null=True, blank=True, help_text='Color/markings (optional, improves matching)')
    size = models.CharField(
        max_length=20,
        choices=[('small', 'Small'), ('medium', 'Medium'), ('large', 'Large')],
        null=True,
        blank=True,
        help_text='Size (optional, improves matching)',
    )
    description = models.TextField(
        blank=True,
        help_text='Additional description'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        help_text='Status of the report'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the report was resolved'
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['pet', 'status']),
            models.Index(fields=['owner', 'status']),
            models.Index(fields=['status', 'created_at']),
        ]
        verbose_name = 'Lost Pet Report'
        verbose_name_plural = 'Lost Pet Reports'

    def __str__(self):
        return f"Lost: {self.pet.name} ({self.pet.pet_type}) - {self.owner.username}"


class FoundPetReport(models.Model):
    """
    Model for found pet reports.
    Adopters and shelters can create.
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('matched', 'Matched'),
        ('resolved', 'Resolved'),
        ('cancelled', 'Cancelled'),
    ]

    PET_TYPE_CHOICES = [
        ('dog', 'Dog'),
        ('cat', 'Cat'),
        ('bird', 'Bird'),
        ('rabbit', 'Rabbit'),
        ('hamster', 'Hamster'),
        ('other', 'Other'),
    ]

    reporter = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='found_pet_reports',
        help_text='User who reported the found pet'
    )
    pet_type = models.CharField(
        max_length=20,
        choices=PET_TYPE_CHOICES,
        help_text='Type of pet found'
    )
    breed = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text='Breed of the pet (if identifiable)'
    )
    color = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text='Color/markings of the pet'
    )
    size = models.CharField(
        max_length=20,
        choices=[('small', 'Small'), ('medium', 'Medium'), ('large', 'Large')],
        null=True,
        blank=True,
        help_text='Size of the pet'
    )
    description = models.TextField(
        help_text='Description of the found pet'
    )
    location_found = models.CharField(
        max_length=200,
        help_text='Location where pet was found'
    )
    date_found = models.DateField(
        help_text='Date when pet was found'
    )
    contact_phone = models.CharField(
        max_length=20,
        help_text='Contact phone number'
    )
    contact_email = models.EmailField(
        help_text='Contact email address'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        help_text='Status of the report'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the report was resolved'
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['pet_type', 'status']),
            models.Index(fields=['location_found']),
            models.Index(fields=['status', 'created_at']),
        ]
        verbose_name = 'Found Pet Report'
        verbose_name_plural = 'Found Pet Reports'

    def __str__(self):
        return f"Found: {self.pet_type} - {self.reporter.username}"


class LostFoundImage(models.Model):
    """
    Images for lost/found pet reports
    """
    lost_report = models.ForeignKey(
        LostPetReport,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='images',
    )
    found_report = models.ForeignKey(
        FoundPetReport,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='images',
    )
    image = models.ImageField(upload_to='lost_found_images/')
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-is_primary', 'created_at']

    def __str__(self):
        r = self.lost_report or self.found_report
        return f"Image for {r}"


class Match(models.Model):
    """
    Tracks matches between lost and found reports.
    Status flow: pending_confirmation -> confirmed -> resolved (or rejected)
    """
    STATUS_CHOICES = [
        ('pending_confirmation', 'Pending Confirmation'),
        ('confirmed', 'Confirmed'),
        ('rejected', 'Rejected'),
        ('resolved', 'Resolved'),
    ]

    lost_report = models.ForeignKey(
        LostPetReport,
        on_delete=models.CASCADE,
        related_name='matches',
    )
    found_report = models.ForeignKey(
        FoundPetReport,
        on_delete=models.CASCADE,
        related_name='matches',
    )
    match_score = models.FloatField(help_text='Similarity score (0-100)')
    match_reasons = models.TextField(help_text='Reasons for the match')
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default='pending_confirmation',
    )
    confirmed_by_lost_owner = models.BooleanField(default=False)
    confirmed_by_finder = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-match_score', '-created_at']
        indexes = [
            models.Index(fields=['lost_report', 'status']),
            models.Index(fields=['found_report', 'status']),
        ]
        unique_together = [['lost_report', 'found_report']]

    def __str__(self):
        return f"Match: {self.lost_report.pet.name} <-> Found (Score: {self.match_score})"

    def is_confirmed(self):
        return self.confirmed_by_lost_owner and self.confirmed_by_finder


class MatchNotification(models.Model):
    """
    Notifications when matches are created or confirmed
    """
    match = models.ForeignKey(
        Match,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='match_notifications',
    )
    notification_type = models.CharField(
        max_length=30,
        choices=[
            ('match_found', 'Match Found'),
            ('match_confirmed', 'Match Confirmed'),
            ('match_rejected', 'Match Rejected'),
        ],
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', 'is_read'])]

    def mark_as_read(self):
        from django.utils import timezone
        self.is_read = True
        self.read_at = timezone.now()
        self.save()
