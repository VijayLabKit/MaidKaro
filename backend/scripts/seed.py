"""
Seeds launch data: Siliguri as the first city, a starter set of
service categories, one service zone + pincode, and a super-admin
account.

Run:  python scripts/seed.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal, Base, engine
from app.database.models import (
    City, ServiceZone, Pincode, ServiceCategory, CityCategory,
    User, Role, AdminProfile,
)
from app.security.security import hash_password

CATEGORIES = [
    ("Home Cleaning", "home-cleaning", "Deep cleaning for kitchens, bathrooms, and living spaces.", 249.0),
    ("Cooking Help", "cooking-help", "Daily or occasional cooking assistance in your kitchen.", 229.0),
    ("Elderly Care", "elderly-care", "Compassionate, trained companions for elderly family members.", 349.0),
    ("Baby Sitting", "baby-sitting", "Verified, background-checked childcare support.", 299.0),
    ("Laundry & Ironing", "laundry-ironing", "Washing, drying, and ironing at your home.", 199.0),
]

SILIGURI_PINCODES = ["734001", "734003", "734004", "734005", "734006"]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        city = db.query(City).filter(City.name == "Siliguri").first()
        if not city:
            city = City(name="Siliguri", state="West Bengal")
            db.add(city)
            db.flush()
            print(f"Created city: Siliguri ({city.id})")

        zone = db.query(ServiceZone).filter(ServiceZone.city_id == city.id).first()
        if not zone:
            zone = ServiceZone(city_id=city.id, name="Siliguri - Core Launch Zone")
            db.add(zone)
            db.flush()
            print(f"Created zone: {zone.name}")

        for code in SILIGURI_PINCODES:
            if not db.query(Pincode).filter(Pincode.code == code).first():
                db.add(Pincode(code=code, service_zone_id=zone.id))
                print(f"  + pincode {code}")

        for name, slug, desc, rate in CATEGORIES:
            category = db.query(ServiceCategory).filter(ServiceCategory.slug == slug).first()
            if not category:
                category = ServiceCategory(name=name, slug=slug, description=desc, base_hourly_rate=rate)
                db.add(category)
                db.flush()
                print(f"Created category: {name} (₹{rate}/hr)")
            if not db.query(CityCategory).filter(CityCategory.city_id == city.id, CityCategory.category_id == category.id).first():
                db.add(CityCategory(city_id=city.id, category_id=category.id))

        admin_email = "admin@maidkaro.com"
        if not db.query(AdminProfile).filter(AdminProfile.email == admin_email).first():
            admin_user = User(phone="+910000000000", role=Role.SUPER_ADMIN)
            db.add(admin_user)
            db.flush()
            db.add(AdminProfile(
                user_id=admin_user.id, full_name="MaidKaro Super Admin",
                email=admin_email, password_hash=hash_password("ChangeMe123!"),
            ))
            print(f"Created super-admin: {admin_email} / ChangeMe123! (CHANGE THIS IMMEDIATELY)")

        db.commit()
        print("\nSeed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
