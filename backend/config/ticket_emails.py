"""Email saved booking snapshots and their admission QR to the buyer."""

from email.message import MIMEPart
from io import BytesIO
import logging

from django.conf import settings
from django.core.mail import EmailMessage
from django.template.loader import render_to_string

from .event_views import _as_utc


logger = logging.getLogger(__name__)


def send_ticket_confirmation(purchase, admission_code):
    if not getattr(settings, "TICKET_EMAIL_ENABLED", False):
        return "not_configured"
    try:
        import segno

        event = purchase.event_snapshot
        qr = segno.make_qr(admission_code, error="m", mode="byte", boost_error=False)
        image = BytesIO()
        qr.save(image, kind="png", scale=6, border=4)
        context = {
            "title": event.title,
            "buyer": purchase.buyer_snapshot.full_name or purchase.buyer_snapshot.email,
            "receipt_id": str(purchase.id),
            "quantity": purchase.quantity,
            "starts": _as_utc(event.start_at).strftime("%d %b %Y, %H:%M UTC") if event.start_at else "To be announced",
            "ends": _as_utc(event.end_at).strftime("%d %b %Y, %H:%M UTC") if event.end_at else "To be announced",
            "location": "Online event" if event.event_type == "online" else " · ".join(filter(None, (event.venue_name, event.address))) or "To be announced",
            "stream_url": event.stream_url if event.stream_url and event.stream_url.lower().startswith(("https://", "http://")) else None,
            "total": f"{purchase.currency} {purchase.total_amount_minor // 100}.{purchase.total_amount_minor % 100:02d}" if purchase.total_amount_minor is not None and purchase.currency else "Amount not recorded",
            "admission_code": admission_code,
            "qr_cid": f"ticket-{purchase.id}",
        }
        content = MIMEPart()
        content.set_content(render_to_string("email/ticket_confirmation.txt", context))
        content.add_alternative(render_to_string("email/ticket_confirmation.html", context), subtype="html")
        content.get_payload()[1].add_related(
            image.getvalue(), maintype="image", subtype="png",
            cid=f"<{context['qr_cid']}>", filename=f"ticket-{purchase.id}.png", disposition="inline",
        )
        message = EmailMessage(
            subject=f"Your Eventify ticket: {' '.join(event.title.splitlines())}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[purchase.buyer_snapshot.email],
        )
        message.attach(content)
        if message.send(using="default") == 1:
            return "sent"
    except Exception:
        # Email failure must not turn an already saved booking into a failed checkout.
        pass
    logger.warning("Ticket confirmation email failed for booking %s.", purchase.id)
    return "failed"
