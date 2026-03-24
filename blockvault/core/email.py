"""
Email delivery module for BlockVault.

Supports SendGrid (preferred) and SMTP fallback.
If neither is configured, logs the magic link to the console (dev mode).
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from flask import current_app

logger = logging.getLogger(__name__)


def _sendgrid_send(to: str, subject: str, html: str) -> bool:
    """Send via SendGrid Web API v3."""
    try:
        import sendgrid  # type: ignore
        from sendgrid.helpers.mail import Mail, Email, To, Content  # type: ignore
    except ImportError:
        logger.warning("sendgrid package not installed — pip install sendgrid")
        return False

    api_key = current_app.config.get("SENDGRID_API_KEY")
    if not api_key:
        return False

    from_email = current_app.config.get("EMAIL_FROM", "noreply@blockvault.io")
    sg = sendgrid.SendGridAPIClient(api_key=api_key)
    message = Mail(
        from_email=Email(from_email, "BlockVault"),
        to_emails=To(to),
        subject=subject,
        html_content=Content("text/html", html),
    )
    try:
        response = sg.send(message)
        logger.info("SendGrid email sent to %s — status %s", to, response.status_code)
        return 200 <= response.status_code < 300
    except Exception as exc:
        logger.error("SendGrid send failed: %s", exc)
        return False


def _smtp_send(to: str, subject: str, html: str) -> bool:
    """Send via SMTP."""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    host = current_app.config.get("SMTP_HOST")
    if not host:
        return False

    port = int(current_app.config.get("SMTP_PORT", 587))
    user = current_app.config.get("SMTP_USER")
    password = current_app.config.get("SMTP_PASS")
    from_email = current_app.config.get("EMAIL_FROM", "noreply@blockvault.io")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"BlockVault <{from_email}>"
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(host, port) as server:
            server.ehlo()
            if port != 25:
                server.starttls()
            if user and password:
                server.login(user, password)
            server.sendmail(from_email, [to], msg.as_string())
        logger.info("SMTP email sent to %s via %s:%d", to, host, port)
        return True
    except Exception as exc:
        logger.error("SMTP send failed: %s", exc)
        return False


def _build_magic_link_html(
    recipient_email: str,
    sender_display: str,
    file_name: str,
    magic_link: str,
) -> str:
    """Return branded HTML email body."""
    return f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#111118;border-radius:12px;border:1px solid #1e1e2e;overflow:hidden;">
        <!-- Header -->
        <tr><td style="padding:32px 32px 0;text-align:center;">
          <div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:12px;line-height:48px;font-size:20px;color:#fff;">🔒</div>
          <h1 style="color:#ffffff;font-size:20px;margin:16px 0 4px;">Secure File Access</h1>
          <p style="color:#71717a;font-size:14px;margin:0;">from BlockVault</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:24px 32px;">
          <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 16px;">
            <strong style="color:#e4e4e7;">{sender_display}</strong> has shared a secure file with you:
          </p>
          <div style="background:#1a1a24;border:1px solid #27272a;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
            <p style="color:#e4e4e7;font-size:14px;margin:0;font-weight:600;">📄 {file_name}</p>
          </div>
          <a href="{magic_link}" style="display:block;text-align:center;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;">
            Open Secure File →
          </a>
          <p style="color:#52525b;font-size:12px;margin:20px 0 0;line-height:1.5;">
            This link grants one-time access and will expire. Do not share it — the encryption key is embedded in the link.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #1e1e2e;">
          <p style="color:#3f3f46;font-size:11px;margin:0;">Secured by BlockVault · End-to-end encrypted</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _sanitize_url(url: str) -> str:
    """Strip URL fragment to prevent logging the recipient_secret."""
    if "#" in url:
        return url.split("#")[0] + "#[REDACTED]"
    return url


def send_magic_link_email(
    to_email: str,
    sender_address: str,
    file_name: str,
    magic_link_url: str,
) -> bool:
    """Send a magic-link email to a share recipient.

    Tries SendGrid first, then SMTP, then falls back to console logging.
    Returns True if delivery succeeded (or was logged in dev).
    """
    # Truncate wallet address for display
    sender_display = f"{sender_address[:6]}…{sender_address[-4:]}" if len(sender_address) > 10 else sender_address

    subject = "Secure File Access – BlockVault"
    html = _build_magic_link_html(to_email, sender_display, file_name, magic_link_url)

    # Try SendGrid
    if current_app.config.get("SENDGRID_API_KEY"):
        return _sendgrid_send(to_email, subject, html)

    # Try SMTP
    if current_app.config.get("SMTP_HOST"):
        return _smtp_send(to_email, subject, html)

    # Dev fallback: print to console (with sanitized URL — fragment stripped)
    safe_url = _sanitize_url(magic_link_url)
    logger.warning(
        "📧 No email provider configured. Magic link for %s:\n\n  %s\n",
        to_email,
        safe_url,
    )
    # Also print the full URL to stdout for dev testing (not via logger)
    print(f"\n🔗 MAGIC LINK (dev only): {magic_link_url}\n")
    return True
