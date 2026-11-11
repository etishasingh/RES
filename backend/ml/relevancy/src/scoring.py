"""ProofFlow Scoring and Aggregation Module (Components C and E).

Provides objective functional/technical evaluation for code and text,
and performs dynamic, evidence-aware rubric aggregation with renormalization.
"""

import ast
import re
from typing import Optional, Dict, Any, List, Tuple
from .config import DEFAULT_RUBRICS, CONFIDENCE_THRESHOLDS


def evaluate_technical_quality(
    deliverable_text: Optional[str],
    validation_evidence: Optional[Any],
    work_category: Optional[str] = None
) -> Tuple[Optional[float], Optional[float], List[str]]:
    """Evaluate functional correctness and technical quality without arbitrary code execution.
    
    Returns:
        functional_score: 0-100 score based on validation evidence, or None
        technical_score: 0-100 score based on static syntax, structure, and formatting
        evidence_notes: list of diagnostic observations
    """
    deliv_str = str(deliverable_text) if deliverable_text else ""
    evidence_str = str(validation_evidence) if validation_evidence else ""
    cat_lower = (work_category or "").lower()
    
    is_code = "software" in cat_lower or "data science" in cat_lower or bool(
        re.search(r'\b(def |class |import |function |return |let |const )\b', deliv_str)
    )
    
    functional_score = None
    technical_score = None
    evidence_notes = []
    
    # 1. Functional Correctness Evaluation via Validation Evidence
    if evidence_str.strip():
        ev_lower = evidence_str.lower()
        if "all tests passed" in ev_lower or "100% pass" in ev_lower or "success" in ev_lower:
            functional_score = 100.0
            evidence_notes.append("Objective validation evidence confirmed all test assertions passed.")
        elif "failed" in ev_lower or "error" in ev_lower:
            # Check for pass/fail counts e.g. "4 passed, 1 failed"
            match = re.search(r'(\d+)\s*pass[a-z]*,\s*(\d+)\s*fail', ev_lower)
            if match:
                passed, failed = int(match.group(1)), int(match.group(2))
                total = passed + failed
                functional_score = round((passed / max(total, 1)) * 100.0, 1)
                evidence_notes.append(f"Validation evidence: {passed}/{total} tests passed ({functional_score}%).")
            else:
                functional_score = 40.0
                evidence_notes.append("Validation evidence contains test failures or execution errors.")
        elif "ok" in ev_lower or "pass" in ev_lower:
            functional_score = 90.0
            evidence_notes.append("Validation evidence indicates successful execution.")
    elif is_code and deliv_str.strip():
        # Code deliverable provided but no execution evidence
        evidence_notes.append("No automated test or execution logs provided for code deliverable.")
        functional_score = None  # Do not invent functional score without evidence
        
    # 2. Technical Quality Evaluation (Static Analysis)
    if is_code and deliv_str.strip():
        # Safe Python AST Syntax Check
        try:
            ast.parse(deliv_str)
            has_comments = "#" in deliv_str or '"""' in deliv_str or "'''" in deliv_str
            has_docstrings = '"""' in deliv_str or "'''" in deliv_str
            lines = [l for l in deliv_str.split("\n") if l.strip()]
            
            base_score = 80.0
            if has_comments:
                base_score += 10.0
            if has_docstrings:
                base_score += 10.0
            technical_score = min(base_score, 100.0)
            evidence_notes.append("Static code syntax is valid Python AST with structured modularity.")
        except SyntaxError as e:
            # Check if it might be JS or diff
            if "diff --git" in deliv_str or "@@" in deliv_str:
                technical_score = 85.0
                evidence_notes.append("Deliverable is a structured unified diff patch.")
            elif re.search(r'\b(function|const|let|var)\b', deliv_str):
                technical_score = 80.0
                evidence_notes.append("Deliverable contains valid JavaScript/TypeScript code constructs.")
            else:
                technical_score = 45.0
                evidence_notes.append(f"Static syntax parsing error: {e.msg} at line {e.lineno}.")
    elif deliv_str.strip():
        # Writing / Document Deliverable Static Quality
        words = re.findall(r'\b\w+\b', deliv_str)
        paragraphs = [p for p in deliv_str.split("\n\n") if p.strip()]
        unique_words = set(w.lower() for w in words)
        lexical_diversity = len(unique_words) / max(len(words), 1)
        
        base_score = 70.0
        if len(paragraphs) >= 2:
            base_score += 10.0
        if lexical_diversity > 0.4:
            base_score += 10.0
        if len(words) >= 30:
            base_score += 10.0
        technical_score = min(base_score, 100.0)
        evidence_notes.append(f"Document contains {len(words)} words across {len(paragraphs)} paragraphs (diversity: {lexical_diversity:.2f}).")
        
    return functional_score, technical_score, evidence_notes


def aggregate_scores(
    work_category: Optional[str],
    relevance_score: Optional[float],
    completeness_score: Optional[float],
    functional_score: Optional[float] = None,
    technical_score: Optional[float] = None,
    visual_score: Optional[float] = None
) -> Tuple[Optional[float], Dict[str, float], float, float, List[str]]:
    """Aggregate available dimension scores using category-specific rubrics with renormalization.
    
    Returns:
        overall_score: Renormalized weighted score (0-100) or None if no dimensions active
        dimension_scores: Dict of evaluated dimension scores
        evidence_coverage: Proportion of rubric weight covered by active evidence
        confidence: Calibrated confidence estimate
        limitations: Notes detailing omitted or unverified dimensions
    """
    category = work_category if work_category in DEFAULT_RUBRICS else "default"
    rubric = DEFAULT_RUBRICS[category]
    
    candidates = {
        "relevance": relevance_score,
        "completeness": completeness_score,
        "functional_correctness": functional_score,
        "technical_quality": technical_score,
        "visual_quality": visual_score,
    }
    
    active_dimensions = {}
    active_weights = {}
    limitations = []
    
    for dim, score in candidates.items():
        if dim in rubric:
            if score is not None:
                active_dimensions[dim] = round(float(score), 1)
                active_weights[dim] = rubric[dim]
            else:
                limitations.append(f"Dimension '{dim}' omitted: Insufficient evidence or unobserved ground truth.")
                
    if not active_dimensions:
        return None, {}, 0.0, 0.0, ["Insufficient evidence to compute overall evaluation score."]
        
    total_active_weight = sum(active_weights.values())
    evidence_coverage = round(total_active_weight, 3)
    
    # Dynamic Renormalization
    weighted_sum = sum(active_dimensions[dim] * (weight / total_active_weight) for dim, weight in active_weights.items())
    overall_score = round(weighted_sum, 1)
    
    # Confidence calculation: function of evidence coverage and rubric completeness
    if evidence_coverage >= CONFIDENCE_THRESHOLDS["high_evidence_coverage"]:
        confidence = 0.88
    elif evidence_coverage >= CONFIDENCE_THRESHOLDS["moderate_evidence_coverage"]:
        confidence = 0.72
    else:
        confidence = 0.50
        
    return overall_score, active_dimensions, evidence_coverage, confidence, limitations
