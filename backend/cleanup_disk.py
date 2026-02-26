"""
Disk cleanup script to free up space.
Run: python cleanup_disk.py
"""
import os
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).parent

def get_folder_size(path):
    """Get total size of folder in GB"""
    if not path.exists():
        return 0
    total = sum(f.stat().st_size for f in path.rglob('*') if f.is_file())
    return total / (1024**3)

def cleanup_pycache():
    """Remove all __pycache__ folders"""
    print("Cleaning up __pycache__ folders...")
    removed = 0
    total_size = 0
    for pycache in BASE_DIR.rglob('__pycache__'):
        if pycache.is_dir():
            size = sum(f.stat().st_size for f in pycache.rglob('*') if f.is_file())
            total_size += size
            shutil.rmtree(pycache)
            removed += 1
    print(f"[OK] Removed {removed} __pycache__ folders ({total_size / (1024**2):.2f} MB)")

def cleanup_python_cache():
    """Remove .pyc files"""
    print("Cleaning up .pyc files...")
    removed = 0
    total_size = 0
    for pyc_file in BASE_DIR.rglob('*.pyc'):
        size = pyc_file.stat().st_size
        total_size += size
        pyc_file.unlink()
        removed += 1
    print(f"[OK] Removed {total_size / (1024**2):.2f} MB of .pyc files")

def show_disk_usage():
    """Show disk usage breakdown"""
    print("\n=== Disk Usage Breakdown ===")
    
    # Check media folder
    media_path = BASE_DIR / 'media'
    if media_path.exists():
        media_size = get_folder_size(media_path)
        print(f"Media folder: {media_size:.2f} GB")
        
        # Check subfolders
        for subfolder in ['lost_found_images', 'pet_images', 'medical_documents']:
            subpath = media_path / subfolder
            if subpath.exists():
                size = get_folder_size(subpath)
                print(f"  - {subfolder}: {size:.2f} GB")
    
    # Check Venv
    venv_path = BASE_DIR / 'Venv'
    if venv_path.exists():
        venv_size = get_folder_size(venv_path)
        print(f"Venv folder: {venv_size:.2f} GB")
    
    # Check staticfiles
    static_path = BASE_DIR / 'staticfiles'
    if static_path.exists():
        static_size = get_folder_size(static_path)
        print(f"Staticfiles: {static_size:.2f} GB")
    
    # Check database
    db_path = BASE_DIR / 'db.sqlite3'
    if db_path.exists():
        db_size = db_path.stat().st_size / (1024**2)
        print(f"Database: {db_size:.2f} MB")
    
    # Check migrations
    migrations_size = 0
    for app in ['accounts', 'pets', 'veterinary', 'lost_found', 'dashboard']:
        migrations_path = BASE_DIR / app / 'migrations'
        if migrations_path.exists():
            migrations_size += get_folder_size(migrations_path)
    if migrations_size > 0:
        print(f"Migrations: {migrations_size:.2f} MB")

def cleanup_old_resolved_images():
    """Clean up images from resolved reports older than 90 days"""
    print("\nCleaning up old resolved report images...")
    try:
        import django
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
        django.setup()
        
        from django.utils import timezone
        from datetime import timedelta
        from lost_found.models import LostPetReport, FoundPetReport, LostFoundImage
        
        cutoff_date = timezone.now() - timedelta(days=90)
        
        # Find resolved reports older than 90 days
        old_lost = LostPetReport.objects.filter(
            status='resolved',
            resolved_at__lt=cutoff_date
        )
        old_found = FoundPetReport.objects.filter(
            status='resolved',
            resolved_at__lt=cutoff_date
        )
        
        removed_count = 0
        total_size = 0
        
        # Remove images from old resolved lost reports
        for report in old_lost:
            for img in report.images.all():
                if img.image:
                    try:
                        size = img.image.size if hasattr(img.image, 'size') else 0
                        img.image.delete(save=False)
                        total_size += size
                        removed_count += 1
                    except:
                        pass
        
        # Remove images from old resolved found reports
        for report in old_found:
            for img in report.images.all():
                if img.image:
                    try:
                        size = img.image.size if hasattr(img.image, 'size') else 0
                        img.image.delete(save=False)
                        total_size += size
                        removed_count += 1
                    except:
                        pass
        
        print(f"[OK] Removed {removed_count} images from old resolved reports ({total_size / (1024**2):.2f} MB)")
        
    except Exception as e:
        print(f"⚠ Could not clean up old images: {e}")

if __name__ == '__main__':
    print("=== Disk Cleanup Script ===\n")
    
    # Show current usage
    show_disk_usage()
    
    # Cleanup operations
    print("\n=== Starting Cleanup ===\n")
    
    cleanup_pycache()
    cleanup_python_cache()
    
    # Ask before cleaning old images
    print("\n=== Cleanup Complete ===")
    print("\nTo clean up old resolved report images (90+ days old), run:")
    print("  python manage.py shell")
    print("  >>> from cleanup_disk import cleanup_old_resolved_images")
    print("  >>> cleanup_old_resolved_images()")
    
    # Show final usage
    print("\n=== Final Disk Usage ===")
    show_disk_usage()
