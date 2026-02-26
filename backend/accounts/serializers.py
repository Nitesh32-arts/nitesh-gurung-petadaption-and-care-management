from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model

User = get_user_model()


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration (signup)
    """
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'},
        help_text='Password must be at least 8 characters'
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        help_text='Enter the same password as before, for verification'
    )
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'role', 'phone_number', 'address'
        ]
        extra_kwargs = {
            'email': {'required': True},
            'username': {'required': True},
            'first_name': {'required': False},
            'last_name': {'required': False},
            'role': {'required': False},
        }
    
    def validate_email(self, value):
        """Validate that email is unique"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "A user with this email already exists."
            )
        return value.lower()
    
    def validate_username(self, value):
        """Validate that username is unique"""
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError(
                "A user with this username already exists."
            )
        return value
    
    def validate(self, attrs):
        """Validate that passwords match"""
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                "password_confirm": "Password fields didn't match."
            })
        return attrs
    
    def create(self, validated_data):
        """Create a new user"""
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User.objects.create_user(
            password=password,
            **validated_data
        )
        return user


class UserLoginSerializer(serializers.Serializer):
    """
    Serializer for user login. Accepts username or emailOrUsername (frontend may send either).
    """
    username = serializers.CharField(required=False, allow_blank=True, help_text='Username or email')
    emailOrUsername = serializers.CharField(required=False, allow_blank=True, help_text='Username or email (alias)')
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'},
        help_text='User password'
    )

    def to_internal_value(self, data):
        """Accept both 'username' and 'emailOrUsername'; normalize to username and strip whitespace."""
        raw_username = data.get('username') or data.get('emailOrUsername') or ''
        raw_password = data.get('password') or ''
        username = (raw_username or '').strip()
        password = (raw_password or '').strip()
        if not username:
            raise serializers.ValidationError({'username': 'This field may not be blank.'})
        if not password:
            raise serializers.ValidationError({'password': 'This field may not be blank.'})
        return {'username': username, 'password': password}
    
    def validate(self, attrs):
        """Validate user credentials"""
        username = attrs.get('username')
        password = attrs.get('password')
        
        if not username or not password:
            raise serializers.ValidationError(
                'Must include "username" and "password".'
            )
        
        # Try to authenticate with username or email
        user = None
        if '@' in username:
            try:
                user_obj = User.objects.get(email=username)
                user = authenticate(
                    request=self.context.get('request'),
                    username=user_obj.username,
                    password=password
                )
            except User.DoesNotExist:
                pass
        else:
            user = authenticate(
                request=self.context.get('request'),
                username=username,
                password=password
            )
        
        if not user:
            raise serializers.ValidationError(
                'Unable to log in with provided credentials.'
            )
        
        if not user.is_active:
            raise serializers.ValidationError(
                'User account is disabled.'
            )
        
        attrs['user'] = user
        return attrs


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for user profile (includes verification status for Vet/Shelter).
    """
    is_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'phone_number', 'address', 'profile_picture',
            'verification_status', 'verification_submitted_at', 'verified_at',
            'rejection_reason', 'is_verified',
            'created_at', 'updated_at', 'is_active', 'date_joined'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'is_active', 'date_joined',
            'verification_status', 'verification_submitted_at', 'verified_at',
            'rejection_reason', 'is_verified',
        ]
        extra_kwargs = {
            'email': {'required': False},
            'username': {'read_only': True},
        }
    
    def validate_email(self, value):
        """Validate email uniqueness if being updated"""
        if value:
            user = self.instance
            if user and User.objects.filter(email=value).exclude(id=user.id).exists():
                raise serializers.ValidationError(
                    "A user with this email already exists."
                )
            return value.lower()
        return value


class RoleBasedProfileSerializer(serializers.ModelSerializer):
    """
    Role-based profile: different fields per role, read-only sections for
    adoption_history, reward_points, managed_pets, assigned_pets, verification.
    """
    adoption_history = serializers.SerializerMethodField(read_only=True)
    reward_points = serializers.SerializerMethodField(read_only=True)
    managed_pets_count = serializers.SerializerMethodField(read_only=True)
    assigned_pets_count = serializers.SerializerMethodField(read_only=True)
    profile_picture_url = serializers.SerializerMethodField(read_only=True)
    is_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'role',
            'phone_number', 'address', 'profile_picture', 'profile_picture_url',
            'shelter_name', 'registration_number', 'shelter_description',
            'clinic_name', 'license_number', 'specialization',
            'verification_status', 'verification_submitted_at', 'verified_at', 'rejection_reason', 'is_verified',
            'adoption_history', 'reward_points', 'managed_pets_count', 'assigned_pets_count',
            'created_at', 'updated_at', 'date_joined',
        ]
        read_only_fields = [
            'id', 'username', 'role', 'created_at', 'updated_at', 'date_joined',
            'adoption_history', 'reward_points', 'managed_pets_count', 'assigned_pets_count',
            'profile_picture_url',
            'verification_status', 'verification_submitted_at', 'verified_at', 'rejection_reason', 'is_verified',
        ]

    def get_profile_picture_url(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None

    def get_adoption_history(self, obj):
        if getattr(obj, 'role', None) != 'adopter':
            return None
        from pets.models import AdoptionRequest
        qs = AdoptionRequest.objects.filter(adopter=obj, status__in=('approved', 'adopted')).select_related('pet').order_by('-reviewed_date', '-request_date')[:20]
        return [{'id': ar.id, 'pet_name': ar.pet.name if ar.pet else None, 'reviewed_date': ar.reviewed_date.isoformat() if ar.reviewed_date else None} for ar in qs]

    def get_reward_points(self, obj):
        if getattr(obj, 'role', None) != 'adopter':
            return None
        from pets.models import RewardPoint
        from django.db.models import Sum
        total = RewardPoint.objects.filter(user=obj).aggregate(s=Sum('points'))['s'] or 0
        return total

    def get_managed_pets_count(self, obj):
        if getattr(obj, 'role', None) != 'shelter':
            return None
        from pets.models import Pet
        return Pet.objects.filter(shelter=obj).count()

    def get_assigned_pets_count(self, obj):
        if getattr(obj, 'role', None) != 'veterinarian':
            return None
        from veterinary.models import MedicalRecord
        return MedicalRecord.objects.filter(veterinarian=obj).values('pet').distinct().count()

    def get_fields(self):
        fields = super().get_fields()
        user = self.instance
        request = self.context.get('request')
        if not request or not user:
            return fields
        role = getattr(user, 'role', None)
        # Admin: all read-only
        if role == 'admin' or getattr(user, 'is_superuser', False):
            for f in fields.values():
                f.read_only = True
            return fields
        # Restrict writable fields by role
        writable = set()
        if role == 'adopter':
            writable = {'first_name', 'last_name', 'phone_number', 'address', 'profile_picture'}
            fields['email'].read_only = True
        elif role == 'shelter':
            writable = {'shelter_name', 'registration_number', 'phone_number', 'address', 'shelter_description', 'profile_picture', 'first_name', 'last_name'}
            fields['email'].read_only = True
        elif role == 'veterinarian':
            writable = {'first_name', 'last_name', 'clinic_name', 'license_number', 'specialization', 'phone_number', 'address', 'profile_picture'}
            fields['email'].read_only = True
        for name, field in fields.items():
            if name not in writable and name not in self.Meta.read_only_fields:
                field.read_only = True
        return fields

    def validate_email(self, value):
        if value and self.instance:
            if User.objects.filter(email=value).exclude(id=self.instance.id).exists():
                raise serializers.ValidationError("A user with this email already exists.")
            return value.lower()
        return value


# Allowed verification document types and max size (10MB)
VERIFICATION_ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png'}
VERIFICATION_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def _validate_verification_file(file, field_name):
    if not file:
        return
    if not getattr(file, 'size', 0) or file.size <= 0:
        raise serializers.ValidationError(
            {field_name: "File must not be empty."}
        )
    if file.size > VERIFICATION_MAX_FILE_SIZE:
        raise serializers.ValidationError(
            {field_name: f"File size must not exceed {VERIFICATION_MAX_FILE_SIZE // (1024*1024)}MB."}
        )
    ext = (file.name or "").split(".")[-1].lower()
    if ext not in VERIFICATION_ALLOWED_EXTENSIONS:
        raise serializers.ValidationError(
            {field_name: f"Allowed types: {', '.join(VERIFICATION_ALLOWED_EXTENSIONS)}."}
        )


class VerificationSubmitSerializer(serializers.Serializer):
    """Submit verification documents. Fields depend on role (veterinarian vs shelter)."""
    license_document = serializers.FileField(required=False, allow_null=True)
    certification_document = serializers.FileField(required=False, allow_null=True)
    registration_certificate = serializers.FileField(required=False, allow_null=True)
    organization_document = serializers.FileField(required=False, allow_null=True)

    def validate(self, attrs):
        user = self.context.get("request").user
        role = getattr(user, "role", None)
        if role == "veterinarian":
            if not attrs.get("license_document") or not attrs.get("certification_document"):
                raise serializers.ValidationError(
                    "Veterinarian must upload both license_document and certification_document."
                )
            _validate_verification_file(attrs["license_document"], "license_document")
            _validate_verification_file(attrs["certification_document"], "certification_document")
        elif role == "shelter":
            if not attrs.get("registration_certificate") or not attrs.get("organization_document"):
                raise serializers.ValidationError(
                    "Shelter must upload both registration_certificate and organization_document."
                )
            _validate_verification_file(attrs["registration_certificate"], "registration_certificate")
            _validate_verification_file(attrs["organization_document"], "organization_document")
        else:
            raise serializers.ValidationError("Only Veterinarian or Shelter can submit verification.")
        return attrs


class VerificationStatusSerializer(serializers.ModelSerializer):
    """Minimal serializer for current user verification status."""
    is_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            "verification_status",
            "verification_submitted_at",
            "verified_at",
            "rejection_reason",
            "is_verified",
        ]


class VerificationListSerializer(serializers.ModelSerializer):
    """Admin list: name, email, role, submission date. No document URLs in list."""
    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name", "role",
            "verification_status", "verification_submitted_at", "verified_at", "rejection_reason",
        ]
        read_only_fields = fields
