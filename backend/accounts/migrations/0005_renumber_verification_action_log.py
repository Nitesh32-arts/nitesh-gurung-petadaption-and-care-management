# Generated for renumbering VerificationActionLog so single remaining log shows id=1

from django.db import migrations, connection


def renumber_verification_action_log(apps, schema_editor):
    """Renumber VerificationActionLog so the remaining log has id=1 and sequence resets."""
    VerificationActionLog = apps.get_model('accounts', 'VerificationActionLog')
    count = VerificationActionLog.objects.count()
    if count != 1:
        return  # Only renumber when exactly 1 log exists

    log = VerificationActionLog.objects.first()
    if log.id == 1:
        return  # Already id=1

    old_id = log.id
    table = 'accounts_verificationactionlog'

    with connection.cursor() as cursor:
        vendor = connection.vendor
        if vendor == 'sqlite':
            # SQLite: update id, then fix sqlite_sequence
            cursor.execute(f'UPDATE {table} SET id = 1 WHERE id = %s', [old_id])
            cursor.execute("DELETE FROM sqlite_sequence WHERE name = %s", [table])
            cursor.execute("INSERT INTO sqlite_sequence (name, seq) VALUES (%s, 1)", [table])
        elif vendor == 'postgresql':
            cursor.execute(f'UPDATE {table} SET id = 1 WHERE id = %s', [old_id])
            cursor.execute(
                "SELECT setval(pg_get_serial_sequence(%s, 'id'), 1)",
                [table]
            )
        elif vendor == 'mysql':
            cursor.execute(f'UPDATE {table} SET id = 1 WHERE id = %s', [old_id])
            cursor.execute(f'ALTER TABLE {table} AUTO_INCREMENT = 2')


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_verification_fields_and_audit'),
    ]

    operations = [
        migrations.RunPython(renumber_verification_action_log, noop),
    ]
