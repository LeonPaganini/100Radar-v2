from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import Settings, parse_cors_origins
from app.main import create_app


def test_parse_cors_origins_json_array_valido() -> None:
    origins = parse_cors_origins('["https://one00radar-v2-mt38.onrender.com","http://localhost:5173"]')
    assert origins == ["https://one00radar-v2-mt38.onrender.com", "http://localhost:5173"]


def test_parse_cors_origins_csv_valido() -> None:
    origins = parse_cors_origins("https://one00radar-v2-mt38.onrender.com,http://localhost:5173")
    assert origins == ["https://one00radar-v2-mt38.onrender.com", "http://localhost:5173"]


def test_parse_cors_origins_string_unica_valida() -> None:
    origins = parse_cors_origins("https://one00radar-v2-mt38.onrender.com")
    assert origins == ["https://one00radar-v2-mt38.onrender.com"]


def test_parse_cors_origins_remove_barra_final() -> None:
    origins = parse_cors_origins("https://one00radar-v2-mt38.onrender.com/")
    assert origins == ["https://one00radar-v2-mt38.onrender.com"]


def test_parse_cors_origins_string_vazia() -> None:
    assert parse_cors_origins("") == []


def test_parse_cors_origins_rejeita_wildcard() -> None:
    try:
        parse_cors_origins("*")
    except ValueError as exc:
        assert "wildcard" in str(exc).lower()
    else:
        raise AssertionError("Era esperado ValueError para wildcard")


def test_settings_env_json_array() -> None:
    settings = Settings(CORS_ALLOW_ORIGINS='["https://one00radar-v2-mt38.onrender.com","http://localhost:5173"]')
    assert settings.cors_allow_origins == ["https://one00radar-v2-mt38.onrender.com", "http://localhost:5173"]


def test_settings_env_csv() -> None:
    settings = Settings(CORS_ALLOW_ORIGINS="https://one00radar-v2-mt38.onrender.com,http://localhost:5173")
    assert settings.cors_allow_origins == ["https://one00radar-v2-mt38.onrender.com", "http://localhost:5173"]


def test_invalid_query_id_returns_422_without_supabase_call(monkeypatch) -> None:
    app = create_app()
    client = TestClient(app)

    def fail_get_db():
        raise AssertionError("Supabase não deveria ser consultado para query_id inválido")

    monkeypatch.setattr("app.api.v1.consulta.get_db", fail_get_db)

    res = client.get("/v1/consulta/precheck'")
    assert res.status_code == 422
    assert res.json() == {"detail": {"error": {"code": "invalid_query_id", "message": "query_id inválido"}}}


def test_preflight_cors_precheck() -> None:
    app = create_app()
    client = TestClient(app)

    res = client.options(
        "/v1/consulta/precheck",
        headers={
            "Origin": "https://one00radar-v2-mt38.onrender.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "https://one00radar-v2-mt38.onrender.com"
