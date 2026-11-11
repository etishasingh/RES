# ProofFlow — Reusable Multimodal Relevance Evaluation Model Package

**ProofFlow** is a production-oriented AI evaluation framework designed to assess how well a freelancer's completed deliverable satisfies a client's original project request and acceptance criteria.

---

## 1. System Architecture

ProofFlow implements a modular, hybrid architecture combining machine learning, static analysis, objective test evidence verification, and optional Vision-Language Model (VLM) inspection:

```
[ Client Request + Acceptance Criteria + Deliverable Text/Code + Image/Tests ]
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     ▼                           ▼                           ▼
[ Component A ]             [ Component B ]             [ Component C ]
Requirement Parser          Text Relevance ML           Static & Functional
- Structured criteria       - TF-IDF Vectorizer         - Objective test evidence
- Explicit constraints      - Ridge Regressor           - Python AST syntax check
- Explicit vs inferred      - Length/ratio features     - Text quality heuristics
     │                           │                           │
     └───────────────────────────┼───────────────────────────┘
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
               [ Component D ]         [ Component E ]
               Visual / VLM Adapter    Score Aggregator
               - Optional UI/image     - Category rubrics
               - Mock & API backends   - Dynamic renormalization
               - Observable evidence   - Calibrated confidence
                     │                       │
                     └───────────┬───────────┘
                                 ▼
                     [ Structured Output JSON ]
                     - overall_score (0-100)
                     - dimension_scores
                     - requirement_assessments
                     - evidence_coverage
                     - missing_requirements
                     - improvement_suggestions
                     - confidence & limitations
```

### Modular Components
1. **Component A (Requirement Understanding)**: Parses acceptance criteria into structured requirements, extracts constraints (e.g., word count, format, language), and distinguishes explicit from inferred criteria.
2. **Component B (Text Relevance Regressor)**: Preprocesses text into leak-free length ratios and TF-IDF cosine similarities, evaluated by a Ridge regression model trained on human-annotated relevance ratings (Spearman $\rho = 0.323$).
3. **Component C (Functional & Technical Evaluator)**: Evaluates objective validation evidence (pytest / test suite logs) and performs safe Python AST static analysis without executing arbitrary untrusted code.
4. **Component D (Visual / VLM Evaluator)**: Modular interface supporting image inspection for UI/UX tasks. Operates via offline mock verification by default or live VLM APIs (Gemini/OpenAI) when configured via environment variables.
5. **Component E (Score Aggregator)**: Aggregates active dimension scores according to category-specific rubrics. When evidence for a dimension is absent, it dynamically renormalizes across active dimensions and tracks `evidence_coverage`.

---

## 2. Installation

ProofFlow is lightweight, self-contained, and runnable entirely on standard commodity CPUs without GPU acceleration or internet access.

```bash
# Clone or extract package archive
unzip ProofFlow_Multimodal_Model.zip -d ProofFlow_Multimodal_Model
cd ProofFlow_Multimodal_Model

# Install minimum required dependencies
pip install -r requirements.txt
```

---

## 3. Quick Start

```python
from src.inference import evaluate_deliverable

# Example: Evaluating a software bug fix deliverable
result = evaluate_deliverable(
    client_request="Fix the memory leak in the batch processing worker and ensure graceful shutdown when SIGTERM is received.",
    acceptance_criteria=[
        "1. Explicitly clear buffer queues on batch completion.",
        "2. Implement signal handler for SIGTERM to allow in-flight tasks to finish.",
        "3. Provide automated unit tests verifying memory release."
    ],
    deliverable_text="""import signal, gc

class BatchWorker:
    def __init__(self):
        self.buffer = []
        self.running = True
        signal.signal(signal.SIGTERM, self._handle_sigterm)

    def _handle_sigterm(self, signum, frame):
        self.running = False

    def process_batch(self, items):
        try:
            for item in items:
                if not self.running:
                    break
                self.buffer.append(item)
            return len(self.buffer)
        finally:
            self.buffer.clear()
            gc.collect()
""",
    work_category="Websites and software development",
    validation_evidence="pytest tests/test_worker.py: 3 passed, 0 failed in 0.42s (100% pass)."
)

print(f"Overall Score: {result['overall_score']} / 100")
print(f"Evidence Coverage: {result['evidence_coverage'] * 100}%")
print("Dimension Scores:", result['dimension_scores'])
```

---

## 4. Category Rubrics & Dynamic Renormalization

ProofFlow uses tailored evaluation weights depending on the work category:

| Work Category | Relevance | Completeness | Functional | Technical | Visual |
|---|---|---|---|---|---|
| **Software Development** | 0.20 | 0.15 | 0.40 | 0.25 | — |
| **Data Science** | 0.20 | 0.15 | 0.40 | 0.25 | — |
| **Writing & Content** | 0.40 | 0.35 | — | 0.25 | — |
| **Documents & Presentations** | 0.40 | 0.35 | — | 0.25 | — |
| **UI/UX & Graphic Design** | 0.30 | 0.30 | — | — | 0.40 |

### Dynamic Renormalization
If a dimension lacks observable evidence (e.g., an automated test suite was not run, or an image was not supplied for a UI task), ProofFlow **does not assume failure or fabricate scores**. Instead, it excludes the missing dimension and renormalizes the weights strictly across available dimensions, explicitly recording the omission in `limitations` and lowering `evidence_coverage`.

---

## 5. Input and Output Schemas

- **Input Schema**: See `schemas/input_schema.json` for full JSON Schema draft-07 specification.
- **Output Schema**: See `schemas/output_schema.json`.

All output dictionaries adhere strictly to the following top-level structure:
- `overall_score`: Aggregate evaluation score (0-100) or `null`.
- `dimension_scores`: Evaluated dimensions only.
- `requirement_assessments`: Criterion-by-criterion status (`satisfied`, `partially_satisfied`, `not_satisfied`, `unverified`), cited evidence, and rationale.
- `evidence_coverage`: Proportion of rubric supported by concrete evidence (0.0 to 1.0).
- `missing_requirements`: List of requirements not satisfied or unverified.
- `improvement_suggestions`: Actionable recommendations for the freelancer.
- `confidence`: Calibrated uncertainty metric (0.0 to 1.0).
- `evaluation_method`: Trace of components and models utilized.
- `limitations`: List of omitted inputs, unavailable dimensions, and boundary conditions.

---

## 6. Running Automated Tests

Run the test suite using Python's built-in `unittest` runner:

```bash
python -m unittest discover -s tests -p "test_*.py"
```

The test suite covers:
- `test_inference.py`: End-to-end evaluation for software, writing, and visual tasks.
- `test_schemas.py`: Validation against JSON Schema for inputs, outputs, and live results.
- `test_missing_inputs.py`: Edge cases, empty requests, missing images, and unverified states.

---

## 7. Security and MLOps Principles

1. **No Arbitrary Code Execution**: Code deliverables are evaluated via static AST parsing and safe text parsing. Executing untrusted client or freelancer code requires a dedicated sandboxed execution environment outside this package.
2. **No Hardcoded Secrets**: VLM API integrations utilize standard environment variables (`GEMINI_API_KEY`, `OPENAI_API_KEY`).
3. **Offline Readiness**: All classical ML models and static analyzers operate completely locally without external network dependencies.
