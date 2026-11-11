"""Schema validation tests for ProofFlow input and output structures."""

import os
import json
import unittest
import sys
import jsonschema

pkg_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if pkg_root not in sys.path:
    sys.path.insert(0, pkg_root)

from src.inference import evaluate_deliverable


class TestProofFlowSchemas(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(pkg_root, "schemas", "input_schema.json"), "r") as f:
            cls.input_schema = json.load(f)
        with open(os.path.join(pkg_root, "schemas", "output_schema.json"), "r") as f:
            cls.output_schema = json.load(f)
            
    def test_example_inputs_match_schema(self):
        for name in ["sample_software_input.json", "sample_writing_input.json", "sample_visual_input.json"]:
            path = os.path.join(pkg_root, "examples", name)
            with open(path, "r") as f:
                data = json.load(f)
            jsonschema.validate(instance=data, schema=self.input_schema)

    def test_example_outputs_match_schema(self):
        for name in ["sample_software_output.json", "sample_writing_output.json", "sample_visual_output.json"]:
            path = os.path.join(pkg_root, "examples", name)
            with open(path, "r") as f:
                data = json.load(f)
            jsonschema.validate(instance=data, schema=self.output_schema)
            
    def test_live_inference_output_conforms_to_schema(self):
        result = evaluate_deliverable(
            client_request="Refactor logging utility to support JSON structured formatting.",
            acceptance_criteria=["Output must be parseable JSON", "Include timestamp and log level fields"],
            deliverable_text="""import json, time

def log_event(level, message):
    return json.dumps({'timestamp': time.time(), 'level': level, 'msg': message})
""",
            work_category="Websites and software development"
        )
        jsonschema.validate(instance=result, schema=self.output_schema)


if __name__ == "__main__":
    unittest.main()
