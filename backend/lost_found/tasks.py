"""
Celery tasks for lost and found pet matching
"""
from celery import shared_task
from django.utils import timezone
from .models import LostPetReport, FoundPetReport, Match, MatchNotification
from .matching import find_matches_for_lost_report, find_matches_for_found_report, create_match


@shared_task
def check_for_matches():
    """
    Task to continuously check for matches between lost and found reports
    Runs periodically to find new matches
    """
    # Get all active lost reports
    lost_reports = LostPetReport.objects.filter(status='active')
    
    matches_created = 0
    notifications_sent = 0
    
    for lost_report in lost_reports:
        # Find potential matches
        matches = find_matches_for_lost_report(lost_report, min_score=50.0)
        
        # Create Match objects for high-scoring matches
        for match_data in matches[:5]:  # Limit to top 5 matches per report
            found_report = match_data['found_report']
            
            # Check if match already exists
            existing_match = Match.objects.filter(
                lost_report=lost_report,
                found_report=found_report
            ).first()
            
            if not existing_match:
                # Create new match
                match = create_match(lost_report, found_report, min_score=50.0)
                
                if match:
                    matches_created += 1
                    
                    # Create notifications for both parties
                    # Notify lost pet owner
                    MatchNotification.objects.create(
                        match=match,
                        user=lost_report.user,
                        notification_type='match_found',
                        title=f'Potential Match Found for {lost_report.pet_name}',
                        message=f'We found a potential match for your lost pet "{lost_report.pet_name}". '
                               f'Match score: {match.match_score}%. '
                               f'Reasons: {match.match_reasons}'
                    )
                    
                    # Notify finder
                    MatchNotification.objects.create(
                        match=match,
                        user=found_report.user,
                        notification_type='match_found',
                        title='Potential Match Found',
                        message=f'We found a potential match for a pet you found. '
                               f'A lost pet report matches your found pet. '
                               f'Match score: {match.match_score}%. '
                               f'Reasons: {match.match_reasons}'
                    )
                    
                    notifications_sent += 2
    
    return f"Created {matches_created} new matches and sent {notifications_sent} notifications"


@shared_task
def check_for_matches_for_new_report(report_type, report_id):
    """
    Task to check for matches when a new report is created
    
    Args:
        report_type: 'lost' or 'found'
        report_id: ID of the report
    """
    if report_type == 'lost':
        try:
            lost_report = LostPetReport.objects.get(id=report_id, status='active')
            matches = find_matches_for_lost_report(lost_report, min_score=50.0)
            
            matches_created = 0
            for match_data in matches[:5]:
                match = create_match(lost_report, match_data['found_report'], min_score=50.0)
                if match:
                    matches_created += 1
                    # Create notifications (same as in check_for_matches)
                    MatchNotification.objects.create(
                        match=match,
                        user=lost_report.user,
                        notification_type='match_found',
                        title=f'Potential Match Found for {lost_report.pet_name}',
                        message=f'We found a potential match for your lost pet "{lost_report.pet_name}". '
                               f'Match score: {match.match_score}%. '
                               f'Reasons: {match.match_reasons}'
                    )
                    MatchNotification.objects.create(
                        match=match,
                        user=match_data['found_report'].user,
                        notification_type='match_found',
                        title='Potential Match Found',
                        message=f'We found a potential match for a pet you found. '
                               f'A lost pet report matches your found pet. '
                               f'Match score: {match.match_score}%. '
                               f'Reasons: {match.match_reasons}'
                    )
            
            return f"Created {matches_created} matches for lost report {report_id}"
        except LostPetReport.DoesNotExist:
            return f"Lost report {report_id} not found"
    
    elif report_type == 'found':
        try:
            found_report = FoundPetReport.objects.get(id=report_id, status='active')
            matches = find_matches_for_found_report(found_report, min_score=50.0)
            
            matches_created = 0
            for match_data in matches[:5]:
                match = create_match(match_data['lost_report'], found_report, min_score=50.0)
                if match:
                    matches_created += 1
                    # Create notifications
                    MatchNotification.objects.create(
                        match=match,
                        user=match_data['lost_report'].user,
                        notification_type='match_found',
                        title=f'Potential Match Found for {match_data["lost_report"].pet_name}',
                        message=f'We found a potential match for your lost pet "{match_data["lost_report"].pet_name}". '
                               f'Match score: {match.match_score}%. '
                               f'Reasons: {match.match_reasons}'
                    )
                    MatchNotification.objects.create(
                        match=match,
                        user=found_report.user,
                        notification_type='match_found',
                        title='Potential Match Found',
                        message=f'We found a potential match for a pet you found. '
                               f'A lost pet report matches your found pet. '
                               f'Match score: {match.match_score}%. '
                               f'Reasons: {match.match_reasons}'
                    )
            
            return f"Created {matches_created} matches for found report {report_id}"
        except FoundPetReport.DoesNotExist:
            return f"Found report {report_id} not found"
    
    return "Invalid report type"

