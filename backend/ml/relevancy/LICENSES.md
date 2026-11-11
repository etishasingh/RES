# Licenses and Attribution Notes

## ProofFlow Package License
This software package is licensed under the Apache License, Version 2.0 (the "License").
You may obtain a copy of the License at: http://www.apache.org/licenses/LICENSE-2.0

---

## Benchmark Dataset Attributions & Licenses
The trained models and evaluation rubrics incorporate methodology and supervised annotations derived from public research benchmarks:

1. **SummEval**
   - Source: Fabbri et al., *SummEval: Re-evaluating Summarization Evaluation*, TACL 2021.
   - License: MIT License.
   - Use: Human relevance and coherence annotations for document summarization tasks.

2. **HelpSteer2**
   - Source: Wang et al., *HelpSteer2: Open-source dataset for training reward models*, NVIDIA Research, 2024.
   - License: Creative Commons Attribution 4.0 International (CC-BY-4.0).
   - Use: Multi-attribute human ratings of relevance, correctness, and complexity across general instructional tasks.

3. **SWE-bench Lite**
   - Source: Jimenez et al., *SWE-bench: Can Language Models Resolve Real-World GitHub Issues?*, ICLR 2024.
   - License: MIT License.
   - Use: Ground-truth software engineering issue resolution benchmarks and validation test harness evidence structures.

4. **DS-1000**
   - Source: Lai et al., *DS-1000: A Natural and Reliable Benchmark for Data Science Code Generation*, ICML 2023.
   - License: Apache License 2.0.
   - Use: Multi-library data science programming problems with functional test suites.

5. **ScreenSpot**
   - Source: Cheng et al., *SeeClick: Harnessing GUI Grounding for Large Language Models*, 2024.
   - License: Apache License 2.0.
   - Use: GUI grounding and mobile/desktop visual element coordinate matching.

---

## Third-Party Dependencies
- **scikit-learn**: BSD-3-Clause License (Copyright (c) 2007-2024 The scikit-learn developers).
- **joblib**: BSD-3-Clause License (Copyright (c) 2008-2024 Joblib developers).
- **NumPy**: BSD-3-Clause License (Copyright (c) 2005-2024 NumPy Developers).
- **SciPy**: BSD-3-Clause License (Copyright (c) 2001-2024 SciPy Developers).
- **jsonschema**: MIT License (Copyright (c) 2013 Julian Berman).

---

## Artifact Security Notice
Model artifact files (`relevance_model.joblib`, `tfidf_vectorizer.joblib`) are serialized using standard joblib serialization. As with all Python pickle-based formats, model artifacts should only be loaded from verified, trusted sources.
