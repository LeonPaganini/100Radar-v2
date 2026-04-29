from __future__ import annotations
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

STATUS_LABELS = {
    "REGULAR": "Regular ✓",
    "VENCIDO": "Vencido ✗",
    "INDETERMINADO": "Indeterminado",
}
STATUS_COLORS = {
    "REGULAR": colors.HexColor("#166534"),
    "VENCIDO": colors.HexColor("#991b1b"),
    "INDETERMINADO": colors.HexColor("#92400e"),
}


def generate_pdf(query: dict) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=40,
        bottomMargin=40,
        leftMargin=50,
        rightMargin=50,
    )
    styles = getSampleStyleSheet()
    story = []

    # Header
    story.append(Paragraph(
        "<font color='#1e3a5f' size='20'><b>RadarCheck</b></font>",
        styles["Normal"],
    ))
    story.append(Paragraph(
        "<font color='#64748b' size='10'>Relatório Oficial de Consulta de Equipamento</font>",
        styles["Normal"],
    ))
    story.append(Spacer(1, 20))

    # Status destaque
    raw_status = query.get("status_na_data", "INDETERMINADO")
    status_label = STATUS_LABELS.get(raw_status, raw_status)
    status_color = STATUS_COLORS.get(raw_status, colors.grey)
    status_table = Table(
        [[Paragraph(f"<b>Situação na data da infração: {status_label}</b>", styles["Normal"])]],
        colWidths=[495],
    )
    status_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0f4ff")),
        ("TEXTCOLOR", (0, 0), (-1, -1), status_color),
        ("PADDING", (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", [6]),
    ]))
    story.append(status_table)
    story.append(Spacer(1, 20))

    # Dados da consulta
    data = [
        ["Campo", "Valor"],
        ["ID da Consulta", str(query.get("id", "—"))[:8].upper() + "..."],
        ["UF", query.get("uf", "—")],
        ["Número Inmetro", query.get("numero_inmetro") or "—"],
        ["Número de Série", query.get("numero_serie") or "—"],
        ["Data da Infração", str(query.get("data_infracao", "—"))],
        ["Situação na Data", status_label],
        ["Equipamento Encontrado", "Sim" if query.get("site_id") else "Não"],
    ]

    table = Table(data, colWidths=[200, 295])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
    ]))
    story.append(table)
    story.append(Spacer(1, 24))

    # Rodapé legal
    story.append(Paragraph(
        "<font color='#64748b' size='8'>"
        "Este relatório foi gerado automaticamente pelo sistema RadarCheck com base em dados "
        "oficiais do RBMLQ (Rede Brasileira de Metrologia Legal e Qualidade). "
        "O resultado apresentado é válido para fins de defesa de autuação de trânsito conforme "
        "o Código de Trânsito Brasileiro. Para dúvidas, acesse radarcheck.com.br."
        "</font>",
        styles["Normal"],
    ))

    doc.build(story)
    return buffer.getvalue()
