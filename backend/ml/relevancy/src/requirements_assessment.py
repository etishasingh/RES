"""ProofFlow Requirement Assessment Module (Component A).

Parses client acceptance criteria, extracts explicit constraints, and evaluates
deliverables against structured criteria with evidence-grounded rationales.
"""

import re
from typing import List, Dict, Any, Optional, Tuple


def parse_requirements(
    acceptance_criteria: Optional[Any],
    client_request: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Parse acceptance criteria into structured requirements.
    
    Distinguishes explicit criteria from inferred criteria and identifies
    constraints such as format, technical stack, or length.
    """
    requirements = []
    
    if acceptance_criteria:
        if isinstance(acceptance_criteria, list):
            raw_items = [str(item).strip() for item in acceptance_criteria if str(item).strip()]
        else:
            text = str(acceptance_criteria).strip()
            # Split by numbered lists, bullet points, or newlines
            lines = re.split(r'(?:\r?\n|\n(?=[0-9]+\.|\-|\*|\•)|\b(?=[0-9]+\.\s))', text)
            raw_items = []
            for line in lines:
                cleaned = re.sub(r'^[0-9]+[\.\)\-]\s*|^[\-\*\•]\s*', '', line).strip()
                if cleaned and len(cleaned) > 3:
                    raw_items.append(cleaned)
                    
        for idx, item in enumerate(raw_items, 1):
            is_constraint = bool(re.search(
                r'\b(must|require|shall|strictly|limit|format|word count|only|never|json|python|css|html)\b',
                item, re.IGNORECASE
            ))
            requirements.append({
                "criterion_id": f"CRIT-{idx:02d}",
                "description": item,
                "is_inferred": False,
                "is_constraint": is_constraint,
                "constraint_type": "explicit_rule" if is_constraint else "general_expectation"
            })
            
    # Fallback: If no explicit acceptance criteria provided, infer from client_request
    if not requirements and client_request:
        sentences = [s.strip() for s in re.split(r'[.!?\n]+', str(client_request)) if len(s.strip()) > 10]
        for idx, sentence in enumerate(sentences[:5], 1):
            is_constraint = bool(re.search(
                r'\b(must|require|need|format|limit|use|ensure)\b',
                sentence, re.IGNORECASE
            ))
            requirements.append({
                "criterion_id": f"INF-{idx:02d}",
                "description": sentence,
                "is_inferred": True,
                "is_constraint": is_constraint,
                "constraint_type": "inferred_need"
            })
            
    return requirements


def assess_requirements(
    requirements: List[Dict[str, Any]],
    deliverable_text: Optional[str] = None,
    validation_evidence: Optional[Any] = None,
    image_findings: Optional[Dict[str, Any]] = None
) -> Tuple[List[Dict[str, Any]], float, float, List[str], List[str]]:
    """Assess whether structured requirements are satisfied by deliverable evidence.
    
    Returns:
        assessments: list of requirement evaluation dictionaries
        completeness_score: 0-100 score based on criterion satisfaction
        evidence_coverage: proportion of criteria with observable evidence
        missing_requirements: list of unmet or unverified criteria descriptions
        improvement_suggestions: actionable feedback based on evaluation
    """
    if not requirements:
        return [], 0.0, 0.0, ["No testable requirements provided"], ["Provide clear acceptance criteria"]
        
    deliv_clean = (str(deliverable_text) if deliverable_text else "").lower()
    evidence_clean = (str(validation_evidence) if validation_evidence else "").lower()
    
    assessments = []
    satisfied_weight = 0.0
    evaluated_count = 0
    missing_requirements = []
    improvement_suggestions = []
    
    for req in requirements:
        desc = req["description"]
        desc_lower = desc.lower()
        crit_id = req["criterion_id"]
        words = [w for w in re.findall(r'\b\w{3,}\b', desc_lower) if w not in {'the', 'and', 'for', 'with', 'that', 'this', 'must', 'should'}]
        
        # Check presence in deliverable text or code
        matches = [w for w in words if w in deliv_clean]
        evidence_matches = [w for w in words if w in evidence_clean]
        
        # Check validation evidence (e.g. test pass/fail indicators)
        has_test_pass = "pass" in evidence_clean or "success" in evidence_clean or "ok" in evidence_clean
        has_test_fail = "fail" in evidence_clean or "error" in evidence_clean
        
        # Determine status
        if not deliv_clean and not evidence_clean and not image_findings:
            status = "unverified"
            evidence_snippet = "No deliverable text or validation evidence provided."
            explanation = "Cannot verify requirement without deliverable or execution evidence."
            missing_requirements.append(desc)
            improvement_suggestions.append(f"Submit deliverable or execution evidence demonstrating: '{desc}'.")
        elif has_test_fail and any(w in evidence_clean for w in words):
            status = "not_satisfied"
            evidence_snippet = "Test or validation failure detected in execution evidence."
            explanation = f"Automated validation reported failure relevant to: '{desc}'."
            evaluated_count += 1
            missing_requirements.append(desc)
            improvement_suggestions.append(f"Resolve failing validation checks related to '{desc}'.")
        elif len(words) > 0 and len(matches) / max(len(words), 1) >= 0.5:
            if has_test_pass or "test" not in desc_lower:
                status = "satisfied"
                matched_str = ", ".join(matches[:4])
                evidence_snippet = f"Relevant deliverable content matching keywords: [{matched_str}]."
                explanation = f"Requirement appears substantively addressed in deliverable text/code."
                satisfied_weight += 1.0
                evaluated_count += 1
            else:
                status = "partially_satisfied"
                evidence_snippet = f"Content matched keywords but explicit validation confirmation is absent."
                explanation = f"Deliverable mentions components of '{desc}', but full functional validation is missing."
                satisfied_weight += 0.5
                evaluated_count += 1
                improvement_suggestions.append(f"Provide explicit test or validation evidence verifying '{desc}'.")
        elif len(matches) > 0 or len(evidence_matches) > 0:
            status = "partially_satisfied"
            evidence_snippet = f"Partial keyword overlap detected: [{', '.join(matches or evidence_matches)}]."
            explanation = f"Deliverable partially mentions '{desc}', but evidence is incomplete."
            satisfied_weight += 0.5
            evaluated_count += 1
            missing_requirements.append(desc)
            improvement_suggestions.append(f"Elaborate or implement missing components for: '{desc}'.")
        else:
            status = "not_satisfied"
            evidence_snippet = "No corresponding terms or implementation details found in deliverable."
            explanation = f"Deliverable lacks evidence of addressing requirement: '{desc}'."
            evaluated_count += 1
            missing_requirements.append(desc)
            improvement_suggestions.append(f"Implement required specification: '{desc}'.")
            
        assessments.append({
            "criterion_id": crit_id,
            "description": desc,
            "is_inferred": req.get("is_inferred", False),
            "status": status,
            "evidence": evidence_snippet,
            "explanation": explanation
        })
        
    total_criteria = len(requirements)
    completeness_score = round((satisfied_weight / max(total_criteria, 1)) * 100.0, 1)
    evidence_coverage = round(evaluated_count / max(total_criteria, 1), 3)
    
    return assessments, completeness_score, evidence_coverage, missing_requirements, improvement_suggestions
