"""
PayPilot AI – ProofFlow ML Service Layer.
Lazy-loads and caches the ProofFlow Recommender and Relevancy models.
"""
from __future__ import annotations

import json
import logging
import os
import sys
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
RECOMMENDER_DIR = os.path.join(BACKEND_DIR, "ml", "recommender")
RELEVANCY_DIR = os.path.join(BACKEND_DIR, "ml", "relevancy")

_recommender_instance: Any = None
_recommender_error: Optional[str] = None

_relevancy_fn: Optional[Callable[..., Dict[str, Any]]] = None
_relevancy_schema: Optional[Dict[str, Any]] = None
_relevancy_error: Optional[str] = None


def get_recommender():
    """Lazy-load the ProofFlow Recommender model once and cache it."""
    global _recommender_instance, _recommender_error
    if _recommender_instance is not None:
        return _recommender_instance
    if _recommender_error is not None:
        raise RuntimeError(f"ProofFlow Recommender is unavailable: {_recommender_error}")

    try:
        src_path = os.path.join(RECOMMENDER_DIR, "src")
        if src_path not in sys.path:
            sys.path.insert(0, src_path)

        from proofflow_model import ProofFlowRecommender

        _recommender_instance = ProofFlowRecommender.load(RECOMMENDER_DIR)
        return _recommender_instance
    except Exception as e:
        _recommender_error = str(e)
        logger.exception("Failed to load ProofFlow Recommender")
        raise RuntimeError(f"ProofFlow Recommender failed to load: {e}") from e


def get_relevancy_evaluator() -> Callable[..., Dict[str, Any]]:
    """Lazy-load the ProofFlow Relevancy Evaluator once and cache it."""
    global _relevancy_fn, _relevancy_error
    if _relevancy_fn is not None:
        return _relevancy_fn
    if _relevancy_error is not None:
        raise RuntimeError(f"ProofFlow Relevancy model is unavailable: {_relevancy_error}")

    try:
        if RELEVANCY_DIR not in sys.path:
            sys.path.insert(0, RELEVANCY_DIR)

        from src.inference import ProofFlowEvaluator, evaluate_deliverable

        # Instantiate evaluator to load model artifacts and cache instance
        _ = ProofFlowEvaluator(model_dir=os.path.join(RELEVANCY_DIR, "models"))
        _relevancy_fn = evaluate_deliverable
        return _relevancy_fn
    except Exception as e:
        _relevancy_error = str(e)
        logger.exception("Failed to load ProofFlow Relevancy Evaluator")
        raise RuntimeError(f"ProofFlow Relevancy Evaluator failed to load: {e}") from e


def get_relevancy_schema() -> Dict[str, Any]:
    """Load and cache the JSON input schema for deliverable evaluation."""
    global _relevancy_schema
    if _relevancy_schema is None:
        schema_path = os.path.join(RELEVANCY_DIR, "schemas", "input_schema.json")
        if not os.path.exists(schema_path):
            raise FileNotFoundError(f"Input schema not found at {schema_path}")
        with open(schema_path, "r", encoding="utf-8") as f:
            _relevancy_schema = json.load(f)
    return _relevancy_schema
