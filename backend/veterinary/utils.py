"""
Utility functions for veterinary app
"""
from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


def send_adoption_approval_email(adopter_email, pet_name, adopter_name, shelter=None):
    """Send formatted email for adoption approval; include shelter contact for next steps."""
    try:
        subject = f'You have been selected! Adoption approved – {pet_name}'
        shelter_name = getattr(shelter, 'shelter_name', None) or getattr(shelter, 'first_name', None) or getattr(shelter, 'username', 'The shelter')
        shelter_email = getattr(shelter, 'email', '') or ''
        shelter_phone = getattr(shelter, 'phone_number', '') or ''
        shelter_address = getattr(shelter, 'address', '') or ''

        plain_message = f"""
Dear {adopter_name},

Congratulations! You have been selected. Your adoption request for {pet_name} has been approved.

Next steps – please contact the shelter to complete the adoption process:

Shelter: {shelter_name}
Email: {shelter_email}
Phone: {shelter_phone}
Address: {shelter_address}

You can also view your new pet's profile and health records in your PetCare dashboard.

Thank you for choosing PetCare!
        """

        html_message = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Adoption Approved</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #059669;">You have been selected!</h2>
  <p>Dear {adopter_name},</p>
  <p>Congratulations! Your adoption request for <strong>{pet_name}</strong> has been approved.</p>
  <p><strong>Next steps – please contact the shelter to complete the adoption process:</strong></p>
  <table style="border-collapse: collapse; margin: 16px 0; background: #f9fafb; padding: 16px; border-radius: 8px; width: 100%;">
    <tr><td style="padding: 6px 12px 6px 0; font-weight: bold;">Shelter</td><td style="padding: 6px 0;">{shelter_name}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; font-weight: bold;">Email</td><td style="padding: 6px 0;"><a href="mailto:{shelter_email}">{shelter_email or '—'}</a></td></tr>
    <tr><td style="padding: 6px 12px 6px 0; font-weight: bold;">Phone</td><td style="padding: 6px 0;">{shelter_phone or '—'}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; font-weight: bold;">Address</td><td style="padding: 6px 0;">{shelter_address or '—'}</td></tr>
  </table>
  <p>You can also view your new pet's profile and health records in your PetCare dashboard.</p>
  <p>Thank you for choosing PetCare!</p>
</body>
</html>
        """

        send_mail(
            subject,
            plain_message.strip(),
            getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@petcare.com'),
            [adopter_email],
            fail_silently=True,
            html_message=html_message.strip(),
        )
        logger.info(f"Adoption approval email sent to {adopter_email}")
    except Exception as e:
        logger.error(f"Failed to send adoption approval email: {e}")


def send_vaccination_reminder_email(adopter_email, pet_name, vaccine_name, due_date):
    """Send email notification for vaccination reminder"""
    try:
        subject = f'Vaccination Reminder - {pet_name}'
        message = f"""
Dear Pet Owner,

This is a reminder that {pet_name} is due for {vaccine_name} on {due_date}.

Please schedule an appointment with your veterinarian.

PetCare Platform
        """
        
        send_mail(
            subject,
            message.strip(),
            getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@petcare.com'),
            [adopter_email],
            fail_silently=True,
        )
        logger.info(f"Vaccination reminder email sent to {adopter_email}")
    except Exception as e:
        logger.error(f"Failed to send vaccination reminder email: {e}")

