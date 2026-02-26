from django.db import models
from django.utils import timezone
from accounts.models import User
from pets.models import Pet


class MedicalRecord(models.Model):
    """
    Medical record model for storing pet health information
    """
    RECORD_TYPE_CHOICES = [
        ('checkup', 'Check-up'),
        ('vaccination', 'Vaccination'),
        ('treatment', 'Treatment'),
        ('surgery', 'Surgery'),
        ('emergency', 'Emergency'),
        ('other', 'Other'),
    ]
    
    pet = models.ForeignKey(
        Pet,
        on_delete=models.CASCADE,
        related_name='medical_records',
        help_text='Pet this record belongs to'
    )
    veterinarian = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='medical_records',
        limit_choices_to={'role': 'veterinarian'},
        help_text='Veterinarian who created this record'
    )
    record_type = models.CharField(
        max_length=20,
        choices=RECORD_TYPE_CHOICES,
        help_text='Type of medical record'
    )
    title = models.CharField(
        max_length=200,
        help_text='Title/Summary of the record'
    )
    description = models.TextField(
        help_text='Detailed description of the medical record'
    )
    date = models.DateField(
        help_text='Date of the medical procedure/visit'
    )
    next_due_date = models.DateField(
        null=True,
        blank=True,
        help_text='Next due date for follow-up (for vaccinations/check-ups)'
    )
    cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Cost of the procedure (optional)'
    )
    documents = models.FileField(
        upload_to='medical_documents/',
        null=True,
        blank=True,
        help_text='Medical documents (reports, certificates, etc.)'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['pet', 'record_type']),
            models.Index(fields=['veterinarian', 'date']),
            models.Index(fields=['next_due_date']),
        ]
        verbose_name = 'Medical Record'
        verbose_name_plural = 'Medical Records'
    
    def __str__(self):
        return f"{self.record_type} - {self.pet.name} ({self.date})"


class Vaccination(models.Model):
    """
    Vaccination model for tracking pet vaccinations
    """
    VACCINE_TYPE_CHOICES = [
        ('rabies', 'Rabies'),
        ('dhpp', 'DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)'),
        ('bordetella', 'Bordetella'),
        ('feline_leukemia', 'Feline Leukemia'),
        ('feline_distemper', 'Feline Distemper (FVRCP)'),
        ('other', 'Other'),
    ]
    
    medical_record = models.OneToOneField(
        MedicalRecord,
        on_delete=models.CASCADE,
        related_name='vaccination',
        help_text='Medical record associated with this vaccination'
    )
    vaccine_type = models.CharField(
        max_length=50,
        choices=VACCINE_TYPE_CHOICES,
        help_text='Type of vaccine administered'
    )
    vaccine_name = models.CharField(
        max_length=200,
        help_text='Name/brand of the vaccine'
    )
    batch_number = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text='Vaccine batch number'
    )
    administered_date = models.DateField(
        help_text='Date vaccine was administered'
    )
    next_due_date = models.DateField(
        help_text='Next vaccination due date'
    )
    is_booster = models.BooleanField(
        default=False,
        help_text='Is this a booster shot?'
    )
    notes = models.TextField(
        null=True,
        blank=True,
        help_text='Additional notes about the vaccination'
    )
    
    class Meta:
        ordering = ['-administered_date']
        verbose_name = 'Vaccination'
        verbose_name_plural = 'Vaccinations'
    
    def __str__(self):
        return f"{self.vaccine_type} - {self.medical_record.pet.name} ({self.administered_date})"


class Treatment(models.Model):
    """
    Treatment model for tracking medical treatments
    """
    TREATMENT_TYPE_CHOICES = [
        ('medication', 'Medication'),
        ('therapy', 'Therapy'),
        ('dental', 'Dental Care'),
        ('grooming', 'Grooming'),
        ('parasite_control', 'Parasite Control'),
        ('other', 'Other'),
    ]
    
    medical_record = models.ForeignKey(
        MedicalRecord,
        on_delete=models.CASCADE,
        related_name='treatments',
        help_text='Medical record associated with this treatment'
    )
    treatment_type = models.CharField(
        max_length=30,
        choices=TREATMENT_TYPE_CHOICES,
        help_text='Type of treatment'
    )
    treatment_name = models.CharField(
        max_length=200,
        help_text='Name of the treatment/medication'
    )
    dosage = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        help_text='Dosage information'
    )
    frequency = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text='Frequency of administration (e.g., "Twice daily", "Once a week")'
    )
    start_date = models.DateField(
        help_text='Treatment start date'
    )
    end_date = models.DateField(
        null=True,
        blank=True,
        help_text='Treatment end date (if applicable)'
    )
    instructions = models.TextField(
        null=True,
        blank=True,
        help_text='Special instructions for the treatment'
    )
    
    class Meta:
        ordering = ['-start_date']
        verbose_name = 'Treatment'
        verbose_name_plural = 'Treatments'
    
    def __str__(self):
        return f"{self.treatment_name} - {self.medical_record.pet.name}"


class HealthReminder(models.Model):
    """
    Health reminder model for scheduling health check-ups and vaccinations
    """
    REMINDER_TYPE_CHOICES = [
        ('vaccination', 'Vaccination Due'),
        ('checkup', 'Check-up Due'),
        ('treatment', 'Treatment Due'),
        ('medication', 'Medication Reminder'),
        ('other', 'Other'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    pet = models.ForeignKey(
        Pet,
        on_delete=models.CASCADE,
        related_name='health_reminders',
        help_text='Pet this reminder is for'
    )
    medical_record = models.ForeignKey(
        MedicalRecord,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='reminders',
        help_text='Related medical record (if applicable)'
    )
    reminder_type = models.CharField(
        max_length=20,
        choices=REMINDER_TYPE_CHOICES,
        help_text='Type of reminder'
    )
    title = models.CharField(
        max_length=200,
        help_text='Reminder title'
    )
    description = models.TextField(
        help_text='Reminder description'
    )
    due_date = models.DateField(
        help_text='Date when the reminder is due'
    )
    reminder_date = models.DateField(
        help_text='Date to send the reminder (usually a few days before due_date)'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        help_text='Reminder status'
    )
    is_recurring = models.BooleanField(
        default=False,
        help_text='Is this a recurring reminder?'
    )
    recurrence_interval = models.IntegerField(
        null=True,
        blank=True,
        help_text='Recurrence interval in days (e.g., 365 for annual)'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the reminder was sent'
    )
    
    class Meta:
        ordering = ['due_date', 'reminder_date']
        indexes = [
            models.Index(fields=['pet', 'status']),
            models.Index(fields=['reminder_date', 'status']),
            models.Index(fields=['due_date']),
        ]
        verbose_name = 'Health Reminder'
        verbose_name_plural = 'Health Reminders'
    
    def __str__(self):
        return f"{self.reminder_type} - {self.pet.name} ({self.due_date})"
    
    def is_overdue(self):
        """Check if reminder is overdue"""
        return self.due_date < timezone.now().date() and self.status != 'completed'
    
    def is_due_soon(self, days=7):
        """Check if reminder is due within specified days"""
        today = timezone.now().date()
        return (self.reminder_date <= today <= self.due_date) and self.status == 'pending'


class Notification(models.Model):
    """
    Notification model for sending notifications to adopters about health reminders
    """
    NOTIFICATION_TYPE_CHOICES = [
        ('vaccination', 'Vaccination Reminder'),
        ('checkup', 'Check-up Reminder'),
        ('treatment', 'Treatment Reminder'),
        ('medication', 'Medication Reminder'),
        ('overdue', 'Overdue Reminder'),
        ('other', 'Other'),
    ]
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications',
        limit_choices_to={'role': 'adopter'},
        help_text='Adopter to receive the notification'
    )
    pet = models.ForeignKey(
        Pet,
        on_delete=models.CASCADE,
        related_name='notifications',
        help_text='Pet this notification is about'
    )
    health_reminder = models.ForeignKey(
        HealthReminder,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications',
        help_text='Related health reminder'
    )
    notification_type = models.CharField(
        max_length=20,
        choices=NOTIFICATION_TYPE_CHOICES,
        help_text='Type of notification'
    )
    title = models.CharField(
        max_length=200,
        help_text='Notification title'
    )
    message = models.TextField(
        help_text='Notification message'
    )
    is_read = models.BooleanField(
        default=False,
        help_text='Has the notification been read?'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the notification was read'
    )
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['pet', 'notification_type']),
        ]
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
    
    def __str__(self):
        return f"{self.notification_type} - {self.pet.name} ({self.user.username})"
    
    def mark_as_read(self):
        """Mark notification as read"""
        from django.utils import timezone
        self.is_read = True
        self.read_at = timezone.now()
        self.save()
