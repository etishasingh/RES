"""ProofFlow Multimodal Evaluation Model Package.

A production-oriented system for evaluating how well a freelancer's deliverable
satisfies a client's request across software, writing, data science, and UI/UX tasks.
"""

from .inference import evaluate_deliverable, ProofFlowEvaluator
from .vlm_adapter import VLMAdapter
from .preprocessing import FeatureExtractor
from .requirements_assessment import parse_requirements, assess_requirements
from .scoring import evaluate_technical_quality, aggregate_scores
from .config import DEFAULT_RUBRICS, MODEL_DEFAULTS

__version__ = "1.0.0"
__all__ = [
    "evaluate_deliverable",
    "ProofFlowEvaluator",
    "VLMAdapter",
    "FeatureExtractor",
    "parse_requirements",
    "assess_requirements",
    "evaluate_technical_quality",
    "aggregate_scores",
    "DEFAULT_RUBRICS",
    "MODEL_DEFAULTS",
]
