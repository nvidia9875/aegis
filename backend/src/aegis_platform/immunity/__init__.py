"""Fleet Immunity — Incident KB, antibodies, vaccination, herd response."""

from aegis_platform.immunity.fleet import FleetImmunity
from aegis_platform.immunity.generalizer import Generalizer
from aegis_platform.immunity.signature import applies_to, make_signature
from aegis_platform.immunity.store import IncidentKB

__all__ = ["FleetImmunity", "Generalizer", "IncidentKB", "applies_to", "make_signature"]
