from datetime import date
from app.services.gov_json_bypass_service import find_record_by_inmetro_from_json, resolve_status_from_gov_json


def test_ac_inmetro_lookup_and_status():
    data = [{"SiglaUf":"AC","Faixas":[{"NumeroInmetro":"14826019","NumeroSerie":"FLICD2106A00575"}],"Historico":[{"DataLaudo":"03/07/2025","DataValidade":"02/07/2026","Resultado":"Aprovado"}]}]
    rec = find_record_by_inmetro_from_json(data, "AC", "14826019")
    assert rec is not None
    out = resolve_status_from_gov_json(rec["Historico"], date(2026,4,28))
    assert out["status"] == "VALIDO"
