"""
Django management command to clean up old images from resolved reports.
Usage: python manage.py cleanup_old_images [--days=90] [--dry-run]
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from lost_found.models import LostPetReport, FoundPetReport


class Command(BaseCommand):
    help = 'Clean up images from resolved reports older than specified days'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=90,
            help='Delete images from reports resolved more than this many days ago (default: 90)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        days = options['days']
        dry_run = options['dry_run']
        cutoff_date = timezone.now() - timedelta(days=days)

        self.stdout.write(f'Finding resolved reports older than {days} days (resolved before {cutoff_date.date()})...')

        # Find old resolved reports
        old_lost = LostPetReport.objects.filter(
            status='resolved',
            resolved_at__lt=cutoff_date
        )
        old_found = FoundPetReport.objects.filter(
            status='resolved',
            resolved_at__lt=cutoff_date
        )

        lost_count = old_lost.count()
        found_count = old_found.count()

        self.stdout.write(f'Found {lost_count} old resolved lost reports')
        self.stdout.write(f'Found {found_count} old resolved found reports')

        if dry_run:
            self.stdout.write(self.style.WARNING('\nDRY RUN MODE - No files will be deleted\n'))

        total_images = 0
        total_size = 0

        # Process lost reports
        for report in old_lost:
            images = report.images.all()
            for img in images:
                if img.image:
                    try:
                        size = img.image.size if hasattr(img.image, 'size') else 0
                        total_size += size
                        total_images += 1
                        if not dry_run:
                            img.image.delete(save=False)
                            img.delete()
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f'Error deleting image {img.id}: {e}'))

        # Process found reports
        for report in old_found:
            images = report.images.all()
            for img in images:
                if img.image:
                    try:
                        size = img.image.size if hasattr(img.image, 'size') else 0
                        total_size += size
                        total_images += 1
                        if not dry_run:
                            img.image.delete(save=False)
                            img.delete()
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f'Error deleting image {img.id}: {e}'))

        if dry_run:
            self.stdout.write(f'\nWould delete {total_images} images ({total_size / (1024**2):.2f} MB)')
            self.stdout.write(self.style.WARNING('Run without --dry-run to actually delete'))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'\nSuccessfully deleted {total_images} images ({total_size / (1024**2):.2f} MB)'
            ))
