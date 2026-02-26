"""
eSewa ePay HMAC signing for initiate API (final year project).
Merchant secret must be stored in environment (ESEWA_SECRET_KEY); never in code.
"""
import base64
import hashlib
import hmac as hmacc


def generate_esewa_signature(signed_field_names, field_values, secret_key):
    """
    Generate HMAC SHA256 signature for eSewa signed payment payload.
    Values are concatenated in the order of signed_field_names, then signed.
    Returns base64-encoded signature (eSewa typical format).
    """
    if not secret_key:
        raise ValueError('ESEWA_SECRET_KEY is required for signed payload.')
    names = [n.strip() for n in signed_field_names.split(',')]
    payload = ','.join(str(field_values.get(n, '')) for n in names)
    signature = hmacc.new(
        secret_key.encode('utf-8') if isinstance(secret_key, str) else secret_key,
        payload.encode('utf-8'),
        hashlib.sha256,
    ).digest()
    return base64.b64encode(signature).decode('ascii')
