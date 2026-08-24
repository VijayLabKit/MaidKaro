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
    engine.dispose()
    if os.path.exists("test_maidkaro.db"):
        try:
            os.remove("test_maidkaro.db")
        except OSError:
            pass
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists("test_maidkaro.db"):
        try:
            os.remove("test_maidkaro.db")
        except OSError:
            pass


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def seeded_catalog():
    db = SessionLocal()
    city = db.query(City).filter(City.name == "TestCity").first()
    if not city:
        city = City(name="TestCity", state="Test State")
        db.add(city); db.flush()

    zone = db.query(ServiceZone).filter(ServiceZone.city_id == city.id).first()
    if not zone:
        zone = ServiceZone(city_id=city.id, name="Test Zone")
        db.add(zone); db.flush()

    pincode = db.query(Pincode).filter(Pincode.code == "700001").first()
    if not pincode:
        pincode = Pincode(code="700001", service_zone_id=zone.id)
        db.add(pincode); db.flush()

    category = db.query(ServiceCategory).filter(ServiceCategory.slug == "test-cleaning").first()
    if not category:
        category = ServiceCategory(name="Test Cleaning", slug="test-cleaning", description="test", base_hourly_rate=200)
        db.add(category); db.flush()

    city_cat = db.query(CityCategory).filter(CityCategory.city_id == city.id, CityCategory.category_id == category.id).first()
    if not city_cat:
        db.add(CityCategory(city_id=city.id, category_id=category.id))

    db.commit()
    ids = {"city_id": city.id, "category_id": category.id}
    db.close()
    return ids
