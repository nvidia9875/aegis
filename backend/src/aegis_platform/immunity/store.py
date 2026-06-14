"""Incident Knowledge Base — the shared antibody store (Memory, cross-service).

In-memory by default; an Elasticsearch / Vertex Vector Search adapter can back this
for semantic recall at scale without changing callers.
"""

from __future__ import annotations

from aegis_platform.common.schemas import Antibody, IncidentClass


class IncidentKB:
    def __init__(self) -> None:
        self._by_id: dict[str, Antibody] = {}

    def add(self, antibody: Antibody) -> None:
        self._by_id[antibody.id] = antibody

    def update(self, antibody: Antibody) -> None:
        self._by_id[antibody.id] = antibody

    def get(self, antibody_id: str) -> Antibody | None:
        return self._by_id.get(antibody_id)

    def all(self) -> list[Antibody]:
        return list(self._by_id.values())

    def find_matching(
        self, incident_class: IncidentClass, capabilities: tuple[str, ...]
    ) -> list[Antibody]:
        caps = set(capabilities)
        matches = [
            ab
            for ab in self._by_id.values()
            if ab.incident_class == incident_class
            and (not ab.applies_to_capabilities or caps & set(ab.applies_to_capabilities))
        ]
        return sorted(matches, key=lambda a: a.confidence, reverse=True)

    def record_reuse(self, antibody_id: str, success: bool) -> Antibody:
        """Update reuse stats (immutably) — antibodies that keep working gain confidence."""
        ab = self._by_id[antibody_id]
        n = ab.reuse_count + 1
        success_rate = (ab.success_rate * ab.reuse_count + (1.0 if success else 0.0)) / n
        confidence = min(1.0, ab.confidence + 0.05) if success else ab.confidence
        updated = ab.model_copy(
            update={"reuse_count": n, "success_rate": success_rate, "confidence": confidence}
        )
        self._by_id[antibody_id] = updated
        return updated
