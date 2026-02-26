from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework import serializers
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Q
from django.utils import timezone
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from datetime import datetime
import io
import os

from .models import Pet, PetImage, AdoptionRequest, SavedPet, Message, RewardPoint
from .serializers import (
    PetSerializer, 
    PetCreateSerializer,
    PetImageSerializer,
    PetImageCreateSerializer,
    AdoptionRequestSerializer,
    SavedPetSerializer,
    MessageSerializer,
    RewardPointSerializer
)
from .filters import PetFilter
from accounts.permissions import IsShelterUser, IsVerifiedShelter, IsShelterOrAdmin, IsAdopterUser


class PetViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Pet CRUD operations
    
    List: Public (anyone can view pets)
    Retrieve: Public (anyone can view pet details)
    Create: Shelter only
    Update: Shelter owner only
    Delete: Shelter owner only
    """
    queryset = Pet.objects.select_related('shelter').prefetch_related('images').all()
    serializer_class = PetSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = PetFilter
    search_fields = ['name', 'description', 'breed']
    ordering_fields = ['created_at', 'age', 'name']
    ordering = ['-created_at']
    
    def get_permissions(self):
        """
        Assign permissions based on action
        """
        if self.action in ['list', 'retrieve']:
            permission_classes = [AllowAny]
        elif self.action == 'create':
            permission_classes = [IsAuthenticated, IsVerifiedShelter]
        else:
            permission_classes = [IsAuthenticated, IsShelterOrAdmin]
        return [permission() for permission in permission_classes]
    
    def get_serializer_class(self):
        """
        Use different serializer for create action
        """
        if self.action == 'create':
            return PetCreateSerializer
        return PetSerializer
    
    def get_queryset(self):
        """
        Filter queryset based on user permissions and filters
        """
        queryset = super().get_queryset()
        
        # If shelter user, show their own pets in list view when authenticated
        if self.request.user.is_authenticated and self.request.user.is_shelter:
            if self.action == 'list':
                # Allow filtering by status
                status_param = self.request.query_params.get('status')
                if status_param:
                    queryset = queryset.filter(shelter=self.request.user, status=status_param)
                else:
                    queryset = queryset.filter(shelter=self.request.user)
        elif self.action == 'list':
            # Veterinarians can list all pets (optionally filter by status)
            if self.request.user.is_authenticated and self.request.user.is_veterinarian:
                status_param = self.request.query_params.get('status')
                if status_param:
                    queryset = queryset.filter(status=status_param)
            else:
                # Public listing - default to showing only available pets
                status_param = self.request.query_params.get('status', 'available')
                if status_param:
                    queryset = queryset.filter(status=status_param)
        
        return queryset
    
    def perform_create(self, serializer):
        """
        Set the shelter to the current user when creating a pet
        """
        serializer.save(shelter=self.request.user)
    
    def create(self, request, *args, **kwargs):
        """
        Override create to return full PetSerializer with images after creation
        """
        # Use PetCreateSerializer for creation
        create_serializer = self.get_serializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)
        self.perform_create(create_serializer)
        
        # Get the created pet instance and prefetch images
        pet = create_serializer.instance
        # Refresh from database to ensure we have the latest data including any images
        pet = Pet.objects.prefetch_related('images').select_related('shelter').get(pk=pet.pk)
        
        # Return full PetSerializer response with images
        response_serializer = PetSerializer(pet, context={'request': request})
        headers = self.get_success_headers(response_serializer.data)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_update(self, serializer):
        """Only shelter owner (and verified) or admin can update."""
        pet = self.get_object()
        user = self.request.user
        if pet.shelter != user and not user.is_admin_user:
            raise PermissionDenied('You do not have permission to update this pet.')
        if user.is_shelter and not getattr(user, 'is_verified', False):
            raise PermissionDenied('Account pending verification approval.')
        serializer.save()

    def perform_destroy(self, instance):
        """Only shelter owner (and verified) or admin can delete."""
        user = self.request.user
        if instance.shelter != user and not user.is_admin_user:
            raise PermissionDenied('You do not have permission to delete this pet.')
        if user.is_shelter and not getattr(user, 'is_verified', False):
            raise PermissionDenied('Account pending verification approval.')
        instance.delete()
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsVerifiedShelter])
    def upload_image(self, request, pk=None):
        """
        Upload an image for a pet
        POST /api/pets/{id}/upload_image/
        """
        pet = self.get_object()
        
        # Check ownership
        if pet.shelter != request.user:
            return Response(
                {'detail': 'You can only add images to pets that belong to your shelter.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = PetImageCreateSerializer(
            data=request.data,
            context={'pet': pet, 'request': request}
        )
        
        if serializer.is_valid():
            image_instance = serializer.save()
            # Return full image data with URL using PetImageSerializer
            image_serializer = PetImageSerializer(image_instance, context={'request': request})
            return Response(
                {'message': 'Image uploaded successfully', 'data': image_serializer.data},
                status=status.HTTP_201_CREATED
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def images(self, request, pk=None):
        """
        Get all images for a pet
        GET /api/pets/{id}/images/
        """
        pet = self.get_object()
        images = pet.images.all()
        serializer = PetImageSerializer(images, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsVerifiedShelter])
    def my_pets(self, request):
        """
        Get all pets belonging to the current shelter user
        GET /api/pets/my_pets/
        """
        pets = Pet.objects.filter(shelter=request.user).select_related('shelter').prefetch_related('images')
        
        # Allow filtering by status
        status_param = request.query_params.get('status')
        if status_param:
            pets = pets.filter(status=status_param)
        
        serializer = PetSerializer(pets, many=True, context={'request': request})
        return Response({
            'results': serializer.data,
            'count': len(serializer.data)
        })


class AdoptionRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet for AdoptionRequest CRUD operations
    """
    serializer_class = AdoptionRequestSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter queryset based on user role"""
        user = self.request.user
        queryset = AdoptionRequest.objects.select_related(
            'pet', 'adopter', 'shelter'
        ).prefetch_related('pet__images').all()
        
        if user.is_adopter:
            # Adopters see only their own requests
            queryset = queryset.filter(adopter=user)
        elif user.is_shelter:
            # Shelters see requests for their pets
            queryset = queryset.filter(shelter=user)
        elif user.is_admin_user:
            # Admins see all requests
            pass
        else:
            queryset = queryset.none()
        
        # Filter by status if provided
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        
        return queryset
    
    def get_permissions(self):
        """Assign permissions based on action"""
        if self.action == 'create':
            # Only adopters can create adoption requests
            permission_classes = [IsAuthenticated, IsAdopterUser]
        else:
            # Other actions use default permissions
            permission_classes = [IsAuthenticated]
        
        return [permission() for permission in permission_classes]
    
    def perform_create(self, serializer):
        """Create adoption request and set adopter"""
        user = self.request.user
        
        # Validation and shelter assignment are handled in serializer.create()
        # We only need to pass the adopter here
        serializer.save(adopter=user)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsVerifiedShelter])
    def approve(self, request, pk=None):
        """Accept adoption request: set status to 'updated', send email (adopter selected). Does not complete adoption."""
        adoption_request = self.get_object()
        
        if adoption_request.shelter != request.user:
            return Response(
                {'detail': 'You can only approve requests for your own pets.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if adoption_request.status not in ('pending',):
            return Response(
                {'detail': 'Only pending requests can be accepted.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        now = timezone.now()
        adoption_request.status = 'updated'
        adoption_request.reviewed_date = now
        adoption_request.reviewed_by = request.user
        # Do not set adopted_date or pet.status here
        adoption_request.save()
        
        # Optionally reserve pet (pending = reserved for this adopter)
        adoption_request.pet.status = 'pending'
        adoption_request.pet.save(update_fields=['status'])
        
        try:
            from veterinary.models import Notification
            Notification.objects.create(
                user=adoption_request.adopter,
                pet=adoption_request.pet,
                notification_type='other',
                title='You have been selected!',
                message=f'Your adoption request for {adoption_request.pet.name} has been accepted. Check your email for shelter contact and next steps.'
            )
            from veterinary.utils import send_adoption_approval_email
            send_adoption_approval_email(
                adopter_email=adoption_request.adopter.email,
                pet_name=adoption_request.pet.name,
                adopter_name=adoption_request.adopter.first_name or adoption_request.adopter.username,
                shelter=adoption_request.shelter,
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create notification or send email: {e}")
        
        return Response({
            'message': 'Adoption request accepted. Adopter has been notified. Complete adoption when the pet is handed over.',
            'data': AdoptionRequestSerializer(adoption_request, context={'request': request}).data
        })
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsVerifiedShelter], url_path='complete-adoption')
    def complete_adoption(self, request, pk=None):
        """Mark adoption as completed: set status to 'adopted', adopted_date, pet adopted, award points."""
        adoption_request = self.get_object()
        
        if adoption_request.shelter != request.user:
            return Response(
                {'detail': 'You can only complete adoptions for your own pets.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if adoption_request.status != 'updated':
            return Response(
                {'detail': 'Only accepted (updated) requests can be marked as adoption completed.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        now = timezone.now()
        adoption_request.status = 'adopted'
        adoption_request.adopted_date = now
        adoption_request.save(update_fields=['status', 'adopted_date'])
        
        adoption_request.pet.status = 'adopted'
        adoption_request.pet.save(update_fields=['status'])
        
        existing_reward = RewardPoint.objects.filter(
            user=adoption_request.adopter,
            source='adoption',
            related_pet=adoption_request.pet
        ).first()
        if not existing_reward:
            RewardPoint.objects.create(
                user=adoption_request.adopter,
                points=100,
                source='adoption',
                description=f'Adopted {adoption_request.pet.name}',
                related_pet=adoption_request.pet
            )
        
        try:
            from veterinary.models import Notification
            Notification.objects.create(
                user=adoption_request.adopter,
                pet=adoption_request.pet,
                notification_type='other',
                title='Adoption completed',
                message=f'Your adoption of {adoption_request.pet.name} has been completed. Thank you!'
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create notification: {e}")
        
        return Response({
            'message': 'Adoption completed successfully',
            'data': AdoptionRequestSerializer(adoption_request, context={'request': request}).data
        })
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsVerifiedShelter])
    def reject(self, request, pk=None):
        """Reject an adoption request"""
        adoption_request = self.get_object()
        
        if adoption_request.shelter != request.user:
            return Response(
                {'detail': 'You can only reject requests for your own pets.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        adoption_request.status = 'rejected'
        adoption_request.reviewed_date = timezone.now()
        adoption_request.reviewed_by = request.user
        adoption_request.save()
        
        return Response({
            'message': 'Adoption request rejected',
            'data': AdoptionRequestSerializer(adoption_request, context={'request': request}).data
        })
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def history(self, request):
        """
        Get adoption history (approved adoptions only)
        GET /api/adoption-requests/history/
        """
        user = request.user
        queryset = AdoptionRequest.objects.filter(
            status__in=('approved', 'adopted')
        ).select_related('pet', 'adopter', 'shelter').prefetch_related('pet__images')
        
        # Role-based filtering
        if user.is_adopter:
            queryset = queryset.filter(adopter=user)
        elif user.is_shelter:
            queryset = queryset.filter(shelter=user)
        elif not user.is_admin_user:
            queryset = queryset.none()
        
        # Order by review date (most recent first)
        queryset = queryset.order_by('-reviewed_date', '-request_date')
        
        serializer = AdoptionRequestSerializer(queryset, many=True, context={'request': request})
        return Response({
            'results': serializer.data,
            'count': len(serializer.data)
        })

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsAdopterUser], url_path='check')
    def check_pending(self, request):
        """
        Check if adopter has a pending request for a pet. Query: pet_id=<id>.
        GET /api/adoption-requests/check/?pet_id=123
        """
        pet_id = request.query_params.get('pet_id')
        if not pet_id:
            return Response(
                {'detail': 'pet_id query parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            pet_id = int(pet_id)
        except (ValueError, TypeError):
            return Response(
                {'detail': 'Invalid pet_id.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        has_pending = AdoptionRequest.objects.filter(
            adopter=request.user,
            pet_id=pet_id,
            status='pending'
        ).exists()
        return Response({'has_pending': has_pending})
    
    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def certificate(self, request, pk=None):
        """
        Generate and download adoption certificate as PDF
        GET /api/adoption-requests/{id}/certificate/
        """
        adoption_request = self.get_object()
        
        # Validate adoption is completed (approved or adopted)
        if adoption_request.status not in ('approved', 'adopted'):
            return Response(
                {'detail': 'Certificate can only be generated for completed adoptions.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate user has permission (adopter or shelter)
        user = request.user
        if adoption_request.adopter != user and adoption_request.shelter != user and not user.is_admin_user:
            return Response(
                {'detail': 'You do not have permission to access this certificate.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Determine certificate type based on user role
        is_shelter_view = adoption_request.shelter == user
        
        # Generate PDF
        buffer = io.BytesIO()
        try:
            doc = SimpleDocTemplate(
                buffer, pagesize=letter,
                topMargin=0.6*inch, bottomMargin=0.6*inch,
                leftMargin=0.75*inch, rightMargin=0.75*inch
            )
            story = []
            gray_mid = colors.HexColor('#6b7280')
            gray_light = colors.HexColor('#9ca3af')

            # Different colors for shelter vs adopter
            if is_shelter_view:
                primary_color = colors.HexColor('#2563eb')
                title_text = "ADOPTION RECORD"
                footer_text = "Shelter Record — PetCare Platform"
                filename_prefix = "adoption_record"
            else:
                primary_color = colors.HexColor('#059669')
                title_text = "ADOPTION CERTIFICATE"
                footer_text = "Issued by PetCare Platform"
                filename_prefix = "adoption_certificate"

            styles = getSampleStyleSheet()

            # Typography: title, subtitle, labels, body, footer
            title_style = ParagraphStyle(
                'CertTitle',
                parent=styles['Heading1'],
                fontSize=26,
                textColor=primary_color,
                spaceAfter=8,
                alignment=1,
            )
            subtitle_style = ParagraphStyle(
                'CertSubtitle',
                parent=styles['Normal'],
                fontSize=10,
                textColor=gray_mid,
                spaceAfter=24,
                alignment=1,
            )
            label_style = ParagraphStyle(
                'CertLabel',
                parent=styles['Normal'],
                fontSize=9,
                textColor=gray_mid,
                spaceAfter=2,
                alignment=1,
            )
            name_style = ParagraphStyle(
                'CertName',
                parent=styles['Heading2'],
                fontSize=18,
                textColor=primary_color,
                spaceAfter=16,
                alignment=1,
            )
            body_style = ParagraphStyle(
                'CertBody',
                parent=styles['Normal'],
                fontSize=11,
                textColor=colors.HexColor('#374151'),
                leading=16,
                spaceAfter=6,
                alignment=1,
            )
            footer_style = ParagraphStyle(
                'CertFooter',
                parent=styles['Normal'],
                fontSize=9,
                textColor=gray_light,
                spaceAfter=4,
                alignment=1,
            )

            cert_id = f"PET-{adoption_request.id:06d}"

            # —— Header: title + accent line + record ID ——
            story.append(Spacer(1, 0.2*inch))
            story.append(Paragraph(title_text, title_style))
            accent_line = Table([['']], colWidths=[5*inch], rowHeights=[3], hAlign='CENTER')
            accent_line.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), primary_color),
            ]))
            story.append(accent_line)
            story.append(Spacer(1, 0.15*inch))
            story.append(Paragraph(f"Record ID: {cert_id}", subtitle_style))
            story.append(Spacer(1, 0.35*inch))

            # —— Certification: adopter and pet with clear labels ——
            story.append(Paragraph("This certifies that", body_style))
            story.append(Spacer(1, 0.1*inch))
            story.append(Paragraph("ADOPTER", label_style))
            adopter_name = f"{adoption_request.adopter.first_name or ''} {adoption_request.adopter.last_name or ''}".strip()
            if not adopter_name:
                adopter_name = adoption_request.adopter.username
            story.append(Paragraph(adopter_name, name_style))
            story.append(Spacer(1, 0.05*inch))
            if is_shelter_view:
                story.append(Paragraph("has adopted from this shelter", body_style))
            else:
                story.append(Paragraph("has successfully adopted", body_style))
            story.append(Spacer(1, 0.1*inch))
            # Adopted pet photo (primary or first image)
            primary_img = (
                adoption_request.pet.images.filter(is_primary=True).first()
                or adoption_request.pet.images.first()
            )
            if primary_img and primary_img.image:
                try:
                    image_path = primary_img.image.path
                    if os.path.exists(image_path):
                        pet_photo = Image(
                            image_path,
                            width=1.25*inch,
                            height=1.25*inch,
                        )
                        pet_photo.hAlign = 'CENTER'
                        story.append(Spacer(1, 0.1*inch))
                        story.append(pet_photo)
                        story.append(Spacer(1, 0.1*inch))
                except (ValueError, OSError):
                    pass
            story.append(Paragraph("PET", label_style))
            story.append(Paragraph(adoption_request.pet.name, name_style))
            story.append(Spacer(1, 0.25*inch))

            # —— Section divider ——
            div_line = Table([['']], colWidths=[6*inch], rowHeights=[1], hAlign='CENTER')
            div_line.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#e5e7eb')),
            ]))
            story.append(div_line)
            story.append(Spacer(1, 0.2*inch))

            # —— Pet details table ——
            breed_display = (adoption_request.pet.breed or '').strip().title()
            pet_data = [
                ['Pet Type', adoption_request.pet.get_pet_type_display()],
                ['Breed', breed_display or '—'],
                ['Age', f"{adoption_request.pet.age} months"],
                ['Gender', adoption_request.pet.get_gender_display()],
            ]
            pet_table = Table(pet_data, colWidths=[1.75*inch, 4*inch])
            pet_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1f2937')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 11),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
                ('LEFTPADDING', (0, 0), (-1, -1), 12),
                ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ]))
            story.append(pet_table)
            story.append(Spacer(1, 0.28*inch))

            # —— Issuance details (left-aligned for readability) ——
            detail_style = ParagraphStyle(
                'CertDetail',
                parent=styles['Normal'],
                fontSize=11,
                textColor=colors.HexColor('#374151'),
                leading=18,
                alignment=0,
            )
            story.append(Paragraph(
                f"<b>Shelter</b> {adoption_request.shelter.username}",
                detail_style
            ))
            adoption_date = adoption_request.reviewed_date or adoption_request.request_date
            formatted_date = adoption_date.strftime('%B %d, %Y') if adoption_date else 'N/A'
            story.append(Paragraph(f"<b>Adoption date</b> {formatted_date}", detail_style))

            if is_shelter_view:
                story.append(Paragraph(
                    f"<b>Adopter email</b> {adoption_request.adopter.email or '—'}",
                    detail_style
                ))
                if adoption_request.notes:
                    story.append(Paragraph(f"<b>Notes</b> {adoption_request.notes}", detail_style))

            story.append(Spacer(1, 0.35*inch))

            # —— Footer ——
            story.append(Paragraph(footer_text, footer_style))
            story.append(Paragraph(f"Issued on {datetime.now().strftime('%B %d, %Y')}", footer_style))
            
            # Build PDF
            doc.build(story)
            buffer.seek(0)
            pdf_data = buffer.getvalue()
            buffer.close()
            
            # Create HTTP response with proper headers
            response = HttpResponse(pdf_data, content_type='application/pdf')
            filename = f"{filename_prefix}_{cert_id}.pdf"
            # Use inline to open in browser, attachment to force download
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            response['Content-Length'] = len(pdf_data)
            
            return response
        except Exception as e:
            if 'buffer' in locals():
                buffer.close()
            return Response(
                {'detail': f'Failed to generate certificate: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SavedPetViewSet(viewsets.ModelViewSet):
    """
    ViewSet for SavedPet operations (Adopter only)
    """
    serializer_class = SavedPetSerializer
    permission_classes = [IsAuthenticated, IsAdopterUser]
    
    def get_queryset(self):
        """Return only saved pets for current user"""
        return SavedPet.objects.filter(
            user=self.request.user
        ).select_related('pet').prefetch_related('pet__images')
    
    def perform_create(self, serializer):
        """Set user when creating saved pet"""
        serializer.save(user=self.request.user)


def get_allowed_chat_partners(user):
    """
    Return set of user IDs the current user is allowed to chat with.
    Only these IDs are allowed; MessageViewSet enforces this on create and thread,
    so unauthorized users cannot message random users.
    - Adopter: shelters of pets they have interacted with (saved or adoption request);
      vets assigned to their adopted pets; plus anyone who has already messaged them.
    - Shelter: adopters who have requested or adopted their pets; veterinarians who
      have medical records for the shelter's pets; plus vets who have already messaged them.
    - Veterinarian: adopters of pets they treat; shelters whose pets they have records for;
      plus adopters/shelters who have already messaged them.
    - Lost & Found: match partners (lost owner <-> found reporter).
    Returns empty set on any error so the messages endpoint never 500s.
    """
    try:
        from accounts.models import User as UserModel
        allowed = set()
        role = getattr(user, 'role', None)
        if not role:
            return allowed

        if role == 'adopter':
            # Shelters of pets the adopter has interacted with (saved the pet or made an adoption request)
            try:
                shelters_of_interacted_pets = set(
                    Pet.objects.filter(
                        Q(savedpet__user=user) | Q(adoption_requests__adopter=user)
                    ).values_list('shelter_id', flat=True).distinct()
                )
                # Only add non-null shelter IDs so we never allow messaging invalid partners
                allowed.update(i for i in shelters_of_interacted_pets if i is not None)
            except Exception:
                pass
            # Veterinarians assigned to their adopted pets (have medical record for adopted pet)
            try:
                from veterinary.models import MedicalRecord
                vet_ids = set(
                    UserModel.objects.filter(
                        medical_records__pet__adoption_requests__adopter=user,
                        medical_records__pet__adoption_requests__status__in=('approved', 'adopted')
                    ).distinct().values_list('id', flat=True)
                )
                allowed.update(vet_ids)
            except Exception:
                pass
            # Allow replying to shelters/vets who have already messaged this adopter
            try:
                already_messaged = set(
                    Message.objects.filter(recipient=user)
                    .filter(Q(sender__role='shelter') | Q(sender__role='veterinarian'))
                    .values_list('sender_id', flat=True).distinct()
                )
                allowed.update(already_messaged)
            except Exception:
                pass
        elif role == 'shelter':
            try:
                adopter_ids = set(
                    AdoptionRequest.objects.filter(pet__shelter=user)
                    .values_list('adopter_id', flat=True).distinct()
                )
                allowed.update(adopter_ids)
            except Exception:
                pass
            # Veterinarians who have medical records for this shelter's pets (shelter–vet chat)
            try:
                from veterinary.models import MedicalRecord
                vet_ids_shelter = set(
                    MedicalRecord.objects.filter(pet__shelter=user)
                    .values_list('veterinarian_id', flat=True).distinct()
                )
                allowed.update(i for i in vet_ids_shelter if i is not None)
            except Exception:
                pass
            # Allow replying to vets who have already messaged this shelter
            try:
                already_messaged_vets = set(
                    Message.objects.filter(recipient=user)
                    .filter(sender__role='veterinarian')
                    .values_list('sender_id', flat=True).distinct()
                )
                allowed.update(already_messaged_vets)
            except Exception:
                pass
        elif role == 'veterinarian':
            try:
                adopter_ids = set(
                    AdoptionRequest.objects.filter(
                        status__in=('approved', 'adopted'),
                        pet__medical_records__veterinarian=user
                    ).values_list('adopter_id', flat=True).distinct()
                )
                allowed.update(adopter_ids)
            except Exception:
                pass
            # Allow replying to adopters who have already messaged this vet
            try:
                already_messaged = set(
                    Message.objects.filter(recipient=user)
                    .filter(sender__role='adopter')
                    .values_list('sender_id', flat=True).distinct()
                )
                allowed.update(already_messaged)
            except Exception:
                pass
            # Shelters whose pets have medical records created by this vet (shelter–vet chat)
            try:
                from veterinary.models import MedicalRecord
                shelter_ids_vet = set(
                    MedicalRecord.objects.filter(veterinarian=user)
                    .values_list('pet__shelter_id', flat=True).distinct()
                )
                allowed.update(i for i in shelter_ids_vet if i is not None)
            except Exception:
                pass
            # Allow replying to shelters who have already messaged this vet
            try:
                already_messaged_shelters = set(
                    Message.objects.filter(recipient=user)
                    .filter(sender__role='shelter')
                    .values_list('sender_id', flat=True).distinct()
                )
                allowed.update(already_messaged_shelters)
            except Exception:
                pass

        # Lost & Found: users who are the other party in a match (lost owner <-> found reporter)
        try:
            from lost_found.models import Match
            match_partner_ids = set(
                Match.objects.filter(lost_report__owner=user).values_list('found_report__reporter_id', flat=True).distinct()
            ) | set(
                Match.objects.filter(found_report__reporter=user).values_list('lost_report__owner_id', flat=True).distinct()
            )
            allowed.update(match_partner_ids)
        except Exception:
            pass

        return allowed
    except Exception:
        return set()


def _get_partner_context_pet_name(current_user, other_user):
    """Return one pet name that represents the chat relationship, or None."""
    from accounts.models import User as UserModel
    role = getattr(current_user, 'role', None)
    if role == 'adopter':
        if getattr(other_user, 'role', None) == 'shelter':
            pet = Pet.objects.filter(shelter=other_user).filter(
                Q(savedpet__user=current_user) | Q(adoption_requests__adopter=current_user)
            ).order_by('id').values_list('name', flat=True).first()
            return pet
        if getattr(other_user, 'role', None) == 'veterinarian':
            try:
                from veterinary.models import MedicalRecord
                pet = Pet.objects.filter(
                    adoption_requests__adopter=current_user,
                    adoption_requests__status__in=('approved', 'adopted'),
                    medical_records__veterinarian=other_user,
                ).order_by('id').values_list('name', flat=True).first()
                return pet
            except Exception:
                return None
    elif role == 'shelter':
        if getattr(other_user, 'role', None) == 'adopter':
            pet = Pet.objects.filter(
                shelter=current_user,
                adoption_requests__adopter=other_user,
            ).order_by('id').values_list('name', flat=True).first()
            return pet
        if getattr(other_user, 'role', None) == 'veterinarian':
            try:
                from veterinary.models import MedicalRecord
                pet = Pet.objects.filter(
                    shelter=current_user,
                    medical_records__veterinarian=other_user,
                ).order_by('id').values_list('name', flat=True).first()
                return pet
            except Exception:
                return None
    elif role == 'veterinarian':
        if getattr(other_user, 'role', None) == 'adopter':
            try:
                from veterinary.models import MedicalRecord
                pet = Pet.objects.filter(
                    medical_records__veterinarian=current_user,
                    adoption_requests__adopter=other_user,
                    adoption_requests__status__in=('approved', 'adopted'),
                ).order_by('id').values_list('name', flat=True).first()
                return pet
            except Exception:
                return None
        if getattr(other_user, 'role', None) == 'shelter':
            try:
                from veterinary.models import MedicalRecord
                pet = Pet.objects.filter(
                    shelter=other_user,
                    medical_records__veterinarian=current_user,
                ).order_by('id').values_list('name', flat=True).first()
                return pet
            except Exception:
                return None
    # Lost & Found match: show lost pet name as context
    try:
        from lost_found.models import Match
        match = Match.objects.filter(
            Q(lost_report__owner=current_user, found_report__reporter=other_user) |
            Q(lost_report__owner=other_user, found_report__reporter=current_user)
        ).select_related('lost_report', 'lost_report__pet').first()
        if match and match.lost_report and match.lost_report.pet:
            return match.lost_report.pet.name
    except Exception:
        pass
    return None


class MessageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Message operations. Role-based: users can only chat with allowed partners.
    """
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return messages where user is sender or recipient AND other party is allowed."""
        user = self.request.user
        allowed = get_allowed_chat_partners(user)
        base = Message.objects.filter(
            Q(sender=user) | Q(recipient=user)
        ).select_related('sender', 'recipient', 'related_pet')
        # Restrict to conversations with allowed partners only
        base = base.filter(Q(sender__in=allowed) | Q(recipient__in=allowed))
        # For thread view, order by created_at asc (old -> new); else default -created_at
        with_user = self.request.query_params.get('with_user')
        if with_user:
            try:
                other_id = int(with_user)
                if other_id not in allowed:
                    return Message.objects.none()
                base = base.filter(Q(sender=user, recipient_id=other_id) | Q(recipient=user, sender_id=other_id))
                return base.order_by('created_at')
            except (ValueError, TypeError):
                return Message.objects.none()
        return base.order_by('-created_at')

    def perform_create(self, serializer):
        """Set sender and enforce recipient is in allowed partners (no random users). Allow body to be empty if attachment present."""
        user = self.request.user
        recipient = serializer.validated_data.get('recipient')
        if not recipient:
            raise ValidationError({'recipient': ['Recipient is required.']})
        allowed = get_allowed_chat_partners(user)
        if recipient.id not in allowed:
            raise PermissionDenied('You are not allowed to chat with this user.')
        body = (serializer.validated_data.get('body') or '').strip()
        attachment = serializer.validated_data.get('attachment')
        if not body and not attachment:
            raise ValidationError({'body': ['Message must have text or a document attachment.']})
        subject = (serializer.validated_data.get('subject') or '').strip() or 'Message'
        attachment_name = serializer.validated_data.get('attachment_name') or ''
        if attachment and not attachment_name and getattr(attachment, 'name', None):
            attachment_name = attachment.name
        serializer.save(
            sender=user,
            body=body or '',
            subject=subject,
            attachment=attachment,
            attachment_name=attachment_name or (attachment.name if attachment else ''),
        )

    def destroy(self, request, *args, **kwargs):
        """Unsend message: soft-delete (is_deleted=True) for sender only. Broadcast to room."""
        message = self.get_object()
        if message.sender_id != request.user.id:
            return Response(
                {'detail': 'Only the sender can unsend this message.'},
                status=status.HTTP_403_FORBIDDEN
            )
        if message.is_deleted:
            return Response(
                {'detail': 'Message was already unsent.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        message.is_deleted = True
        message.deleted_at = timezone.now()
        message.save(update_fields=['is_deleted', 'deleted_at'])

        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            channel_layer = get_channel_layer()
            if channel_layer:
                room_name = f"chat_{min(message.sender_id, message.recipient_id)}_{max(message.sender_id, message.recipient_id)}"
                async_to_sync(channel_layer.group_send)(
                    room_name,
                    {
                        'type': 'message_deleted',
                        'message_id': message.id,
                    },
                )
        except Exception:
            pass

        return Response(
            {'detail': 'Message unsent.', 'message_id': message.id},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'], url_path='conversations')
    def conversations(self, request):
        """List distinct chat partners with last message and unread count per conversation."""
        from accounts.serializers import UserSerializer
        user = request.user
        allowed = get_allowed_chat_partners(user)
        if not allowed:
            return Response([])
        qs = Message.objects.filter(
            Q(sender=user) | Q(recipient=user)
        ).filter(Q(sender__in=allowed) | Q(recipient__in=allowed)).order_by('-created_at')
        other_ids = set()
        for m in qs.only('sender_id', 'recipient_id')[:500]:
            other_ids.add(m.sender_id if m.recipient_id == user.id else m.recipient_id)
        result = []
        for other_id in other_ids:
            thread = Message.objects.filter(
                Q(sender=user, recipient_id=other_id) | Q(recipient=user, sender_id=other_id)
            ).select_related('sender', 'recipient').order_by('-created_at')
            last = thread.first()
            if not last:
                continue
            unread = thread.filter(recipient=user, is_read=False).count()
            other_user = last.recipient if last.sender_id == user.id else last.sender
            result.append({
                'id': str(other_id),
                'other_user_id': other_id,
                'other_party': UserSerializer(other_user).data,
                'last_message': MessageSerializer(last, context={'request': request}).data,
                'unread_count': unread,
            })
        result.sort(key=lambda x: (x['last_message']['created_at'] or ''), reverse=True)
        return Response(result)

    @action(detail=False, methods=['get'], url_path='thread')
    def thread(self, request):
        """Fetch message history with a user, ordered old -> new. Query: user_id=<id>. Pagination-friendly."""
        user_id_param = request.query_params.get('user_id')
        if user_id_param is None:
            return Response({'detail': 'user_id query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            other_id = int(user_id_param)
        except (ValueError, TypeError):
            return Response({'detail': 'Invalid user id.'}, status=status.HTTP_400_BAD_REQUEST)
        allowed = get_allowed_chat_partners(request.user)
        if other_id not in allowed:
            return Response({'detail': 'You are not allowed to chat with this user.'}, status=status.HTTP_403_FORBIDDEN)
        qs = Message.objects.filter(
            Q(sender=request.user, recipient_id=other_id) | Q(recipient=request.user, sender_id=other_id)
        ).select_related('sender', 'recipient', 'related_pet').order_by('created_at')
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = MessageSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        serializer = MessageSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a message as read."""
        message = self.get_object()
        if message.recipient != request.user:
            return Response(
                {'detail': 'You can only mark your own received messages as read.'},
                status=status.HTTP_403_FORBIDDEN
            )
        message.is_read = True
        message.save()
        return Response({
            'message': 'Message marked as read',
            'data': MessageSerializer(message, context={'request': request}).data
        })

    @action(detail=False, methods=['post'], url_path='mark_conversation_read')
    def mark_conversation_read(self, request):
        """Mark all messages from a user as read."""
        other_id = request.data.get('other_user') or request.data.get('other_user_id')
        if other_id is None:
            return Response({'detail': 'other_user is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            other_id = int(other_id)
        except (ValueError, TypeError):
            return Response({'detail': 'Invalid other_user.'}, status=status.HTTP_400_BAD_REQUEST)
        allowed = get_allowed_chat_partners(request.user)
        if other_id not in allowed:
            return Response({'detail': 'Not allowed to chat with this user.'}, status=status.HTTP_403_FORBIDDEN)
        updated = Message.objects.filter(recipient=request.user, sender_id=other_id, is_read=False).update(is_read=True)
        return Response({'message': f'Marked {updated} messages as read.', 'count': updated})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread messages for current user."""
        count = Message.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'count': count})

    @action(detail=False, methods=['get'], url_path='allowed_partners')
    def allowed_partners(self, request):
        """
        Return users the current user is allowed to start a chat with.
        List: user_id, name, role, optional context (pet name).
        """
        from accounts.models import User as UserModel
        user = request.user
        allowed_ids = get_allowed_chat_partners(user)
        if not allowed_ids:
            return Response([])
        users = UserModel.objects.filter(id__in=allowed_ids).order_by('username')
        result = []
        for other in users:
            name = (other.get_full_name() or '').strip() or other.username or str(other)
            role = getattr(other, 'role', '') or ''
            pet_name = _get_partner_context_pet_name(user, other)
            result.append({
                'user_id': other.id,
                'name': name,
                'role': role,
                'pet_name': pet_name,
            })
        return Response(result)


class RewardPointViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for RewardPoint (read-only for users)
    """
    serializer_class = RewardPointSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Return only reward points for current user"""
        return RewardPoint.objects.filter(
            user=self.request.user
        ).select_related('related_pet')
    
    @action(detail=False, methods=['get'])
    def total(self, request):
        """Get total reward points for current user"""
        total = RewardPoint.objects.filter(
            user=request.user
        ).aggregate(total_points=Sum('points'))['total_points'] or 0
        
        return Response({
            'points': total,
            'user': request.user.username
        })


class AdoptedPetsView(APIView):
    """
    API view to get adopted pets for current adopter
    """
    permission_classes = [IsAuthenticated, IsAdopterUser]
    
    def get(self, request):
        """Get all pets adopted by current user"""
        adopted_requests = AdoptionRequest.objects.filter(
            adopter=request.user,
            status__in=('approved', 'adopted')
        ).select_related('pet').prefetch_related('pet__images')
        
        pets = [req.pet for req in adopted_requests]
        serializer = PetSerializer(pets, many=True, context={'request': request})
        
        return Response({
            'results': serializer.data,
            'count': len(serializer.data)
        })
