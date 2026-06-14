"""Antibody signatures + applicability matching across the fleet."""

from __future__ import annotations

from aegis_platform.common.schemas import Antibody, ChangeKind, IncidentClass, ServiceRef


def make_signature(incident_class: IncidentClass, trigger: ChangeKind | None = None) -> str:
    """Normalized failure fingerprint — stable across services so antibodies match."""
    return f"{incident_class.value}|{trigger.value if trigger else 'none'}"


def applies_to(antibody: Antibody, service: ServiceRef) -> bool:
    """An antibody applies if it is universal or shares a capability with the service."""
    if not antibody.applies_to_capabilities:
        return True
    return bool(set(antibody.applies_to_capabilities) & set(service.capabilities))
