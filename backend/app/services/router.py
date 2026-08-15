from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import ServiceCategory, City, ServiceZone, Pincode, User
from app.services.schemas import (
    ServiceCategoryOut, CityOut, ServiceZoneOut, PincodeCheckOut,
    ZoneWithPincodesOut, PincodeOut, UpdateActiveIn, CreateZoneIn, CreatePincodeIn,
)
from app.security.deps import get_current_admin
from app.admin.schemas import CreateCategoryIn, CreateCityIn, AdminCategoryOut

router = APIRouter(prefix="/catalog", tags=["Catalog"])


@router.get("/categories")
def list_categories(city_id: Optional[str] = Query(None), all: bool = Query(False), db: Session = Depends(get_db)):
    q = db.query(ServiceCategory)
    if not all:
        q = q.filter(ServiceCategory.is_active.is_(True))
    if city_id:
        from app.database.models import CityCategory
        active_ids = [
            row.category_id for row in
            db.query(CityCategory).filter(CityCategory.city_id == city_id, CityCategory.is_active.is_(True)).all()
        ]
        q = q.filter(ServiceCategory.id.in_(active_ids))
    categories = q.order_by(ServiceCategory.sort_order).all()
    if all:
        # Admin view — includes commission_pct, used by the admin console's
        # category management screen.
        return [
            AdminCategoryOut(
                id=c.id, name=c.name, slug=c.slug, description=c.description,
                base_hourly_rate=float(c.base_hourly_rate), commission_pct=float(c.commission_pct),
                is_active=c.is_active,
            )
            for c in categories
        ]
    return [ServiceCategoryOut.model_validate(c) for c in categories]


@router.post("/categories", status_code=status.HTTP_201_CREATED)
def create_category(payload: CreateCategoryIn, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    category = ServiceCategory(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return {"id": category.id, "name": category.name}


@router.patch("/categories/{category_id}")
def update_category(category_id: str, payload: UpdateActiveIn, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    category = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not category:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    if payload.is_active is not None:
        category.is_active = payload.is_active
    db.commit()
    return {"id": category.id, "is_active": category.is_active}


@router.get("/cities", response_model=List[CityOut])
def list_cities(all: bool = Query(False), db: Session = Depends(get_db)):
    q = db.query(City)
    if not all:
        q = q.filter(City.is_active.is_(True))
    return q.all()


@router.post("/cities", status_code=status.HTTP_201_CREATED)
def create_city(payload: CreateCityIn, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    city = City(name=payload.name, state=payload.state)
    db.add(city)
    db.commit()
    db.refresh(city)
    return {"id": city.id, "name": city.name}


@router.patch("/cities/{city_id}/active")
def update_city_active(city_id: str, payload: UpdateActiveIn, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    city = db.query(City).filter(City.id == city_id).first()
    if not city:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "City not found")
    if payload.is_active is not None:
        city.is_active = payload.is_active
    db.commit()
    return {"id": city.id, "is_active": city.is_active}


@router.get("/cities/{city_id}/zones", response_model=List[ZoneWithPincodesOut])
def list_zones(city_id: str, db: Session = Depends(get_db)):
    zones = db.query(ServiceZone).filter(ServiceZone.city_id == city_id, ServiceZone.is_active.is_(True)).all()
    return [
        ZoneWithPincodesOut(id=z.id, name=z.name, is_active=z.is_active, pincodes=[PincodeOut(id=p.id, code=p.code) for p in z.pincodes])
        for z in zones
    ]


@router.post("/zones", status_code=status.HTTP_201_CREATED)
def create_zone(payload: CreateZoneIn, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    zone = ServiceZone(city_id=payload.city_id, name=payload.name)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return {"id": zone.id, "name": zone.name}


@router.post("/pincodes", status_code=status.HTTP_201_CREATED)
def create_pincode(payload: CreatePincodeIn, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    pincode = Pincode(code=payload.code, service_zone_id=payload.service_zone_id)
    db.add(pincode)
    db.commit()
    db.refresh(pincode)
    return {"id": pincode.id, "code": pincode.code}


@router.get("/pincode-check/{code}", response_model=PincodeCheckOut)
def check_pincode(code: str, db: Session = Depends(get_db)):
    pincode = db.query(Pincode).filter(Pincode.code == code).first()
    if not pincode or not pincode.service_zone.is_active:
        return PincodeCheckOut(serviceable=False)
    zone = pincode.service_zone
    return PincodeCheckOut(serviceable=True, city=zone.city.name, zone=zone.name)
