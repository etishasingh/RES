"""ProofFlow Configuration Module.

Defines category-specific evaluation rubrics, dimension weights, status mappings,
and operational thresholds.
"""

from typing import Dict, Any

DEFAULT_RUBRICS: Dict[str, Dict[str, float]] = {
    "Websites and software development": {
        "functional_correctness": 0.40,
        "technical_quality": 0.25,
        "relevance": 0.20,
        "completeness": 0.15,
    },
    "Data analysis and data science": {
        "functional_correctness": 0.40,
        "technical_quality": 0.25,
        "relevance": 0.20,
        "completeness": 0.15,
    },
    "Writing and content creation": {
        "relevance": 0.40,
        "completeness": 0.35,
        "technical_quality": 0.25,
    },
    "Documents and presentations": {
        "relevance": 0.40,
        "completeness": 0.35,
        "technical_quality": 0.25,
    },
    "UI/UX and graphic design": {
        "visual_quality": 0.40,
        "relevance": 0.30,
        "completeness": 0.30,
    },
    "General digital freelance work": {
        "relevance": 0.40,
        "completeness": 0.35,
        "technical_quality": 0.25,
    },
    "default": {
        "relevance": 0.40,
        "completeness": 0.35,
        "technical_quality": 0.25,
    },
}

STATUS_WEIGHTS: Dict[str, float] = {
    "satisfied": 1.0,
    "partially_satisfied": 0.5,
    "not_satisfied": 0.0,
    "unverified": 0.0,
}

CONFIDENCE_THRESHOLDS: Dict[str, float] = {
    "high_evidence_coverage": 0.80,
    "moderate_evidence_coverage": 0.50,
}

MODEL_DEFAULTS: Dict[str, Any] = {
    "default_category": "General digital freelance work",
    "min_text_length_for_scoring": 5,
    "max_tfidf_features": 150,
    "random_state": 42,
}
