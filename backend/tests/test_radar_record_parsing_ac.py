from app.services.psie_parser import parse_lane_records, parse_site_record, parse_verification_records


def _record():
    return {
      "SiglaUf": "AC", "Municipio": "RIO BRANCO", "LocalVerificacao": "BR 364 KM 124,4 - RIO BRANCO/ACRE",
      "DataUltimaVerificacao": "03/07/2025", "DataValidade": "02/07/2026", "UltimoResultado": "Aprovado",
      "Faixas": [{"NumeroFaixa": "2", "NumeroInmetro": "14826019", "NumeroSerie": "FLICD2106A00575", "Sentido": "CRESCENTE", "VelocidadeNominal": "40"},{"NumeroFaixa": "1", "NumeroInmetro": "14826019", "NumeroSerie": "FLICD2106A00575", "Sentido": "CRESCENTE", "VelocidadeNominal": "40"}],
      "Historico": [{"DataLaudo": "04/07/2024", "DataValidade": "03/07/2025", "Resultado": "Aprovado"},{"DataLaudo": "03/07/2025", "DataValidade": "02/07/2026", "Resultado": "Aprovado"},{"DataLaudo": "10/07/2023", "DataValidade": "09/07/2024", "Resultado": "Aprovado"}],
    }


def test_parse_ac_record():
    rec = _record()
    site = parse_site_record(rec)
    assert site["uf"] == "AC"
    assert site["municipio"] == "RIO BRANCO"
    assert site["local_verificacao"] == "BR 364 KM 124,4 - RIO BRANCO/ACRE"
    assert str(site["data_ultima_verificacao"]) == "2025-07-03"
    assert str(site["data_validade"]) == "2026-07-02"
    assert site["ultimo_resultado"] == "Aprovado"

    lanes = parse_lane_records(rec)
    assert len(lanes) == 2
    assert all(l["numero_inmetro"] == "14826019" for l in lanes)
    assert all(l["numero_inmetro_normalized"] == "14826019" for l in lanes)
    assert all(l["numero_serie"] == "FLICD2106A00575" for l in lanes)
    assert all(l["numero_serie_normalized"] == "FLICD2106A00575" for l in lanes)

    verifications = parse_verification_records(rec)
    assert len(verifications) == 3
    selected = [v for v in verifications if str(v["data_laudo"]) == "2025-07-03"][0]
    assert str(selected["data_validade"]) == "2026-07-02"
    assert selected["resultado"] == "Aprovado"
