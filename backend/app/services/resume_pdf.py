from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def render_resume_pdf(profile: dict[str, Any], content: dict[str, Any]) -> bytes:
    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="Section", parent=styles["Heading2"], textColor=colors.HexColor("#2456D6"), spaceBefore=10, spaceAfter=5))
    story = [Paragraph(profile.get("full_name") or "Resume", styles["Title"])]
    contact = " • ".join(filter(None, [profile.get("email"), profile.get("phone"), profile.get("location")]))
    if contact:
        story += [Paragraph(contact, styles["Normal"]), Spacer(1, 6)]
    story += [Paragraph("Professional Summary", styles["Section"]), Paragraph(content.get("professional_summary", ""), styles["BodyText"])]
    if content.get("skills"):
        story += [Paragraph("Skills", styles["Section"]), Paragraph(" • ".join(content["skills"]), styles["BodyText"])]
    for key, title in (("projects", "Projects"), ("internships", "Internships"), ("achievements", "Achievements")):
        if content.get(key):
            story.append(Paragraph(title, styles["Section"]))
            for item in content[key]:
                story.append(Paragraph(f"<b>{item.get('title', '')}</b>", styles["BodyText"]))
                if item.get("description"):
                    story.append(Paragraph(item["description"], styles["BodyText"]))
    doc.build(story)
    return output.getvalue()

