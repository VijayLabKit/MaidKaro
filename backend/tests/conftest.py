import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DATABASE_URL"] = "sqlite:///./test_maidkaro.db"
os.environ["JWT_SECRET_KEY"] = "test-secret"
os.environ["ADMIN_JWT_SECRET_KEY"] = "test-admin-secret"
os.environ["SMS_PROVIDER"] = "dev_logger"

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, engine, SessionLocal
from app.database.models import City, ServiceCategory, CityCategory, ServiceZone, Pincode


@pytest.fixture(scope="session", autouse=True)
def _setup_db():
    if os.path.exists("test_maidkaro.db"):
        os.remove("test_maidkaro.db")
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("test_maidkaro.db"):
        os.remove("test_maidkaro.db")


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def seeded_catalog():
    db = SessionLocal()
    city = City(name="TestCity", state="Test State")
    db.add(city); db.flush()
    zone = ServiceZone(city_id=city.id, name="Test Zone")
    db.add(zone); db.flush()
    db.add(Pincode(code="700001", service_zone_id=zone.id))
    category = ServiceCategory(name="Test Cleaning", slug="test-cleaning", description="test", base_hourly_rate=200)
    db.add(category); db.flush()
    db.add(CityCategory(city_id=city.id, category_id=category.id))
    db.commit()
    ids = {"city_id": city.id, "category_id": category.id}
    db.close()
    return ids
