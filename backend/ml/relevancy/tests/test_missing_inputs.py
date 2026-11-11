"""Tests for missing, invalid, and edge-case inputs in ProofFlow."""

import os
import unittest
import sys

pkg_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if pkg_root not in sys.path:
    sys.path.insert(0, pkg_root)

from src.inference import evaluate_deliverable


class TestMissingAndEdgeInputs(unittest.TestCase):
    
    def test_completely_missing_request(self):
        result = evaluate_deliverable(client_request="")
        self.assertIsNone(result["overall_score"])
        self.assertEqual(result["confidence"], 0.0)
        self.assertIn("limitations", result)
        self.assertGreater(len(result["limitations"]), 0)

    def test_missing_deliverable_text(self):
        result = evaluate_deliverable(
            client_request="Create an interactive dashboard with React.",
            acceptance_criteria=["Must render summary charts", "Must allow CSV export"],
            deliverable_text=None,
            work_category="Websites and software development"
        )
        # Should gracefully report missing deliverable and missing requirements
        self.assertIn("limitations", result)
        self.assertIn("missing_requirements", result)
        self.assertGreater(len(result["missing_requirements"]), 0)
        self.assertEqual(result["overall_score"], None)

    def test_missing_acceptance_criteria(self):
        result = evaluate_deliverable(
            client_request="Write a simple REST API in FastAPI with a GET /health endpoint.",
            acceptance_criteria=None,
            deliverable_text="""from fastapi import FastAPI
app = FastAPI()

@app.get('/health')
def health():
    return {'status': 'healthy'}
""",
            work_category="Websites and software development"
        )
        self.assertIsNotNone(result["overall_score"])
        # Should infer candidate criteria from request
        self.assertGreater(len(result["requirement_assessments"]), 0)
        self.assertTrue(result["requirement_assessments"][0]["is_inferred"])

    def test_missing_image_for_ui_task(self):
        result = evaluate_deliverable(
            client_request="Design a sleek mobile sign-in interface.",
            acceptance_criteria=["Email input field", "Sign-in CTA button"],
            deliverable_text="Figma link and CSS design tokens specification.",
            image_path=None,
            work_category="UI/UX and graphic design"
        )
        # Should renormalize across available text dimensions without failing
        self.assertIsNotNone(result["overall_score"])
        self.assertNotIn("visual_quality", result["dimension_scores"])
        self.assertTrue(any("visual" in lim.lower() for lim in result["limitations"]))

    def test_invalid_image_path(self):
        result = evaluate_deliverable(
            client_request="Design landing hero illustration.",
            deliverable_text="Hero banner graphic design.",
            image_path="non_existent_folder/fake_image.png",
            work_category="UI/UX and graphic design"
        )
        self.assertNotIn("visual_quality", result["dimension_scores"])
        self.assertTrue(any("not found" in lim.lower() for lim in result["limitations"]))


if __name__ == "__main__":
    unittest.main()
