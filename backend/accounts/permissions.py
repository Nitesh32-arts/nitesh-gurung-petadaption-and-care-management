from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """
    Permission class to check if user is admin
    """
    message = "You must be an admin to perform this action."
    
    def has_permission(self, request, view):
        role = getattr(request.user, 'role', None)
        role_lower = str(role).lower() if role else ''
        return (
            request.user and
            request.user.is_authenticated and
            (role_lower == 'admin' or request.user.is_superuser)
        )


class IsShelterUser(permissions.BasePermission):
    """
    Permission class to check if user is shelter.
    Uses both role field and is_shelter property so shelter is recognized reliably.
    """
    message = "You must be a shelter to perform this action."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = getattr(request.user, 'role', None)
        role_lower = str(role).lower() if role else ''
        is_shelter = getattr(request.user, 'is_shelter', False)
        return role_lower == 'shelter' or bool(is_shelter)


class IsAdopterUser(permissions.BasePermission):
    """
    Permission class to check if user is adopter
    """
    message = "You must be an adopter to perform this action."
    
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', None) and
            str(request.user.role).lower() == 'adopter'
        )


class IsVeterinarianUser(permissions.BasePermission):
    """
    Permission class to check if user is veterinarian
    """
    message = "You must be a veterinarian to perform this action."
    
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', None) and
            str(request.user.role).lower() == 'veterinarian'
        )


class IsShelterOrAdmin(permissions.BasePermission):
    """
    Permission class to check if user is shelter or admin
    """
    message = "You must be a shelter or admin to perform this action."
    
    def has_permission(self, request, view):
        role = getattr(request.user, 'role', None)
        role_lower = str(role).lower() if role else ''
        return (
            request.user and
            request.user.is_authenticated and
            (
                role_lower == 'shelter' or
                role_lower == 'admin' or
                request.user.is_superuser
            )
        )


class IsVeterinarianOrAdopter(permissions.BasePermission):
    """
    Permission class to check if user is veterinarian or adopter
    """
    message = "You must be a veterinarian or adopter to perform this action."
    
    def has_permission(self, request, view):
        role = getattr(request.user, 'role', None)
        role_lower = str(role).lower() if role else ''
        return (
            request.user and
            request.user.is_authenticated and
            (
                role_lower == 'veterinarian' or
                role_lower == 'adopter'
            )
        )


class IsVerifiedVeterinarian(permissions.BasePermission):
    """Veterinarian role and verification_status == approved. Use for create/edit medical records, reminders, etc."""
    message = "Account pending verification approval."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if getattr(request.user, 'role', None) != 'veterinarian':
            return False
        return getattr(request.user, 'is_verified', False)


class IsVerifiedShelter(permissions.BasePermission):
    """Shelter role and verification_status == approved. Use for add pets, approve adoptions, etc."""
    message = "Account pending verification approval."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if getattr(request.user, 'role', None) != 'shelter':
            return False
        return getattr(request.user, 'is_verified', False)