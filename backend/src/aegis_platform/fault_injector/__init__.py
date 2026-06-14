"""Fault injector — deterministic demo world + incident scenario catalog."""

from aegis_platform.fault_injector.faults import FAULTS, Fault
from aegis_platform.fault_injector.world import SimulatedService, build_demo_service

__all__ = ["FAULTS", "Fault", "SimulatedService", "build_demo_service"]
