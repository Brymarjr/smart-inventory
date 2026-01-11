import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


class PaystackService:
    """
    A service class for interacting with Paystack's API.
    Handles transaction initialization (creating payment links)
    and verification of completed payments.
    """

    base_url = settings.PAYSTACK_BASE_URL
    secret_key = settings.PAYSTACK_SECRET_KEY

    @classmethod
    def _get_headers(cls):
        return {
            "Authorization": f"Bearer {cls.secret_key}",
            "Content-Type": "application/json",
        }

    @classmethod
    def create_payment_link(cls, email: str, amount: int, reference: str = None, metadata: dict = None):
        """
        Create a one-off Paystack payment link.
        The `amount` should be passed in naira; this method converts to kobo.
        """
        url = f"{cls.base_url}/transaction/initialize"

        # ✅ Convert to kobo here (₦5000 → 500000)
        payload = {
            "email": email,
            "amount": int(amount * 100),
        }

        if reference:
            payload["reference"] = reference
        if metadata:
            payload["metadata"] = metadata

        try:
            response = requests.post(url, json=payload, headers=cls._get_headers(), timeout=15)
            response.raise_for_status()
            data = response.json()
            logger.info(f"✅ Paystack payment initialized for {email}: {data}")
            return data
        except requests.exceptions.RequestException as e:
            resp_text = getattr(e, "response", None) and e.response.text or None
            logger.exception("❌ Paystack initialization failed: %s", resp_text)
            raise RuntimeError(f"Failed to initialize Paystack payment: {resp_text or str(e)}") from e

    @classmethod
    def verify_transaction(cls, reference: str):
        """
        Verify a Paystack transaction using the reference returned after payment.
        """
        url = f"{cls.base_url}/transaction/verify/{reference}"
        try:
            response = requests.get(url, headers=cls._get_headers(), timeout=15)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            resp_text = getattr(e, "response", None) and e.response.text or None
            logger.exception("❌ Paystack verification failed: %s", resp_text)
            raise RuntimeError(f"Failed to verify Paystack transaction: {resp_text or str(e)}") from e





