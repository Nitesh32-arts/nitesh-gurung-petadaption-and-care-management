"""
Celery tasks for veterinary care reminders and notifications
"""
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from .models import HealthReminder, Notification
from accounts.models import User
from pets.models import AdoptionRequest
from .utils import send_vaccination_reminder_email
import logging

logger = logging.getLogger(__name__)


@shared_task
def send_health_reminders():
    """
    Task to send health reminders that are due
    Runs daily to check for reminders that need to be sent
    """
    today = timezone.now().date()
    
    # Get reminders that are due today or overdue
    reminders = HealthReminder.objects.filter(
        reminder_date__lte=today,
        status='pending'
    ).select_related('pet', 'pet__shelter')
    
    sent_count = 0
    for reminder in reminders:
        # Mark reminder as sent
        reminder.status = 'sent'
        reminder.sent_at = timezone.now()
        reminder.save()
        
        # Create notification for adopter (if pet is adopted)
        try:
            adoption_request = AdoptionRequest.objects.filter(
                pet=reminder.pet,
                status__in=('approved', 'adopted')
            ).select_related('adopter').first()
            
            if adoption_request:
                # Create notification
                Notification.objects.create(
                    user=adoption_request.adopter,
                    pet=reminder.pet,
                    health_reminder=reminder,
                    notification_type=reminder.reminder_type,
                    title=f"Health Reminder: {reminder.title}",
                    message=f"Your pet {reminder.pet.name} has a {reminder.get_reminder_type_display()} due on {reminder.due_date.strftime('%B %d, %Y')}. {reminder.description}"
                )
                
                # Send email notification for vaccination reminders
                if reminder.reminder_type == 'vaccination':
                    try:
                        send_vaccination_reminder_email(
                            adoption_request.adopter.email,
                            reminder.pet.name,
                            reminder.title,
                            reminder.due_date.strftime('%B %d, %Y')
                        )
                    except Exception as e:
                        logger.error(f"Failed to send reminder email: {e}")
        except Exception as e:
            # Log error but continue processing other reminders
            logger.error(f"Error creating notification for reminder {reminder.id}: {e}")
        
        sent_count += 1
    
    return f"Sent {sent_count} reminders"


@shared_task
def create_recurring_reminders():
    """
    Task to create recurring reminders
    Runs daily to check for completed reminders that need to be renewed
    """
    today = timezone.now().date()
    
    # Get completed recurring reminders
    completed_reminders = HealthReminder.objects.filter(
        status='completed',
        is_recurring=True,
        recurrence_interval__isnull=False
    )
    
    created_count = 0
    for reminder in completed_reminders:
        # Calculate next due date
        next_due_date = reminder.due_date + timedelta(days=reminder.recurrence_interval)
        next_reminder_date = reminder.reminder_date + timedelta(days=reminder.recurrence_interval)
        
        # Create new reminder
        HealthReminder.objects.create(
            pet=reminder.pet,
            medical_record=reminder.medical_record,
            reminder_type=reminder.reminder_type,
            title=reminder.title,
            description=reminder.description,
            due_date=next_due_date,
            reminder_date=next_reminder_date,
            is_recurring=True,
            recurrence_interval=reminder.recurrence_interval,
            status='pending'
        )
        
        created_count += 1
    
    return f"Created {created_count} recurring reminders"


@shared_task
def check_overdue_reminders():
    """
    Task to check for overdue reminders and send notifications
    Runs daily to check for overdue reminders
    """
    today = timezone.now().date()
    
    # Get overdue reminders
    overdue_reminders = HealthReminder.objects.filter(
        due_date__lt=today,
        status__in=['pending', 'sent']
    ).select_related('pet', 'pet__shelter')
    
    overdue_count = 0
    for reminder in overdue_reminders:
        # Create urgent notification for overdue reminders
        try:
            adoption_request = AdoptionRequest.objects.filter(
                pet=reminder.pet,
                status__in=('approved', 'adopted')
            ).select_related('adopter').first()
            
            if adoption_request:
                # Check if notification already exists
                existing_notification = Notification.objects.filter(
                    user=adoption_request.adopter,
                    pet=reminder.pet,
                    health_reminder=reminder,
                    notification_type='overdue'
                ).first()
                
                if not existing_notification:
                    Notification.objects.create(
                        user=adoption_request.adopter,
                        pet=reminder.pet,
                        health_reminder=reminder,
                        notification_type='overdue',
                        title=f"URGENT: Overdue Health Reminder - {reminder.title}",
                        message=f"Your pet {reminder.pet.name} has an OVERDUE {reminder.get_reminder_type_display()} that was due on {reminder.due_date.strftime('%B %d, %Y')}. Please schedule an appointment as soon as possible. {reminder.description}"
                    )
                    overdue_count += 1
        except Exception as e:
            logger.error(f"Error creating overdue notification for reminder {reminder.id}: {e}")
    
    return f"Created {overdue_count} overdue notifications"

