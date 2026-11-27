"""Send a sync report to the configured iCloud mailbox."""

import json
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage


def main():
    address = os.environ.get("SYNC_ICLOUD_ADDRESS", "").strip()
    password = os.environ.get("SYNC_ICLOUD_APP_PASSWORD", "").strip()
    if not address or not password:
        print("iCloud 发信 Secrets 尚未填齐。", file=sys.stderr)
        return 1

    report = json.load(sys.stdin.buffer)
    message = EmailMessage()
    message["From"] = address
    message["To"] = address
    message["Subject"] = report["subject"]
    message.set_content(report["text"])

    try:
        with smtplib.SMTP("smtp.mail.me.com", 587, timeout=20) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            smtp.login(address, password)
            smtp.send_message(message)
    except smtplib.SMTPAuthenticationError:
        print("iCloud SMTP 认证失败，请核对邮箱和 App 专用密码。", file=sys.stderr)
        return 1
    except smtplib.SMTPResponseException as error:
        print(f"iCloud SMTP 拒绝请求（代码 {error.smtp_code}）。", file=sys.stderr)
        return 1
    except (OSError, smtplib.SMTPException):
        print("无法连接 iCloud SMTP 或提交邮件。", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
