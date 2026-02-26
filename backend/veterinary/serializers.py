from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers
from .models import MedicalRecord, Vaccination, Treatment, HealthReminder, Notification
from pets.serializers import PetSerializer
from pets.models import Pet
from accounts.serializers import UserSerializer


class VaccinationSerializer(serializers.ModelSerializer):
    """
    Serializer for Vaccination model
    """
    class Meta:
        model = Vaccination
        fields = [
            'id', 'vaccine_type', 'vaccine_name', 'batch_number',
            'administered_date', 'next_due_date', 'is_booster', 'notes'
        ]
        read_only_fields = ['id']


class TreatmentSerializer(serializers.ModelSerializer):
    """
    Serializer for Treatment model
    """
    class Meta:
        model = Treatment
        fields = [
            'id', 'treatment_type', 'treatment_name', 'dosage',
            'frequency', 'start_date', 'end_date', 'instructions'
        ]
        read_only_fields = ['id']


class MedicalRecordSerializer(serializers.ModelSerializer):
    """
    Serializer for MedicalRecord model with nested vaccinations and treatments.
    vaccination is optional (OneToOne may not exist).
    """
    vaccination = serializers.SerializerMethodField()
    treatments = TreatmentSerializer(many=True, read_only=True)
    pet_info = serializers.SerializerMethodField()
    veterinarian_info = serializers.SerializerMethodField()
    document_url = serializers.SerializerMethodField()
    
    class Meta:
        model = MedicalRecord
        fields = [
            'id', 'pet', 'pet_info', 'veterinarian', 'veterinarian_info',
            'record_type', 'title', 'description', 'date', 'next_due_date',
            'cost', 'documents', 'document_url', 'vaccination', 'treatments',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_vaccination(self, obj):
        """Safely return vaccination data or None (OneToOne may not exist)"""
        try:
            vacc = obj.vaccination
            return VaccinationSerializer(vacc).data
        except ObjectDoesNotExist:
            return None
    
    def get_pet_info(self, obj):
        """Return basic pet information"""
        return {
            'id': obj.pet.id,
            'name': obj.pet.name,
            'pet_type': obj.pet.pet_type,
            'breed': obj.pet.breed,
        }
    
    def get_veterinarian_info(self, obj):
        """Return basic veterinarian information"""
        if obj.veterinarian:
            return {
                'id': obj.veterinarian.id,
                'username': obj.veterinarian.username,
                'email': obj.veterinarian.email,
            }
        return None
    
    def get_document_url(self, obj):
        """Return full URL for the document"""
        if obj.documents:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.documents.url)
            return obj.documents.url
        return None


class MedicalRecordListSerializer(serializers.ModelSerializer):
    """
    Slim serializer for dashboard lists - omits vaccinations, treatments, full descriptions.
    """
    pet_info = serializers.SerializerMethodField()

    class Meta:
        model = MedicalRecord
        fields = ['id', 'pet', 'pet_info', 'record_type', 'title', 'date', 'next_due_date', 'created_at']

    def get_pet_info(self, obj):
        return {'id': obj.pet.id, 'name': obj.pet.name, 'pet_type': obj.pet.pet_type}


class MedicalRecordCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating medical records.
    veterinarian is read-only and auto-assigned from request.user.
    """
    pet = serializers.PrimaryKeyRelatedField(
        queryset=Pet.objects.all(),
        required=True,
        write_only=False,
        help_text='Pet ID - required. Vet is auto-assigned from the authenticated user.'
    )
    vaccination_data = VaccinationSerializer(required=False, write_only=True)
    treatments_data = TreatmentSerializer(many=True, required=False, write_only=True)
    
    class Meta:
        model = MedicalRecord
        fields = [
            'pet', 'record_type', 'title', 'description', 'date',
            'next_due_date', 'cost', 'documents', 'vaccination_data', 'treatments_data'
        ]
        extra_kwargs = {
            'title': {'required': True},
            'description': {'required': True},
            'date': {'required': True},
            'record_type': {'required': True},
        }
    
    def validate_pet(self, value):
        """Validate pet exists (handled by PrimaryKeyRelatedField)"""
        if value is None:
            raise serializers.ValidationError('Pet is required.')
        return value
    
    def validate(self, attrs):
        """Validate required fields and vaccination data when record_type is vaccination"""
        record_type = attrs.get('record_type', '')
        vaccination_data = attrs.get('vaccination_data')
        
        if record_type == 'vaccination' and vaccination_data:
            vax = vaccination_data
            if not vax.get('vaccine_name') or not vax.get('administered_date') or not vax.get('next_due_date'):
                raise serializers.ValidationError({
                    'vaccination_data': 'Vaccine name, administered date, and next due date are required for vaccination records.'
                })
        return attrs
    
    def to_internal_value(self, data):
        """Parse JSON strings from FormData if needed"""
        # Handle both dict (JSON) and QueryDict (FormData) inputs
        if hasattr(data, 'get'):
            data = data.copy() if hasattr(data, 'copy') else dict(data)
        
        # If vaccination_data is a string (from FormData), parse it
        if 'vaccination_data' in data and isinstance(data.get('vaccination_data'), str):
            try:
                import json
                data['vaccination_data'] = json.loads(data['vaccination_data'])
            except (json.JSONDecodeError, TypeError, ValueError):
                # If parsing fails, remove it so validation can handle it
                data.pop('vaccination_data', None)
        
        # If treatments_data is a string (from FormData), parse it
        if 'treatments_data' in data and isinstance(data.get('treatments_data'), str):
            try:
                import json
                data['treatments_data'] = json.loads(data['treatments_data'])
            except (json.JSONDecodeError, TypeError, ValueError):
                # If parsing fails, remove it so validation can handle it
                data.pop('treatments_data', None)
        
        return super().to_internal_value(data)
    
    def create(self, validated_data):
        """Create medical record with nested vaccination and treatments.
        Veterinarian is auto-assigned from request.user (never from request body)."""
        vaccination_data = validated_data.pop('vaccination_data', None)
        treatments_data = validated_data.pop('treatments_data', [])
        
        # veterinarian is read_only - always assign from authenticated user
        request = self.context.get('request')
        if not request or not request.user:
            raise serializers.ValidationError(
                {'detail': 'Authentication required to create medical records.'}
            )
        validated_data['veterinarian'] = request.user
        
        # Create medical record
        medical_record = MedicalRecord.objects.create(**validated_data)
        
        # Create vaccination if provided
        if vaccination_data:
            Vaccination.objects.create(
                medical_record=medical_record,
                **vaccination_data
            )
        
        # Create treatments if provided
        for treatment_data in treatments_data:
            Treatment.objects.create(
                medical_record=medical_record,
                **treatment_data
            )
        
        return medical_record


class HealthReminderSerializer(serializers.ModelSerializer):
    """
    Serializer for HealthReminder model
    """
    pet_info = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    is_due_soon = serializers.SerializerMethodField()
    
    class Meta:
        model = HealthReminder
        fields = [
            'id', 'pet', 'pet_info', 'medical_record', 'reminder_type',
            'title', 'description', 'due_date', 'reminder_date', 'status',
            'is_recurring', 'recurrence_interval', 'is_overdue', 'is_due_soon',
            'created_at', 'updated_at', 'sent_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'sent_at']
    
    def get_pet_info(self, obj):
        """Return basic pet information"""
        return {
            'id': obj.pet.id,
            'name': obj.pet.name,
            'pet_type': obj.pet.pet_type,
        }
    
    def get_is_overdue(self, obj):
        """Check if reminder is overdue"""
        return obj.is_overdue()
    
    def get_is_due_soon(self, obj):
        """Check if reminder is due soon"""
        return obj.is_due_soon()


class HealthReminderCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating health reminders
    """
    pet = serializers.PrimaryKeyRelatedField(
        queryset=Pet.objects.all(),
        required=False,
        allow_null=True,
        help_text='Pet (auto-set from medical_record if not provided)'
    )
    
    class Meta:
        model = HealthReminder
        fields = [
            'pet', 'medical_record', 'reminder_type', 'title', 'description',
            'due_date', 'reminder_date', 'is_recurring', 'recurrence_interval'
        ]
    
    def validate(self, attrs):
        """Validate reminder dates and auto-set pet from medical_record"""
        reminder_date = attrs.get('reminder_date')
        due_date = attrs.get('due_date')
        medical_record = attrs.get('medical_record')
        pet = attrs.get('pet')
        
        # Validate dates
        if reminder_date and due_date and reminder_date > due_date:
            raise serializers.ValidationError({
                'reminder_date': 'Reminder date cannot be after due date.'
            })
        
        # Auto-set pet from medical_record if pet is not provided
        if medical_record:
            if not pet:
                attrs['pet'] = medical_record.pet
            # Validate that pet matches medical_record's pet if both are provided
            elif pet != medical_record.pet:
                raise serializers.ValidationError({
                    'pet': 'Pet must match the pet in the selected medical record.'
                })
        elif not pet:
            # If no medical_record and no pet, this is an error
            raise serializers.ValidationError({
                'pet': 'Pet is required. Either provide pet directly or select a medical record with a pet.'
            })
        
        return attrs


class NotificationSerializer(serializers.ModelSerializer):
    """
    Serializer for Notification model
    """
    pet_info = serializers.SerializerMethodField()
    
    class Meta:
        model = Notification
        fields = [
            'id', 'user', 'pet', 'pet_info', 'health_reminder',
            'notification_type', 'title', 'message', 'is_read',
            'created_at', 'read_at'
        ]
        read_only_fields = ['id', 'created_at', 'read_at']
    
    def get_pet_info(self, obj):
        """Return basic pet information"""
        return {
            'id': obj.pet.id,
            'name': obj.pet.name,
            'pet_type': obj.pet.pet_type,
        }
