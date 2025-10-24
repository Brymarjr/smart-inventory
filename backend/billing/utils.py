import requests
import os
from django.core.mail import send_mail
from django.conf import settings

PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY", "")
PAYSTACK_BASE_URL = os.getenv("PAYSTACK_BASE_URL", "https://api.paystack.co")


def initialize_payment(email: str, amount: int):
    """
    Initialize a Paystack transaction and return the response.
    Amount should be in kobo (₦1 = 100 kobo)
    """
    url = f"{PAYSTACK_BASE_URL}/transaction/initialize"
    headers = {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }
    data = {
        "email": email,
        "amount": amount,
    }

    response = requests.post(url, json=data, headers=headers)
    return response.json()


def verify_payment(reference: str):
    """
    Verify the status of a Paystack transaction.
    """
    url = f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}"
    headers = {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }

    response = requests.get(url, headers=headers)
    return response.json()


def send_billing_alert_email(subject, message, recipients):
    """
    Simple helper to send billing-related emails.
    """
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=recipients,
        fail_silently=False,
    )