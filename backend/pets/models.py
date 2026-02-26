from django.db import models
from accounts.models import User


class Pet(models.Model):
    """
    Pet model for storing pet information
    """
    PET_TYPE_CHOICES = [
        ('dog', 'Dog'),
        ('cat', 'Cat'),
        ('bird', 'Bird'),
        ('rabbit', 'Rabbit'),
        ('hamster', 'Hamster'),
        ('other', 'Other'),
    ]
    
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
    ]
    
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('pending', 'Pending Adoption'),
        ('adopted', 'Adopted'),
    ]
    
    name = models.CharField(max_length=100, help_text='Pet name')
    pet_type = models.CharField(
        max_length=20, 
        choices=PET_TYPE_CHOICES,
        help_text='Type of pet'
    )
    breed = models.CharField(max_length=100, help_text='Pet breed')
    age = models.IntegerField(help_text='Age in months')
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    health_status = models.TextField(help_text='Current health status and medical information')
    description = models.TextField(help_text='Detailed description of the pet')
    location = models.CharField(max_length=200, help_text='Location/address where pet is available')
    shelter = models.ForeignKey(
        User, 
        on_delete=models.CASCADE,
        related_name='pets',
        limit_choices_to={'role': 'shelter'},
        help_text='Shelter that owns this pet'
    )
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='available',
        help_text='Adoption status'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['pet_type', 'status']),
            models.Index(fields=['shelter', 'status']),
            models.Index(fields=['breed']),
            models.Index(fields=['location']),
        ]
        verbose_name = 'Pet'
        verbose_name_plural = 'Pets'
    
    def __str__(self):
        return f"{self.name} ({self.pet_type}) - {self.shelter.username}"


class PetImage(models.Model):
    """
    Pet image model for storing multiple images per pet
    """
    pet = models.ForeignKey(
        Pet, 
        on_delete=models.CASCADE, 
        related_name='images',
        help_text='Pet this image belongs to'
    )
    image = models.ImageField(
        upload_to='pet_images/',
        help_text='Pet image file'
    )
    is_primary = models.BooleanField(
        default=False,
        help_text='Set as primary/featured image'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-is_primary', 'created_at']
        verbose_name = 'Pet Image'
        verbose_name_plural = 'Pet Images'
    
    def __str__(self):
        return f"Image for {self.pet.name}"


class AdoptionRequest(models.Model):
    """
    Model for adoption requests from adopters to shelters
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('updated', 'Updated'),   # Adopter selected; email sent; adoption not yet completed
        ('approved', 'Approved'), # Legacy: treat same as adopted
        ('adopted', 'Adopted'),   # Adoption completed (adopted_date set, pet adopted)
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]
    
    pet = models.ForeignKey(
        Pet,
        on_delete=models.CASCADE,
        related_name='adoption_requests',
        help_text='Pet being requested for adoption'
    )
    adopter = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='adoption_requests',
        limit_choices_to={'role': 'adopter'},
        help_text='User requesting to adopt'
    )
    shelter = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='received_adoption_requests',
        limit_choices_to={'role': 'shelter'},
        help_text='Shelter that owns the pet'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        help_text='Request status'
    )
    notes = models.TextField(
        blank=True,
        null=True,
        help_text='Additional notes from adopter'
    )
    request_date = models.DateTimeField(auto_now_add=True)
    reviewed_date = models.DateTimeField(null=True, blank=True)
    adopted_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Date when adoption was confirmed (set when approved)',
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_adoption_requests',
        help_text='Shelter user who reviewed the request'
    )
    
    class Meta:
        ordering = ['-request_date']
        unique_together = [['pet', 'adopter']]  # One request per pet per adopter
        indexes = [
            models.Index(fields=['adopter', 'status']),
            models.Index(fields=['shelter', 'status']),
            models.Index(fields=['pet', 'status']),
        ]
        verbose_name = 'Adoption Request'
        verbose_name_plural = 'Adoption Requests'
    
    def __str__(self):
        return f"{self.adopter.username} -> {self.pet.name} ({self.status})"


class SavedPet(models.Model):
    """
    Model for saved/favorited pets by adopters
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='saved_pets',
        limit_choices_to={'role': 'adopter'},
        help_text='User who saved the pet'
    )
    pet = models.ForeignKey(
        Pet,
        on_delete=models.CASCADE,
        related_name='saved_by_users',
        help_text='Pet being saved'
    )
    saved_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-saved_at']
        unique_together = [['user', 'pet']]  # One save per pet per user
        indexes = [
            models.Index(fields=['user']),
        ]
        verbose_name = 'Saved Pet'
        verbose_name_plural = 'Saved Pets'
    
    def __str__(self):
        return f"{self.user.username} saved {self.pet.name}"


class Message(models.Model):
    """
    Model for messages between users (adopters, shelters, vets)
    """
    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='sent_messages',
        help_text='User sending the message'
    )
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='received_messages',
        help_text='User receiving the message'
    )
    subject = models.CharField(max_length=200, help_text='Message subject')
    body = models.TextField(blank=True, help_text='Message content (optional if attachment)')
    attachment = models.FileField(
        upload_to='message_docs/%Y/%m/',
        null=True,
        blank=True,
        help_text='Optional document attachment',
    )
    attachment_name = models.CharField(max_length=255, blank=True, help_text='Original filename')
    is_read = models.BooleanField(default=False, help_text='Whether message has been read')
    read_at = models.DateTimeField(null=True, blank=True, help_text='When the message was read by recipient')
    is_deleted = models.BooleanField(default=False, help_text='Soft-delete: message unsent for everyone')
    deleted_at = models.DateTimeField(null=True, blank=True, help_text='When the message was unsent')
    created_at = models.DateTimeField(auto_now_add=True)
    related_pet = models.ForeignKey(
        Pet,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='messages',
        help_text='Pet related to this message (if any)'
    )
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['sender']),
        ]
        verbose_name = 'Message'
        verbose_name_plural = 'Messages'
    
    def __str__(self):
        return f"{self.sender.username} -> {self.recipient.username}: {self.subject}"


class MessageHidden(models.Model):
    """Delete for me: hide a message only for this user (other participant still sees it)."""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='hidden_messages',
    )
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='hidden_for_users',
    )

    class Meta:
        unique_together = [['user', 'message']]
        verbose_name = 'Message Hidden'
        verbose_name_plural = 'Messages Hidden'

    def __str__(self):
        return f"{self.user.username} hid message {self.message_id}"


class Reaction(models.Model):
    """Emoji reaction to a message. One per user per message (emoji can change)."""
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='reactions',
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='message_reactions',
    )
    emoji = models.CharField(max_length=16, default='👍')

    class Meta:
        unique_together = [['message', 'user']]
        verbose_name = 'Reaction'
        verbose_name_plural = 'Reactions'

    def __str__(self):
        return f"{self.user.username} {self.emoji} on message {self.message_id}"


class RewardPoint(models.Model):
    """
    Model for tracking user reward points
    """
    POINT_SOURCE_CHOICES = [
        ('adoption', 'Pet Adoption'),
        ('review', 'Shelter Review'),
        ('referral', 'User Referral'),
        ('engagement', 'Platform Engagement'),
        ('bonus', 'Bonus Points'),
    ]
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='reward_points',
        help_text='User earning the points'
    )
    points = models.IntegerField(help_text='Number of points earned')
    source = models.CharField(
        max_length=20,
        choices=POINT_SOURCE_CHOICES,
        help_text='Source of the points'
    )
    description = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text='Description of how points were earned'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    related_pet = models.ForeignKey(
        Pet,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reward_points',
        help_text='Pet related to these points (if any)'
    )
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
        ]
        verbose_name = 'Reward Point'
        verbose_name_plural = 'Reward Points'
    
    def __str__(self):
        return f"{self.user.username}: {self.points} points ({self.source})"