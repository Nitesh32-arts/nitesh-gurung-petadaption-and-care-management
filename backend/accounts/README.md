# Authentication System Documentation

This module provides complete authentication functionality for the Pet Adoption & Care Management System.

## Features

- ✅ User registration (signup) with role-based access
- ✅ User login with JWT token generation
- ✅ User profile management (view/update)
- ✅ JWT token refresh and verification
- ✅ Role-based permissions (Admin, Shelter, Adopter, Veterinarian)
- ✅ Email and username validation
- ✅ Password validation
- ✅ Django admin integration

## User Roles

- **admin**: System administrator
- **shelter**: Pet shelter organization
- **adopter**: Pet adopter
- **veterinarian**: Veterinary professional

## API Endpoints

### 1. User Registration (Signup)

**Endpoint:** `POST /api/auth/register/`

**Authentication:** Not required

**Request Body:**
```json
{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "securepassword123",
    "password_confirm": "securepassword123",
    "first_name": "John",
    "last_name": "Doe",
    "role": "adopter",
    "phone_number": "+1234567890",
    "address": "123 Main St, City, State"
}
```

**Response (201 Created):**
```json
{
    "message": "User registered successfully",
    "user": {
        "id": 1,
        "username": "john_doe",
        "email": "john@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "role": "adopter",
        "phone_number": "+1234567890",
        "address": "123 Main St, City, State",
        "profile_picture": null,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "is_active": true,
        "date_joined": "2024-01-01T00:00:00Z"
    },
    "tokens": {
        "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
        "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
    }
}
```

### 2. User Login

**Endpoint:** `POST /api/auth/login/`

**Authentication:** Not required

**Request Body:**
```json
{
    "username": "john_doe",
    "password": "securepassword123"
}
```

**Note:** You can also use email instead of username.

**Response (200 OK):**
```json
{
    "message": "Login successful",
    "user": {
        "id": 1,
        "username": "john_doe",
        "email": "john@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "role": "adopter",
        ...
    },
    "tokens": {
        "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
        "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
    }
}
```

### 3. Get Current User Profile

**Endpoint:** `GET /api/auth/me/`

**Authentication:** Required (Bearer Token)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "adopter",
    "phone_number": "+1234567890",
    "address": "123 Main St, City, State",
    "profile_picture": null,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "is_active": true,
    "date_joined": "2024-01-01T00:00:00Z"
}
```

### 4. Update Current User Profile

**Endpoint:** `PUT /api/auth/me/` or `PATCH /api/auth/me/`

**Authentication:** Required (Bearer Token)

**Request Body (PUT - all fields required, PATCH - only fields to update):**
```json
{
    "first_name": "John",
    "last_name": "Smith",
    "email": "newemail@example.com",
    "phone_number": "+9876543210",
    "address": "456 New St, City, State"
}
```

**Response (200 OK):**
```json
{
    "message": "Profile updated successfully",
    "user": {
        "id": 1,
        "username": "john_doe",
        "email": "newemail@example.com",
        ...
    }
}
```

### 5. Refresh JWT Token

**Endpoint:** `POST /api/auth/token/refresh/`

**Authentication:** Not required

**Request Body:**
```json
{
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Response (200 OK):**
```json
{
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### 6. Verify JWT Token

**Endpoint:** `POST /api/auth/token/verify/`

**Authentication:** Not required

**Request Body:**
```json
{
    "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Response (200 OK):**
```json
{}
```

## Error Responses

### Validation Error (400 Bad Request)
```json
{
    "username": ["A user with this username already exists."],
    "email": ["A user with this email already exists."],
    "password_confirm": ["Password fields didn't match."]
}
```

### Invalid Credentials (400 Bad Request)
```json
{
    "non_field_errors": ["Unable to log in with provided credentials."]
}
```

### Unauthorized (401 Unauthorized)
```json
{
    "detail": "Authentication credentials were not provided."
}
```

## Usage Examples

### Using cURL

**Registration:**
```bash
curl -X POST http://127.0.0.1:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "testpass123",
    "password_confirm": "testpass123",
    "role": "adopter"
  }'
```

**Login:**
```bash
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass123"
  }'
```

**Get Profile (with token):**
```bash
curl -X GET http://127.0.0.1:8000/api/auth/me/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Using Python Requests

```python
import requests

# Register
response = requests.post('http://127.0.0.1:8000/api/auth/register/', json={
    'username': 'testuser',
    'email': 'test@example.com',
    'password': 'testpass123',
    'password_confirm': 'testpass123',
    'role': 'adopter'
})
data = response.json()
access_token = data['tokens']['access']

# Get Profile
headers = {'Authorization': f'Bearer {access_token}'}
response = requests.get('http://127.0.0.1:8000/api/auth/me/', headers=headers)
profile = response.json()
```

### Using JavaScript/Fetch

```javascript
// Register
fetch('http://127.0.0.1:8000/api/auth/register/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'testuser',
    email: 'test@example.com',
    password: 'testpass123',
    password_confirm: 'testpass123',
    role: 'adopter'
  })
})
.then(response => response.json())
.then(data => {
  const accessToken = data.tokens.access;
  // Store token and use for authenticated requests
  localStorage.setItem('access_token', accessToken);
});

// Get Profile
const token = localStorage.getItem('access_token');
fetch('http://127.0.0.1:8000/api/auth/me/', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(response => response.json())
.then(profile => console.log(profile));
```

## Permission Classes

The authentication system includes custom permission classes for role-based access:

- `IsAdminUser`: Only admin users
- `IsShelterUser`: Only shelter users
- `IsAdopterUser`: Only adopter users
- `IsVeterinarianUser`: Only veterinarian users
- `IsShelterOrAdmin`: Shelter or admin users

**Usage in views:**
```python
from accounts.permissions import IsShelterUser

class MyView(APIView):
    permission_classes = [IsAuthenticated, IsShelterUser]
    ...
```

## Database Setup

After making changes to the User model, run:

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

## Testing

Test the endpoints using:

1. Django REST Framework Browsable API: `http://127.0.0.1:8000/api/auth/register/`
2. Postman or similar API tools
3. cURL commands (see examples above)
4. Frontend application

## Security Notes

- Passwords are hashed using Django's default password hasher
- JWT tokens expire after 1 hour (access) and 7 days (refresh)
- Use HTTPS in production
- Store tokens securely (httpOnly cookies recommended for web apps)
- Never expose refresh tokens in client-side code

## Notes

- Username cannot be changed after registration
- Email addresses are converted to lowercase
- Profile picture uploads are stored in `media/profile_pictures/`
- All dates are in UTC timezone

