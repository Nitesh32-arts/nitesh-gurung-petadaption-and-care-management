# Generated for eSewa ePay with HMAC / initiate API

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('store', '0002_order_transaction_reference'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='transaction_uuid',
            field=models.CharField(blank=True, help_text='Unique id for eSewa signed flow (initiate API)', max_length=64, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='order',
            name='paid_at',
            field=models.DateTimeField(blank=True, help_text='When payment was confirmed (eSewa verify)', null=True),
        ),
    ]
