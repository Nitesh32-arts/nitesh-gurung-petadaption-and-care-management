from rest_framework import serializers
from .models import Pet, PetImage, AdoptionRequest, SavedPet, Message, RewardPoint
from accounts.serializers import UserSerializer


class PetImageSerializer(serializers.ModelSerializer):
    """
    Serializer for PetImage model
    """
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = PetImage
        fields = ['id', 'image', 'image_url', 'is_primary', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def get_image_url(self, obj):
        """Return full URL for the image"""
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class PetSerializer(serializers.ModelSerializer):
    """
    Serializer for Pet model with nested images
    """
    images = PetImageSerializer(many=True, read_only=True)
    shelter_info = serializers.SerializerMethodField()
    primary_image = serializers.SerializerMethodField()
    
    class Meta:
        model = Pet
        fields = [
            'id', 'name', 'pet_type', 'breed', 'age', 'gender',
            'health_status', 'description', 'location', 'shelter',
            'shelter_info', 'status', 'images', 'primary_image',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'shelter', 'created_at', 'updated_at']
    
    def get_shelter_info(self, obj):
        """Return basic shelter information"""
        return {
            'id': obj.shelter.id,
            'username': obj.shelter.username,
            'email': obj.shelter.email,
        }
    
    def get_primary_image(self, obj):
        """Return the primary image URL if available"""
        primary_image = obj.images.filter(is_primary=True).first()
        if primary_image:
            request = self.context.get('request')
            if request and primary_image.image:
                return request.build_absolute_uri(primary_image.image.url)
            return primary_image.image.url if primary_image.image else None
        
        # If no primary image, return first image
        first_image = obj.images.first()
        if first_image:
            request = self.context.get('request')
            if request and first_image.image:
                return request.build_absolute_uri(first_image.image.url)
            return first_image.image.url if first_image.image else None
        
        return None


class PetCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating pets (without images)
    """
    class Meta:
        model = Pet
        fields = [
            'name', 'pet_type', 'breed', 'age', 'gender',
            'health_status', 'description', 'location', 'status'
        ]
    
    # Note: We don't set shelter here - perform_create in the view handles it
    # This prevents conflicts and ensures proper permission checking


class PetImageCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for uploading pet images
    """
    class Meta:
        model = PetImage
        fields = ['image', 'is_primary']
    
    def validate(self, attrs):
        """Validate that pet belongs to the current user (shelter)"""
        pet = self.context['pet']
        request = self.context['request']
        
        if pet.shelter != request.user:
            raise serializers.ValidationError(
                "You can only add images to pets that belong to your shelter."
            )
        return attrs
    
    def create(self, validated_data):
        """Create image and handle primary image logic"""
        pet = self.context['pet']
        is_primary = validated_data.get('is_primary', False)
        
        # If setting as primary, unset other primary images
        if is_primary:
            PetImage.objects.filter(pet=pet, is_primary=True).update(is_primary=False)
        
        validated_data['pet'] = pet
        return super().create(validated_data)


class AdoptionRequestSerializer(serializers.ModelSerializer):
    """
    Serializer for AdoptionRequest model.
    Exposes adopter as { id, name, email } for shelter visibility (no sensitive fields).
    """
    pet = PetSerializer(read_only=True)
    # pet_id is used for input, pet is set in validate() method
    pet_id = serializers.IntegerField(write_only=True, required=False)
    adopter = serializers.SerializerMethodField()
    adopter_info = serializers.SerializerMethodField()
    shelter_info = serializers.SerializerMethodField()
    created_at = serializers.SerializerMethodField()
    
    class Meta:
        model = AdoptionRequest
        fields = [
            'id', 'pet', 'pet_id', 'adopter', 'adopter_info',
            'shelter', 'shelter_info', 'status', 'notes',
            'request_date', 'created_at', 'reviewed_date', 'adopted_date', 'reviewed_by'
        ]
        read_only_fields = ['id', 'shelter', 'status', 'request_date', 'reviewed_date', 'adopted_date', 'reviewed_by']
        # Note: 'pet' is read_only for display but we set it in validate() for create()
    
    def to_internal_value(self, data):
        """Handle 'pet' field as ID before validation"""
        # Convert 'pet' (as ID) to 'pet_id' if present
        if isinstance(data, dict):
            data = data.copy()  # Make a copy to avoid mutating the original
            if 'pet' in data and 'pet_id' not in data:
                # Convert pet ID to pet_id
                pet_value = data.pop('pet')
                if pet_value is not None:
                    data['pet_id'] = pet_value
        return super().to_internal_value(data)
    
    def validate(self, attrs):
        """Validate pet_id field and ensure pet exists"""
        if 'pet_id' not in attrs:
            raise serializers.ValidationError({'pet': 'Pet ID is required.'})
        
        # Get the pet instance and add it to validated_data
        pet_id = attrs['pet_id']
        from .models import Pet
        try:
            pet = Pet.objects.get(pk=pet_id)
            # Add pet instance to validated_data
            # Even though pet is read_only, we can set it here for create()
            attrs['pet'] = pet
        except Pet.DoesNotExist:
            raise serializers.ValidationError({'pet': 'Pet with this ID does not exist.'})
        
        return attrs
    
    def create(self, validated_data):
        """Create adoption request with pet from validated_data"""
        # Get pet_id (should be in validated_data from validate())
        pet_id = validated_data.pop('pet_id', None)
        pet = validated_data.pop('pet', None)
        
        # If pet wasn't in validated_data (DRF excludes read_only fields), get it from pet_id
        if not pet and pet_id:
            from .models import Pet
            try:
                pet = Pet.objects.get(pk=pet_id)
            except Pet.DoesNotExist:
                raise serializers.ValidationError({'pet': 'Pet with this ID does not exist.'})
        
        if not pet:
            raise serializers.ValidationError({'pet': 'Pet is required.'})
        
        # Validate pet is available
        if pet.status != 'available':
            raise serializers.ValidationError({
                'pet': f'This pet is not available for adoption. Current status: {pet.status}'
            })
        
        # Check for duplicate pending request
        adopter = validated_data.get('adopter')
        if adopter:
            from .models import AdoptionRequest
            existing_request = AdoptionRequest.objects.filter(
                pet=pet,
                adopter=adopter,
                status='pending'
            ).first()
            
            if existing_request:
                raise serializers.ValidationError({
                    'pet': 'You already have a pending adoption request for this pet.'
                })
        
        # Set pet and shelter for model creation
        validated_data['pet'] = pet
        validated_data['shelter'] = pet.shelter
        validated_data['status'] = 'pending'
        
        # Call parent create which will use the pet instance
        return super().create(validated_data)
    
    def get_adopter(self, obj):
        """Adopter details for API: id, name, email (no sensitive fields)."""
        u = obj.adopter
        name = (f'{u.first_name or ""} {u.last_name or ""}'.strip()) or u.username
        return {
            'id': u.id,
            'name': name,
            'email': u.email or '',
        }
    
    def get_adopter_info(self, obj):
        """Return basic adopter information (kept for backward compatibility)."""
        return {
            'id': obj.adopter.id,
            'username': obj.adopter.username,
            'email': obj.adopter.email,
            'first_name': obj.adopter.first_name,
            'last_name': obj.adopter.last_name,
        }
    
    def get_created_at(self, obj):
        """Alias for request_date to match API spec."""
        return obj.request_date
    
    def get_shelter_info(self, obj):
        """Return basic shelter information"""
        return {
            'id': obj.shelter.id,
            'username': obj.shelter.username,
            'email': obj.shelter.email,
        }


class SavedPetSerializer(serializers.ModelSerializer):
    """
    Serializer for SavedPet model
    """
    pet = PetSerializer(read_only=True)
    pet_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = SavedPet
        fields = ['id', 'user', 'pet', 'pet_id', 'saved_at']
        read_only_fields = ['id', 'user', 'saved_at']


class MessageSerializer(serializers.ModelSerializer):
    """
    Serializer for Message model. Body or attachment required on create.
    When is_deleted=True, body is returned as null (do not expose original content).
    """
    sender_info = serializers.SerializerMethodField()
    recipient_info = serializers.SerializerMethodField()
    related_pet_info = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'sender', 'sender_info', 'recipient', 'recipient_info',
            'subject', 'body', 'attachment', 'attachment_name', 'attachment_url',
            'is_read', 'is_deleted', 'deleted_at',
            'created_at', 'related_pet', 'related_pet_info'
        ]
        read_only_fields = ['id', 'sender', 'created_at', 'is_deleted', 'deleted_at', 'attachment_url']
        extra_kwargs = {
            'subject': {'required': False, 'default': 'Message'},
            'body': {'required': False, 'allow_blank': True},
            'attachment': {'required': False, 'write_only': True},
            'attachment_name': {'required': False, 'allow_blank': True},
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.is_deleted:
            data['body'] = None
            data['attachment'] = None
            data['attachment_name'] = None
            data['attachment_url'] = None
        return data

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.attachment.url)
        return obj.attachment.url

    def validate(self, attrs):
        body = (attrs.get('body') or '').strip()
        attachment = attrs.get('attachment')
        if not body and not attachment:
            raise serializers.ValidationError({'body': 'Message must have text or a document attachment.'})
        if body:
            attrs['body'] = body
        return attrs
    
    def get_sender_info(self, obj):
        """Return basic sender information"""
        return {
            'id': obj.sender.id,
            'username': obj.sender.username,
            'email': obj.sender.email,
            'first_name': obj.sender.first_name,
            'last_name': obj.sender.last_name,
        }
    
    def get_recipient_info(self, obj):
        """Return basic recipient information"""
        return {
            'id': obj.recipient.id,
            'username': obj.recipient.username,
            'email': obj.recipient.email,
        }
    
    def get_related_pet_info(self, obj):
        """Return basic pet information if related"""
        if obj.related_pet:
            # Use the PetSerializer's primary_image method if available
            pet_serializer = PetSerializer(obj.related_pet, context=self.context)
            return {
                'id': obj.related_pet.id,
                'name': obj.related_pet.name,
                'primary_image': pet_serializer.get_primary_image(obj.related_pet),
            }
        return None


class RewardPointSerializer(serializers.ModelSerializer):
    """
    Serializer for RewardPoint model
    """
    class Meta:
        model = RewardPoint
        fields = ['id', 'user', 'points', 'source', 'description', 'created_at', 'related_pet']
        read_only_fields = ['id', 'user', 'created_at']

