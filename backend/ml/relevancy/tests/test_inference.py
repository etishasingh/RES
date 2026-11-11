"""Unit tests for ProofFlow deliverable evaluation inference."""

import os
import unittest
import sys

# Ensure package src is discoverable
pkg_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if pkg_root not in sys.path:
    sys.path.insert(0, pkg_root)

from src.inference import evaluate_deliverable
from src.vlm_adapter import VLMAdapter


class TestProofFlowInference(unittest.TestCase):
    
    def test_software_evaluation(self):
        result = evaluate_deliverable(
            client_request="Write a Python function to compute Fibonacci numbers efficiently.",
            acceptance_criteria=["Must use iterative approach or memoization", "Must handle n=0 and negative inputs"],
            deliverable_text="""def fibonacci(n):
    if n < 0:
        raise ValueError('Negative input not supported')
    if n in (0, 1):
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
""",
            work_category="Websites and software development",
            validation_evidence="pytest: 5 passed in 0.05s"
        )
        self.assertIsNotNone(result["overall_score"])
        self.assertGreater(result["overall_score"], 60.0)
        self.assertIn("functional_correctness", result["dimension_scores"])
        self.assertIn("technical_quality", result["dimension_scores"])
        self.assertIn("relevance", result["dimension_scores"])
        self.assertGreaterEqual(result["evidence_coverage"], 0.8)
        self.assertIsInstance(result["requirement_assessments"], list)
        
    def test_writing_evaluation(self):
        result = evaluate_deliverable(
            client_request="Write an introductory blog post explaining machine learning to business executives.",
            acceptance_criteria=["Avoid technical jargon", "Include real-world ROI examples", "Under 300 words"],
            deliverable_text="""Machine learning allows enterprises to extract actionable insights from data.
By identifying patterns automatically, businesses can optimize supply chains, personalize customer experiences, and detect fraud in real-time.
Organizations adopting predictive analytics typically observe an immediate improvement in operational throughput and cost reduction.
""",
            work_category="Writing and content creation"
        )
        self.assertIsNotNone(result["overall_score"])
        self.assertIn("relevance", result["dimension_scores"])
        self.assertIn("technical_quality", result["dimension_scores"])
        self.assertNotIn("functional_correctness", result["dimension_scores"])
        self.assertIsInstance(result["improvement_suggestions"], list)

    def test_visual_evaluation_with_mock_vlm(self):
        # Create small test image
        img_path = os.path.join(pkg_root, "examples", "mock_dashboard_dark.png")
        result = evaluate_deliverable(
            client_request="Design a sleek dark-mode mobile user profile page.",
            acceptance_criteria=["Profile avatar centered", "Follow button visible", "Dark background"],
            deliverable_text="User profile layout with centered avatar and follow action component.",
            image_path=img_path,
            work_category="UI/UX and graphic design",
            vlm_adapter=VLMAdapter(backend="mock")
        )
        self.assertIsNotNone(result["overall_score"])
        self.assertIn("visual_quality", result["dimension_scores"])
        self.assertEqual(result["dimension_scores"]["visual_quality"], 85.0)


if __name__ == "__main__":
    unittest.main()
