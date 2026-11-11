"""ProofFlow Inference Module.

Main entry point for evaluating client deliverables against project requests.
Integrates text relevance ML models, requirement parsers, static technical analyzers,
and optional VLM adapters into a unified evidence-grounded assessment.
"""

import os
import json
from typing import Optional, Dict, Any, List
import joblib

from .config import DEFAULT_RUBRICS, MODEL_DEFAULTS
from .preprocessing import FeatureExtractor
from .requirements_assessment import parse_requirements, assess_requirements
from .scoring import evaluate_technical_quality, aggregate_scores
from .vlm_adapter import VLMAdapter


class ProofFlowEvaluator:
    """Production evaluation pipeline coordinating Components A, B, C, D, and E."""
    
    def __init__(self, model_dir: Optional[str] = None):
        self.model_dir = model_dir or os.path.join(os.path.dirname(__file__), "..", "models")
        self.model_path = os.path.join(self.model_dir, "relevance_model.joblib")
        self.vectorizer_path = os.path.join(self.model_dir, "tfidf_vectorizer.joblib")
        
        # Load artifacts if available
        self.model = None
        self.feature_extractor = None
        self._load_artifacts()
        
    def _load_artifacts(self):
        """Safely load trained ML model and preprocessing vectorizer."""
        if os.path.exists(self.model_path) and os.path.exists(self.vectorizer_path):
            try:
                self.model = joblib.load(self.model_path)
                self.feature_extractor = FeatureExtractor.load(self.vectorizer_path)
            except Exception as e:
                # Fallback to initialized extractor if loading fails
                self.model = None
                self.feature_extractor = FeatureExtractor()
        else:
            self.model = None
            self.feature_extractor = FeatureExtractor()

    def evaluate(
        self,
        client_request: str,
        acceptance_criteria: Optional[Any] = None,
        deliverable_text: Optional[str] = None,
        deliverable_path: Optional[str] = None,
        image_path: Optional[str] = None,
        work_category: Optional[str] = None,
        validation_evidence: Optional[Any] = None,
        vlm_adapter: Optional[VLMAdapter] = None
    ) -> Dict[str, Any]:
        """Execute end-to-end multimodal evaluation on a freelancer deliverable."""
        limitations = []
        
        # Handle file-based deliverable path
        actual_deliverable = deliverable_text or ""
        if deliverable_path and not actual_deliverable:
            if os.path.exists(deliverable_path):
                try:
                    with open(deliverable_path, "r", encoding="utf-8", errors="ignore") as f:
                        actual_deliverable = f.read()
                except Exception as e:
                    limitations.append(f"Failed to read deliverable file at '{deliverable_path}': {str(e)}")
            else:
                limitations.append(f"Deliverable path does not exist: {deliverable_path}")
                
        category = work_category or MODEL_DEFAULTS["default_category"]
        
        # Guard against completely empty request
        if not client_request or not str(client_request).strip():
            return {
                "overall_score": None,
                "dimension_scores": {},
                "requirement_assessments": [],
                "evidence_coverage": 0.0,
                "missing_requirements": ["Valid client request specification is required."],
                "improvement_suggestions": ["Provide a complete client request before evaluation."],
                "confidence": 0.0,
                "evaluation_method": "aborted_insufficient_input",
                "limitations": ["No client request text provided."]
            }
            
        # Component A: Parse and Assess Requirements
        requirements = parse_requirements(acceptance_criteria, client_request=client_request)
        
        # Component D: Visual / Multimodal Evaluation
        visual_findings = None
        visual_score = None
        if image_path:
            adapter = vlm_adapter or VLMAdapter(backend="mock")
            visual_res = adapter.evaluate_visual_deliverable(image_path, client_request, [r["description"] for r in requirements])
            if visual_res["visual_evaluated"]:
                visual_findings = visual_res
                visual_score = visual_res["visual_quality_score"]
            limitations.extend(visual_res.get("limitations", []))
        else:
            if category == "UI/UX and graphic design":
                limitations.append("Visual quality evaluation skipped: No deliverable image provided for UI/UX task.")
                
        # Component A: Evaluate requirements against deliverable
        req_assessments, completeness_score, req_coverage, missing_reqs, suggestions = assess_requirements(
            requirements,
            deliverable_text=actual_deliverable,
            validation_evidence=validation_evidence,
            image_findings=visual_findings
        )
        
        # Component B: Text Relevance Regression
        relevance_score = None
        if actual_deliverable and len(actual_deliverable.strip()) >= MODEL_DEFAULTS["min_text_length_for_scoring"]:
            if self.model and self.feature_extractor:
                feats = self.feature_extractor.transform_single(
                    client_request=client_request,
                    acceptance_criteria=acceptance_criteria,
                    deliverable_text=actual_deliverable,
                    work_category=category
                )
                pred = float(self.model.predict(feats)[0])
                relevance_score = round(max(0.0, min(100.0, pred)), 1)
            else:
                # Heuristic text baseline
                relevance_score = completeness_score
        else:
            limitations.append("Deliverable text/code is missing or too short for ML relevance prediction.")
            
        # Component C: Functional and Technical Evaluator
        functional_score, technical_score, tech_notes = evaluate_technical_quality(
            deliverable_text=actual_deliverable,
            validation_evidence=validation_evidence,
            work_category=category
        )
        
        # Component E: Score Aggregation with Dynamic Renormalization
        overall_score, dim_scores, evidence_coverage, confidence, agg_limits = aggregate_scores(
            work_category=category,
            relevance_score=relevance_score,
            completeness_score=completeness_score if actual_deliverable or validation_evidence else None,
            functional_score=functional_score,
            technical_score=technical_score,
            visual_score=visual_score
        )
        limitations.extend(agg_limits)
        
        # Determine evaluation method description
        methods = []
        if self.model and relevance_score is not None:
            methods.append("supervised_ml_relevance")
        if functional_score is not None:
            methods.append("objective_validation_evidence")
        if technical_score is not None:
            methods.append("static_code_or_text_analysis")
        if visual_score is not None:
            methods.append("vlm_multimodal_adapter")
        methods.append("criterion_level_rules")
        evaluation_method = " + ".join(methods)
        
        return {
            "overall_score": overall_score,
            "dimension_scores": dim_scores,
            "requirement_assessments": req_assessments,
            "evidence_coverage": evidence_coverage,
            "missing_requirements": missing_reqs,
            "improvement_suggestions": suggestions,
            "confidence": confidence,
            "evaluation_method": evaluation_method,
            "limitations": list(dict.fromkeys(limitations))  # deduplicate limitations
        }


# Global singleton instance for module-level evaluate_deliverable function
_evaluator_instance = None

def evaluate_deliverable(
    client_request: str,
    acceptance_criteria: Optional[Any] = None,
    deliverable_text: Optional[str] = None,
    deliverable_path: Optional[str] = None,
    image_path: Optional[str] = None,
    work_category: Optional[str] = None,
    validation_evidence: Optional[Any] = None,
    vlm_adapter: Optional[VLMAdapter] = None,
    model_dir: Optional[str] = None
) -> Dict[str, Any]:
    """Top-level inference function matching ProofFlow evaluation specification.
    
    Args:
        client_request: Original task description or project brief.
        acceptance_criteria: Testable criteria list or structured text.
        deliverable_text: Submitted code, article, summary, or text.
        deliverable_path: Optional file path to deliverable.
        image_path: Optional path to screenshot or design artifact.
        work_category: Domain classification (e.g., Software, Writing, UI/UX).
        validation_evidence: Objective test output, linter results, or benchmark logs.
        vlm_adapter: Optional custom or configured VLMAdapter instance.
        model_dir: Optional directory containing trained model artifacts.
        
    Returns:
        Structured evaluation dictionary conforming to output schema.
    """
    global _evaluator_instance
    if _evaluator_instance is None or model_dir is not None:
        _evaluator_instance = ProofFlowEvaluator(model_dir=model_dir)
        
    return _evaluator_instance.evaluate(
        client_request=client_request,
        acceptance_criteria=acceptance_criteria,
        deliverable_text=deliverable_text,
        deliverable_path=deliverable_path,
        image_path=image_path,
        work_category=work_category,
        validation_evidence=validation_evidence,
        vlm_adapter=vlm_adapter
    )
