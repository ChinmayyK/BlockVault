from reportlab.pdfgen import canvas

def create_pdf(path):
    c = canvas.Canvas(path)
    c.drawString(100, 750, "CONFIDENTIAL DOCUMENT")
    c.drawString(100, 700, "Employee: John Doe")
    c.drawString(100, 680, "Email: john.doe@example.com")
    c.drawString(100, 660, "Phone: 555-123-4567")
    c.drawString(100, 640, "SSN: 123-45-6789")
    c.drawString(100, 620, "Credit Card: 4111-2222-3333-4444")
    c.save()

create_pdf("PII_Test.pdf")
