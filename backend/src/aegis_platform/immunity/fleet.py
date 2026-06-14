"""FleetImmunity — learn antibodies, vaccinate new services, herd-respond across the fleet.

This is the compounding moat: value grows with #services x #incidents. One service's
incident immunizes the whole fleet.
"""

from __future__ import annotations

from collections.abc import Iterable

from aegis_platform.common.schemas import (
    Antibody,
    Incident,
    IncidentClass,
    RemediationAction,
    ServiceRef,
)
from aegis_platform.immunity.generalizer import Generalizer
from aegis_platform.immunity.signature import applies_to
from aegis_platform.immunity.store import IncidentKB


class FleetImmunity:
    def __init__(self, kb: IncidentKB | None = None, generalizer: Generalizer | None = None) -> None:
        self.kb = kb or IncidentKB()
        self.generalizer = generalizer or Generalizer()

    def learn(
        self,
        incident: Incident,
        action: RemediationAction,
        service: ServiceRef,
        confidence: float = 0.7,
    ) -> Antibody:
        antibody = self.generalizer.generalize(incident, action, service, confidence=confidence)
        self.kb.add(antibody)
        return antibody

    def match(self, incident: Incident, service: ServiceRef) -> Antibody | None:
        """Known antibody for this incident on this service — skip diagnosis if found."""
        candidates = self.kb.find_matching(incident.incident_class, service.capabilities)
        return candidates[0] if candidates else None

    def vaccinate(self, service: ServiceRef) -> list[Antibody]:
        """On register: every antibody applicable to this service (detectors to install)."""
        return [ab for ab in self.kb.all() if applies_to(ab, service)]

    def herd_targets(
        self, antibody: Antibody, services: Iterable[ServiceRef]
    ) -> list[ServiceRef]:
        """Other susceptible services to fan an antibody out to (excludes the source)."""
        return [
            s for s in services if s.id != antibody.source_service_id and applies_to(antibody, s)
        ]

    def coverage(self, service: ServiceRef, universe: Iterable[IncidentClass]) -> float:
        """Fraction of the failure-class universe this service is immunized against."""
        universe_set = set(universe)
        if not universe_set:
            return 0.0
        covered = {ab.incident_class for ab in self.kb.all() if applies_to(ab, service)}
        return len(covered & universe_set) / len(universe_set)
