from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom User model with role-based access control and verification for Vet/Shelter.
    """
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('shelter', 'Shelter'),
        ('adopter', 'Adopter'),
        ('veterinarian', 'Veterinarian'),
    ]

    VERIFICATION_STATUS_CHOICES = [
        ('pending', 'PENDING'),
        ('approved', 'APPROVED'),
        ('rejected', 'REJECTED'),
    ]
    
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='adopter',
        help_text='User role in the system'
    )
    phone_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text='Contact phone number'
    )
    address = models.TextField(
        blank=True,
        null=True,
        help_text='User address'
    )
    profile_picture = models.ImageField(
        upload_to='profile_pictures/',
        blank=True,
        null=True,
        help_text='User profile picture'
    )
    # Role-specific: Shelter
    shelter_name = models.CharField(max_length=255, blank=True, null=True, help_text='Shelter display name')
    registration_number = models.CharField(max_length=100, blank=True, null=True, help_text='Shelter registration number')
    shelter_description = models.TextField(blank=True, null=True, help_text='Shelter description')
    # Role-specific: Veterinarian
    clinic_name = models.CharField(max_length=255, blank=True, null=True, help_text='Clinic or practice name')
    license_number = models.CharField(max_length=100, blank=True, null=True, help_text='Veterinary license number')
    specialization = models.CharField(max_length=255, blank=True, null=True, help_text='Specialization area')

    # Verification (Veterinarian & Shelter only)
    verification_status = models.CharField(
        max_length=20,
        choices=VERIFICATION_STATUS_CHOICES,
        default='pending',
        db_index=True,
        help_text='Verification status for Vet/Shelter roles'
    )
    verification_submitted_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verifications_performed',
        help_text='Admin who approved/rejected'
    )
    rejection_reason = models.TextField(blank=True, null=True)
    # Veterinarian documents (stored securely under MEDIA)
    license_document = models.FileField(
        upload_to='verification/vet/%Y/%m/',
        blank=True,
        null=True,
        help_text='Veterinarian license document'
    )
    certification_document = models.FileField(
        upload_to='verification/vet/%Y/%m/',
        blank=True,
        null=True,
        help_text='Veterinarian certification document'
    )
    # Shelter documents
    registration_certificate = models.FileField(
        upload_to='verification/shelter/%Y/%m/',
        blank=True,
        null=True,
        help_text='Shelter registration certificate'
    )
    organization_document = models.FileField(
        upload_to='verification/shelter/%Y/%m/',
        blank=True,
        null=True,
        help_text='Shelter organization verification document'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-date_joined']
    
    def __str__(self):
        return self.username
    
    @property
    def is_shelter(self):
        """Check if user is a shelter"""
        return self.role == 'shelter'
    
    @property
    def is_adopter(self):
        """Check if user is an adopter"""
        return self.role == 'adopter'
    
    @property
    def is_veterinarian(self):
        """Check if user is a veterinarian"""
        return self.role == 'veterinarian'
    
    @property
    def is_admin_user(self):
        """Check if user is an admin"""
        return self.role == 'admin' or self.is_superuser

    @property
    def is_verified(self):
        """True if user does not require verification (adopter/admin) or is approved as Vet/Shelter."""
        if self.role in ('adopter', 'admin') or self.is_superuser:
            return True
        if self.role in ('veterinarian', 'shelter'):
            return self.verification_status == 'approved'
        return True


class VerificationActionLog(models.Model):
    """Audit log for verification actions (submit, approve, reject)."""
    ACTION_CHOICES = [
        ('submitted', 'Submitted'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='verification_action_logs',
        help_text='User whose verification was acted upon'
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verification_actions_performed',
        help_text='Admin who performed the action (null for submit)'
    )
    reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user']), models.Index(fields=['action'])]

    def __str__(self):
        user_email = getattr(self.user, 'email', None) or getattr(self.user, 'username', '')
        date_str = self.created_at.strftime('%b %d, %Y') if self.created_at else ''
        return f"{self.get_action_display()} - {user_email} - {date_str}"


class VerificationNotification(models.Model):
    """In-app notifications for verification events (submission received, approved, rejected)."""
    NOTIFICATION_TYPE_CHOICES = [
        ('submission_received', 'Submission Received'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='verification_notifications'
    )
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', 'is_read'])]
