"""
Matching algorithm for lost and found pet reports.
Uses pet type, breed, color, size, location, date proximity.
Only creates match if score >= 50.
"""
from .models import LostPetReport, FoundPetReport, Match


def calculate_match_score(lost_report, found_report):
    """
    Calculate similarity score (0-100) between lost and found reports.
    Lost report: pet (FK) provides pet_type, breed; optional color, size.
    Found report: pet_type, breed, color, size.
    """
    score = 0.0
    reasons = []

    # Pet type must match (required)
    lost_type = lost_report.pet.pet_type if lost_report.pet else None
    if lost_type and lost_type == found_report.pet_type:
        score += 30
        reasons.append("Pet type matches")
    else:
        return 0.0, ["Pet type does not match"]

    # Breed match (20 points)
    lost_breed = (lost_report.pet.breed or "").strip() if lost_report.pet else ""
    found_breed = (found_report.breed or "").strip()
    if lost_breed and found_breed:
        if lost_breed.lower() == found_breed.lower():
            score += 20
            reasons.append("Breed matches")
        elif lost_breed.lower() in found_breed.lower() or found_breed.lower() in lost_breed.lower():
            score += 10
            reasons.append("Breed partially matches")

    # Color match (20 points) - lost has optional color
    lost_color = (lost_report.color or "").strip() if hasattr(lost_report, "color") else ""
    found_color = (found_report.color or "").strip()
    if lost_color and found_color:
        lost_colors = set(lost_color.lower().split())
        found_colors = set(found_color.lower().split())
        common = lost_colors.intersection(found_colors)
        if common:
            score += min(20, len(common) * 5)
            reasons.append(f"Color matches: {', '.join(common)}")

    # Size match (10 points)
    if lost_report.size and found_report.size and lost_report.size == found_report.size:
        score += 10
        reasons.append("Size matches")

    # Location proximity (10 points)
    lost_loc = (lost_report.last_seen_location or "").lower()
    found_loc = (found_report.location_found or "").lower()
    if lost_loc and found_loc:
        lost_words = set(lost_loc.split())
        found_words = set(found_loc.split())
        common_words = lost_words.intersection(found_words)
        if len(common_words) >= 2:
            score += 10
            reasons.append("Location is close")
        elif len(common_words) == 1:
            score += 5
            reasons.append("Location is somewhat close")

    # Date proximity (10 points)
    if lost_report.last_seen_date and found_report.date_found:
        days_diff = (found_report.date_found - lost_report.last_seen_date).days
        if 0 <= days_diff <= 30:
            score += 10
            reasons.append(f"Found {days_diff} days after being lost")
        elif 31 <= days_diff <= 60:
            score += 5
            reasons.append(f"Found {days_diff} days after being lost")

    return score, reasons


def find_matches_for_lost_report(lost_report, min_score=50.0):
    """Find potential found reports matching a lost report."""
    found_reports = FoundPetReport.objects.filter(
        pet_type=lost_report.pet.pet_type if lost_report.pet else None,
        status='active'
    ).exclude(matches__lost_report=lost_report)
    
    # Exclude found reports by the lost report owner (prevent self-matching)
    found_reports = found_reports.exclude(reporter=lost_report.owner)

    matches = []
    for found_report in found_reports:
        score, reasons = calculate_match_score(lost_report, found_report)
        if score >= min_score:
            matches.append({
                'found_report': found_report,
                'score': score,
                'reasons': reasons
            })
    matches.sort(key=lambda x: x['score'], reverse=True)
    return matches


def find_matches_for_found_report(found_report, min_score=50.0):
    """Find potential lost reports matching a found report."""
    lost_reports = LostPetReport.objects.filter(
        pet__pet_type=found_report.pet_type,
        status='active'
    ).select_related('pet').exclude(matches__found_report=found_report)
    
    # Exclude lost reports owned by the found report reporter (prevent self-matching)
    lost_reports = lost_reports.exclude(owner=found_report.reporter)

    matches = []
    for lost_report in lost_reports:
        score, reasons = calculate_match_score(lost_report, found_report)
        if score >= min_score:
            matches.append({
                'lost_report': lost_report,
                'score': score,
                'reasons': reasons
            })
    matches.sort(key=lambda x: x['score'], reverse=True)
    return matches


def create_match(lost_report, found_report, min_score=50.0):
    """Create a Match if score >= min_score. Returns Match or None."""
    score, reasons = calculate_match_score(lost_report, found_report)
    if score < min_score:
        return None

    match, created = Match.objects.get_or_create(
        lost_report=lost_report,
        found_report=found_report,
        defaults={
            'match_score': score,
            'match_reasons': '; '.join(reasons),
            'status': 'pending_confirmation',
        }
    )
    if not created:
        match.match_score = score
        match.match_reasons = '; '.join(reasons)
        match.save()
    return match
