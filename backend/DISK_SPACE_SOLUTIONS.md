# Disk Space Solutions

## 🚨 CRITICAL: Your C: drive is FULL (0 GB free)

The error `OSError: [Errno 28] No space left on device` means your entire C: drive is full, not just the project folder.

## Immediate Solutions

### 1. **Free Up Windows Disk Space** (Most Important)

Run Windows Disk Cleanup:
1. Press `Win + R`, type `cleanmgr`, press Enter
2. Select C: drive
3. Check all boxes (especially "Temporary files", "Recycle Bin", "Downloads")
4. Click "Clean up system files" for more options
5. Delete old Windows Update files

### 2. **Check Large Files/Folders**

Use Windows Storage Settings:
1. Settings → System → Storage
2. Click "Temporary files" → Remove
3. Check "Downloads" folder for large files
4. Check "AppData\Local\Temp" folder

### 3. **Clean Up Project Images** (Optional - only frees ~1.4 GB)

```bash
cd backend
python manage.py cleanup_old_images --days=90
```

To see what would be deleted first:
```bash
python manage.py cleanup_old_images --days=90 --dry-run
```

### 4. **Move Project to Another Drive** (Recommended)

If you have another drive (D:, E:, etc.):

1. Copy entire project folder to new drive
2. Update paths if needed
3. Free up space on C: drive

### 5. **Uninstall Unused Programs**

Settings → Apps → Sort by size → Uninstall large unused programs

## Project-Specific Cleanup

Your project only uses ~1.5 GB:
- Media folder: 1.40 GB
- Venv: 0.06 GB  
- Database: 0.51 MB

**The problem is NOT your project - it's your C: drive being full.**

## Prevention

1. Move media files to cloud storage (S3, Azure Blob, etc.)
2. Set up automatic cleanup of old resolved reports
3. Use image compression for uploads
4. Consider moving project to a different drive

## Quick Check Commands

```bash
# Check disk space
python -c "import shutil; total, used, free = shutil.disk_usage('C:/'); print(f'Free: {free // (1024**3)} GB')"

# Check project size
cd backend
python cleanup_disk.py
```
