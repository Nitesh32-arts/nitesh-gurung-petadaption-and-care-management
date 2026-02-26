# Manual migration: Remove old lost_found schema and create new one per spec

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('pets', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('lost_found', '0001_initial'),
    ]

    operations = [
        migrations.DeleteModel(name='MatchNotification'),
        migrations.DeleteModel(name='Match'),
        migrations.DeleteModel(name='PetImage'),
        migrations.DeleteModel(name='FoundPetReport'),
        migrations.DeleteModel(name='LostPetReport'),
        migrations.CreateModel(
            name='LostPetReport',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('last_seen_location', models.CharField(help_text='Location where pet was last seen', max_length=200)),
                ('last_seen_date', models.DateField(help_text='Date when pet was last seen')),
                ('color', models.CharField(blank=True, help_text='Color/markings (optional, improves matching)', max_length=100, null=True)),
                ('size', models.CharField(blank=True, choices=[('small', 'Small'), ('medium', 'Medium'), ('large', 'Large')], help_text='Size (optional, improves matching)', max_length=20, null=True)),
                ('description', models.TextField(blank=True, help_text='Additional description')),
                ('status', models.CharField(choices=[('active', 'Active'), ('matched', 'Matched'), ('resolved', 'Resolved'), ('cancelled', 'Cancelled')], default='active', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('owner', models.ForeignKey(limit_choices_to={'role': 'adopter'}, on_delete=django.db.models.deletion.CASCADE, related_name='lost_pet_reports', to=settings.AUTH_USER_MODEL)),
                ('pet', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lost_pet_reports', to='pets.pet')),
            ],
            options={'ordering': ['-created_at'], 'verbose_name': 'Lost Pet Report', 'verbose_name_plural': 'Lost Pet Reports'},
        ),
        migrations.CreateModel(
            name='FoundPetReport',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('pet_type', models.CharField(choices=[('dog', 'Dog'), ('cat', 'Cat'), ('bird', 'Bird'), ('rabbit', 'Rabbit'), ('hamster', 'Hamster'), ('other', 'Other')], max_length=20)),
                ('breed', models.CharField(blank=True, max_length=100, null=True)),
                ('color', models.CharField(blank=True, max_length=100, null=True)),
                ('size', models.CharField(blank=True, choices=[('small', 'Small'), ('medium', 'Medium'), ('large', 'Large')], max_length=20, null=True)),
                ('description', models.TextField()),
                ('location_found', models.CharField(max_length=200)),
                ('date_found', models.DateField()),
                ('contact_phone', models.CharField(max_length=20)),
                ('contact_email', models.EmailField(max_length=254)),
                ('status', models.CharField(choices=[('active', 'Active'), ('matched', 'Matched'), ('resolved', 'Resolved'), ('cancelled', 'Cancelled')], default='active', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('reporter', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='found_pet_reports', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at'], 'verbose_name': 'Found Pet Report', 'verbose_name_plural': 'Found Pet Reports'},
        ),
        migrations.CreateModel(
            name='LostFoundImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image', models.ImageField(upload_to='lost_found_images/')),
                ('is_primary', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('found_report', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='images', to='lost_found.foundpetreport')),
                ('lost_report', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='images', to='lost_found.lostpetreport')),
            ],
            options={'ordering': ['-is_primary', 'created_at']},
        ),
        migrations.CreateModel(
            name='Match',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('match_score', models.FloatField()),
                ('match_reasons', models.TextField()),
                ('status', models.CharField(choices=[('pending_confirmation', 'Pending Confirmation'), ('confirmed', 'Confirmed'), ('rejected', 'Rejected'), ('resolved', 'Resolved')], default='pending_confirmation', max_length=30)),
                ('confirmed_by_lost_owner', models.BooleanField(default=False)),
                ('confirmed_by_finder', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('found_report', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='matches', to='lost_found.foundpetreport')),
                ('lost_report', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='matches', to='lost_found.lostpetreport')),
            ],
            options={'ordering': ['-match_score', '-created_at'], 'unique_together': (('lost_report', 'found_report'),)},
        ),
        migrations.CreateModel(
            name='MatchNotification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('notification_type', models.CharField(choices=[('match_found', 'Match Found'), ('match_confirmed', 'Match Confirmed'), ('match_rejected', 'Match Rejected')], max_length=30)),
                ('title', models.CharField(max_length=200)),
                ('message', models.TextField()),
                ('is_read', models.BooleanField(default=False)),
                ('read_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('match', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to='lost_found.match')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='match_notifications', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddIndex(model_name='lostpetreport', index=models.Index(fields=['pet', 'status'], name='lost_found_pet_id_status_idx')),
        migrations.AddIndex(model_name='lostpetreport', index=models.Index(fields=['owner', 'status'], name='lost_found_owner_id_status_idx')),
        migrations.AddIndex(model_name='foundpetreport', index=models.Index(fields=['pet_type', 'status'], name='lost_found_pet_type_status_idx')),
        migrations.AddIndex(model_name='foundpetreport', index=models.Index(fields=['location_found'], name='lost_found_location_idx')),
        migrations.AddIndex(model_name='match', index=models.Index(fields=['lost_report', 'status'], name='lost_found_lost_status_idx')),
        migrations.AddIndex(model_name='match', index=models.Index(fields=['found_report', 'status'], name='lost_found_found_status_idx')),
        migrations.AddIndex(model_name='matchnotification', index=models.Index(fields=['user', 'is_read'], name='lost_found_user_read_idx')),
    ]
