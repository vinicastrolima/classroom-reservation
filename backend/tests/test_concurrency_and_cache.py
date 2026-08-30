from unittest.mock import MagicMock, patch
from fastapi import Response

from app.core.cache import cache_delete, cache_get, cache_set, distributed_lock
from app.core.redis import check_redis_health
from app.main import deep_healthcheck


def test_redis_health_fallback():
    """Verify check_redis_health returns valid structure even if redis is unavailable."""
    with patch("app.core.redis.get_redis", return_value=None):
        result = check_redis_health()
        assert "status" in result
        assert "healthy" in result


def test_cache_graceful_degradation():
    """Verify cache helpers do not raise exceptions when Redis is down."""
    with patch("app.core.cache.get_redis", return_value=None):
        assert cache_get("test:key") is None
        assert cache_set("test:key", {"foo": "bar"}) is False
        assert cache_delete("test:key") is False


def test_distributed_lock_fallback():
    """Verify distributed lock falls back gracefully when Redis is unavailable."""
    with patch("app.core.cache.get_redis", return_value=None):
        with distributed_lock("test:resource") as acquired:
            assert acquired is True


def test_deep_healthcheck_endpoint():
    """Verify deep_healthcheck returns structured response with components."""
    response = Response()
    data = deep_healthcheck(response=response)
    assert response.status_code in (200, 503)
    assert "status" in data
    assert "components" in data
    assert "database" in data["components"]
    assert "redis" in data["components"]
    assert "scheduler" in data["components"]
