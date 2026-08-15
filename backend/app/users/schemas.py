from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


class CustomerProfileOut(BaseModel):
    id: str
    full_name: str
    email: Optional[str] = None
    photo_url: Optional[str] = None
    phone: str

    class Config:
        from_attributes = True


class UpdateCustomerProfileIn(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    photo_url: Optional[str] = None


class AddressIn(BaseModel):
    label: str = Field(..., examples=["Home", "Office"])
    line1: str
    line2: Optional[str] = None
    pincode_code: str = Field(..., min_length=6, max_length=6)
    latitude: float
    longitude: float
    is_default: bool = False


class AddressOut(BaseModel):
    id: str
    label: str
    line1: str
    line2: Optional[str]
    latitude: float
    longitude: float
    is_default: bool

    class Config:
        from_attributes = True


class EmergencyContactIn(BaseModel):
    name: str
    phone: str
    relationship_label: Optional[str] = None


class EmergencyContactOut(EmergencyContactIn):
    id: str

    class Config:
        from_attributes = True
