from typing import Optional, List
from pydantic import BaseModel


class ServiceCategoryOut(BaseModel):
    id: str
    name: str
    slug: str
    description: str
    icon_url: Optional[str] = None
    base_hourly_rate: float
    is_active: bool

    class Config:
        from_attributes = True


class CityOut(BaseModel):
    id: str
    name: str
    state: str
    is_active: bool

    class Config:
        from_attributes = True


class ServiceZoneOut(BaseModel):
    id: str
    name: str
    is_active: bool

    class Config:
        from_attributes = True


class PincodeCheckOut(BaseModel):
    serviceable: bool
    city: Optional[str] = None
    zone: Optional[str] = None


class PincodeOut(BaseModel):
    id: str
    code: str

    class Config:
        from_attributes = True


class ZoneWithPincodesOut(BaseModel):
    id: str
    name: str
    is_active: bool
    pincodes: List[PincodeOut] = []


class UpdateActiveIn(BaseModel):
    is_active: Optional[bool] = None


class CreateZoneIn(BaseModel):
    city_id: str
    name: str


class CreatePincodeIn(BaseModel):
    code: str
    service_zone_id: str
