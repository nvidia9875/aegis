"""Statistical anomaly detectors.

- CUSUM: cumulative-sum change-point detection (sustained mean shifts).
- SPRT: Wald's Sequential Probability Ratio Test — decide a mean shift as soon as
  it is statistically significant, with bounded type-I/II error and *without*
  the peeking bias of repeated fixed-n tests.
"""

from __future__ import annotations

import math
from enum import Enum


class CusumDetector:
    """One-sided CUSUM. direction='up' flags increases, 'down' flags decreases."""

    def __init__(self, target: float, slack: float, threshold: float, direction: str = "up") -> None:
        if direction not in ("up", "down"):
            raise ValueError("direction must be 'up' or 'down'")
        self.target = target
        self.slack = slack
        self.threshold = threshold
        self.direction = direction
        self.s = 0.0
        self.triggered = False

    def update(self, x: float) -> bool:
        if self.direction == "up":
            self.s = max(0.0, self.s + (x - (self.target + self.slack)))
        else:
            self.s = max(0.0, self.s + ((self.target - self.slack) - x))
        if self.s > self.threshold:
            self.triggered = True
        return self.triggered

    @property
    def statistic(self) -> float:
        return self.s

    def reset(self) -> None:
        self.s = 0.0
        self.triggered = False


class SprtDecision(str, Enum):
    CONTINUE = "continue"
    ACCEPT_H1 = "accept_h1"   # shift detected (H1: mean == mu1)
    ACCEPT_H0 = "accept_h0"   # baseline holds (H0: mean == mu0)


class SprtDetector:
    """Gaussian SPRT testing H0: mean=mu0 vs H1: mean=mu1 (known sigma)."""

    def __init__(
        self, mu0: float, mu1: float, sigma: float, alpha: float = 0.05, beta: float = 0.05
    ) -> None:
        if sigma <= 0:
            raise ValueError("sigma must be > 0")
        self.mu0 = mu0
        self.mu1 = mu1
        self.sigma = sigma
        self.upper = math.log((1 - beta) / alpha)   # accept H1 above this
        self.lower = math.log(beta / (1 - alpha))    # accept H0 below this
        self.llr = 0.0
        self.decision = SprtDecision.CONTINUE

    def update(self, x: float) -> SprtDecision:
        self.llr += (self.mu1 - self.mu0) / (self.sigma**2) * (x - (self.mu0 + self.mu1) / 2)
        if self.llr >= self.upper:
            self.decision = SprtDecision.ACCEPT_H1
        elif self.llr <= self.lower:
            self.decision = SprtDecision.ACCEPT_H0
        else:
            self.decision = SprtDecision.CONTINUE
        return self.decision

    def reset(self) -> None:
        self.llr = 0.0
        self.decision = SprtDecision.CONTINUE
