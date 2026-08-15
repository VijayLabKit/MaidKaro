from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.database.models import (
    User, Role, CustomerProfile, CustomerAddress, Pincode, EmergencyContact,
)
from app.security.deps import require_roles, get_current_user
from app.users.schemas import (
    CustomerProfileOut, UpdateCustomerProfileIn, AddressIn, AddressOut,
    EmergencyContactIn, EmergencyContactOut,
)

router = APIRouter(prefix="/users", tags=["Users"])


def _get_customer_profile(db: Session, user: User) -> CustomerProfile:
    profile = db.query(CustomerProfile).filter(CustomerProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer profile not found")
    return profile


@router.get("/me", response_model=CustomerProfileOut)
def get_my_profile(user: User = Depends(require_roles(Role.CUSTOMER)), db: Session = Depends(get_db)):
    profile = _get_customer_profile(db, user)
    return CustomerProfileOut(
        id=profile.id, full_name=profile.full_name, email=profile.email,
        photo_url=profile.photo_url, phone=user.phone,
    )


@router.patch("/me", response_model=CustomerProfileOut)
def update_my_profile(
    payload: UpdateCustomerProfileIn,
    user: User = Depends(require_roles(Role.CUSTOMER)),
    db: Session = Depends(get_db),
):
    profile = _get_customer_profile(db, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return CustomerProfileOut(
        id=profile.id, full_name=profile.full_name, email=profile.email,
        photo_url=profile.photo_url, phone=user.phone,
    )


@router.get("/me/addresses", response_model=List[AddressOut])
def list_addresses(user: User = Depends(require_roles(Role.CUSTOMER)), db: Session = Depends(get_db)):
    profile = _get_customer_profile(db, user)
    return profile.addresses


@router.post("/me/addresses", response_model=AddressOut, status_code=status.HTTP_201_CREATED)
def add_address(
    payload: AddressIn,
    user: User = Depends(require_roles(Role.CUSTOMER)),
    db: Session = Depends(get_db),
):
    profile = _get_customer_profile(db, user)
    pincode = db.query(Pincode).filter(Pincode.code == payload.pincode_code).first()
    if not pincode:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "We don't serve this pincode yet")

    if payload.is_default:
        db.query(CustomerAddress).filter(CustomerAddress.customer_id == profile.id).update({"is_default": False})

    address = CustomerAddress(
        customer_id=profile.id, label=payload.label, line1=payload.line1, line2=payload.line2,
        pincode_id=pincode.id, latitude=payload.latitude, longitude=payload.longitude,
        is_default=payload.is_default,
    )
    db.add(address)
    db.commit()
    db.refresh(address)
    return address


@router.delete("/me/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(address_id: str, user: User = Depends(require_roles(Role.CUSTOMER)), db: Session = Depends(get_db)):
    profile = _get_customer_profile(db, user)
    address = db.query(CustomerAddress).filter(
        CustomerAddress.id == address_id, CustomerAddress.customer_id == profile.id,
    ).first()
    if not address:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Address not found")
    db.delete(address)
    db.commit()


# ── Emergency contacts (women-first safety layer) ───────────────────
# Available to both customers and workers — either can add trusted
# contacts who get an SMS the moment an SOS is triggered.

@router.get("/me/emergency-contacts", response_model=List[EmergencyContactOut])
def list_emergency_contacts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(EmergencyContact).filter(EmergencyContact.user_id == user.id).all()


@router.post("/me/emergency-contacts", response_model=EmergencyContactOut, status_code=status.HTTP_201_CREATED)
def add_emergency_contact(payload: EmergencyContactIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing_count = db.query(EmergencyContact).filter(EmergencyContact.user_id == user.id).count()
    if existing_count >= 5:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Maximum 5 emergency contacts allowed")
    contact = EmergencyContact(user_id=user.id, **payload.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/me/emergency-contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_emergency_contact(contact_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contact = db.query(EmergencyContact).filter(
        EmergencyContact.id == contact_id, EmergencyContact.user_id == user.id,
    ).first()
    if not contact:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contact not found")
    db.delete(contact)
    db.commit()
