from rest_framework import serializers
from .models import LostPetReport, FoundPetReport, LostFoundImage, Match, MatchNotification


class LostFoundImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = LostFoundImage
        fields = ['id', 'image', 'image_url', 'is_primary', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


# ----- Lost Pet Report -----
class LostPetReportSerializer(serializers.ModelSerializer):
    pet_info = serializers.SerializerMethodField()
    owner_info = serializers.SerializerMethodField()
    images = LostFoundImageSerializer(many=True, read_only=True)
    primary_image = serializers.SerializerMethodField()

    class Meta:
        model = LostPetReport
        fields = [
            'id', 'pet', 'pet_info', 'owner', 'owner_info',
            'last_seen_location', 'last_seen_date', 'color', 'size', 'description',
            'status', 'images', 'primary_image',
            'created_at', 'updated_at', 'resolved_at',
        ]
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at', 'resolved_at']

    def get_pet_info(self, obj):
        if not obj.pet:
            return None
        p = obj.pet
        img = p.images.filter(is_primary=True).first() or p.images.first()
        img_url = None
        if img and img.image:
            req = self.context.get('request')
            img_url = req.build_absolute_uri(img.image.url) if req else img.image.url
        return {
            'id': p.id,
            'name': p.name,
            'pet_type': p.pet_type,
            'breed': p.breed,
            'primary_image_url': img_url,
        }

    def get_owner_info(self, obj):
        if not obj.owner:
            return None
        return {'id': obj.owner.id, 'username': obj.owner.username}

    def get_primary_image(self, obj):
        img = obj.images.filter(is_primary=True).first() or obj.images.first()
        if img and img.image:
            req = self.context.get('request')
            return req.build_absolute_uri(img.image.url) if req else img.image.url
        p = obj.pet
        if p:
            pi = p.images.filter(is_primary=True).first() or p.images.first()
            if pi and pi.image:
                req = self.context.get('request')
                return req.build_absolute_uri(pi.image.url) if req else pi.image.url
        return None


class LostPetReportCreateSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(required=False, write_only=True)

    class Meta:
        model = LostPetReport
        fields = ['pet', 'last_seen_location', 'last_seen_date', 'color', 'size', 'description', 'image']

    def validate_pet(self, value):
        user = self.context['request'].user
        from pets.models import AdoptionRequest
        if not AdoptionRequest.objects.filter(
            adopter=user, pet=value, status__in=('approved', 'adopted')
        ).exists():
            raise serializers.ValidationError('You can only report lost pets that you have adopted.')
        return value

    def create(self, validated_data):
        request = self.context['request']
        validated_data['owner'] = request.user
        image = validated_data.pop('image', None)
        for k in ('color', 'size'):
            if validated_data.get(k) == '':
                validated_data[k] = None
        report = LostPetReport.objects.create(**validated_data)
        if image:
            LostFoundImage.objects.create(lost_report=report, image=image, is_primary=True)
        return report


# ----- Found Pet Report -----
class FoundPetReportSerializer(serializers.ModelSerializer):
    reporter_info = serializers.SerializerMethodField()
    images = LostFoundImageSerializer(many=True, read_only=True)
    primary_image = serializers.SerializerMethodField()

    class Meta:
        model = FoundPetReport
        fields = [
            'id', 'reporter', 'reporter_info', 'pet_type', 'breed', 'color', 'size',
            'description', 'location_found', 'date_found',
            'contact_phone', 'contact_email',
            'status', 'images', 'primary_image',
            'created_at', 'updated_at', 'resolved_at',
        ]
        read_only_fields = ['id', 'reporter', 'created_at', 'updated_at', 'resolved_at']

    def get_reporter_info(self, obj):
        if not obj.reporter:
            return None
        return {'id': obj.reporter.id, 'username': obj.reporter.username}

    def get_primary_image(self, obj):
        img = obj.images.filter(is_primary=True).first() or obj.images.first()
        if img and img.image:
            req = self.context.get('request')
            return req.build_absolute_uri(img.image.url) if req else img.image.url
        return None


class FoundPetReportCreateSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(required=False, write_only=True)

    class Meta:
        model = FoundPetReport
        fields = [
            'pet_type', 'breed', 'color', 'size',
            'description', 'location_found', 'date_found',
            'contact_phone', 'contact_email', 'image',
        ]

    def create(self, validated_data):
        request = self.context['request']
        validated_data['reporter'] = request.user
        image = validated_data.pop('image', None)
        for k in ('breed', 'color', 'size'):
            if validated_data.get(k) == '':
                validated_data[k] = None
        report = FoundPetReport.objects.create(**validated_data)
        if image:
            LostFoundImage.objects.create(found_report=report, image=image, is_primary=True)
        return report


# ----- Match -----
class MatchSerializer(serializers.ModelSerializer):
    lost_report_info = serializers.SerializerMethodField()
    found_report_info = serializers.SerializerMethodField()
    is_confirmed = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = [
            'id', 'lost_report', 'lost_report_info', 'found_report', 'found_report_info',
            'match_score', 'match_reasons', 'status',
            'confirmed_by_lost_owner', 'confirmed_by_finder', 'is_confirmed',
            'created_at', 'updated_at', 'resolved_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'resolved_at']

    def get_lost_report_info(self, obj):
        lr = obj.lost_report
        pet = lr.pet if lr else None
        img = None
        if lr:
            img = lr.images.filter(is_primary=True).first() or lr.images.first()
        if not img and pet:
            img = pet.images.filter(is_primary=True).first() or pet.images.first()
        img_url = None
        if img and img.image:
            req = self.context.get('request')
            img_url = req.build_absolute_uri(img.image.url) if req else img.image.url
        return {
            'id': lr.id,
            'pet_name': pet.name if pet else 'Unknown',
            'pet_type': pet.pet_type if pet else None,
            'breed': pet.breed if pet else None,
            'last_seen_location': lr.last_seen_location if lr else None,
            'last_seen_date': str(lr.last_seen_date) if lr and lr.last_seen_date else None,
            'description': lr.description if lr else None,
            'primary_image_url': img_url,
        }

    def get_found_report_info(self, obj):
        fr = obj.found_report
        img = fr.images.filter(is_primary=True).first() or fr.images.first() if fr else None
        img_url = None
        if img and img.image:
            req = self.context.get('request')
            img_url = req.build_absolute_uri(img.image.url) if req else img.image.url
        return {
            'id': fr.id,
            'pet_type': fr.pet_type if fr else None,
            'breed': fr.breed if fr else None,
            'color': fr.color if fr else None,
            'location_found': fr.location_found if fr else None,
            'date_found': str(fr.date_found) if fr and fr.date_found else None,
            'description': fr.description if fr else None,
            'primary_image_url': img_url,
        }

    def get_is_confirmed(self, obj):
        return obj.is_confirmed()


# ----- Match Notification -----
class MatchNotificationSerializer(serializers.ModelSerializer):
    match_info = serializers.SerializerMethodField()

    class Meta:
        model = MatchNotification
        fields = [
            'id', 'match', 'match_info', 'user', 'notification_type',
            'title', 'message', 'is_read', 'created_at', 'read_at',
        ]
        read_only_fields = ['id', 'created_at', 'read_at']

    def get_match_info(self, obj):
        if not obj.match:
            return None
        m = obj.match
        return {
            'id': m.id,
            'match_score': m.match_score,
            'lost_pet_name': m.lost_report.pet.name if m.lost_report and m.lost_report.pet else 'Unknown',
        }
