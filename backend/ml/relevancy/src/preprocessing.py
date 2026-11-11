"""ProofFlow Preprocessing and Feature Extraction Module.

Transforms raw input texts (client request, criteria, deliverable) and metadata
into leak-free numerical feature vectors for ML inference.
"""

import re
import numpy as np
from typing import Optional, List, Dict, Any, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import joblib


class FeatureExtractor:
    """Extracts lexical, structural, and semantic similarity features without target leakage."""
    
    FEATURE_NAMES = [
        "sim_req_del",
        "sim_crit_del",
        "req_char_count",
        "del_char_count",
        "req_word_count",
        "del_word_count",
        "ratio_words",
        "criteria_count",
        "is_code",
    ]
    
    def __init__(self, tfidf_vectorizer: Optional[TfidfVectorizer] = None):
        self.tfidf_vectorizer = tfidf_vectorizer or TfidfVectorizer(
            max_features=150,
            stop_words="english",
            ngram_range=(1, 2)
        )
        self.is_fitted = tfidf_vectorizer is not None
        
    def fit(self, text_corpus: List[str]):
        """Fit TF-IDF vectorizer on background corpus (training split only)."""
        clean_corpus = [str(t) for t in text_corpus if t and str(t).strip()]
        if not clean_corpus:
            clean_corpus = ["freelance client request deliverable project requirements"]
        self.tfidf_vectorizer.fit(clean_corpus)
        self.is_fitted = True
        return self
        
    def transform_single(
        self,
        client_request: Optional[str],
        acceptance_criteria: Optional[Any],
        deliverable_text: Optional[str],
        work_category: Optional[str] = None
    ) -> np.ndarray:
        """Transform a single sample into a 2D numpy feature array of shape (1, num_features)."""
        req_str = str(client_request) if client_request else ""
        del_str = str(deliverable_text) if deliverable_text else ""
        
        if isinstance(acceptance_criteria, list):
            crit_str = " ".join([str(c) for c in acceptance_criteria])
            num_crit = len(acceptance_criteria)
        elif acceptance_criteria:
            crit_str = str(acceptance_criteria)
            num_crit = len([c for c in crit_str.split("\n") if c.strip()])
        else:
            crit_str = ""
            num_crit = 0
            
        # Text lengths and ratios
        req_char = float(len(req_str))
        del_char = float(len(del_str))
        req_words = float(len(re.findall(r'\b\w+\b', req_str)))
        del_words = float(len(re.findall(r'\b\w+\b', del_str)))
        ratio_words = req_words / max(del_words, 1.0)
        
        # Code indicator
        is_code = 0.0
        cat_lower = (work_category or "").lower()
        if "software" in cat_lower or "code" in cat_lower or "data science" in cat_lower:
            is_code = 1.0
        elif re.search(r'\b(def |class |import |function |const |let |return |var )\b', del_str):
            is_code = 1.0
            
        # Semantic similarity via TF-IDF
        if self.is_fitted and (req_str.strip() or del_str.strip()):
            vec_req = self.tfidf_vectorizer.transform([req_str])
            vec_del = self.tfidf_vectorizer.transform([del_str])
            vec_crit = self.tfidf_vectorizer.transform([crit_str]) if crit_str.strip() else None
            
            sim_req_del = float(cosine_similarity(vec_req, vec_del)[0, 0]) if del_str.strip() else 0.0
            sim_crit_del = float(cosine_similarity(vec_crit, vec_del)[0, 0]) if (vec_crit is not None and del_str.strip()) else 0.0
        else:
            # Fallback simple Jaccard similarity if vectorizer not available
            words_req = set(re.findall(r'\b\w+\b', req_str.lower()))
            words_del = set(re.findall(r'\b\w+\b', del_str.lower()))
            words_crit = set(re.findall(r'\b\w+\b', crit_str.lower()))
            sim_req_del = len(words_req & words_del) / max(len(words_req | words_del), 1)
            sim_crit_del = len(words_crit & words_del) / max(len(words_crit | words_del), 1) if words_crit else 0.0
            
        features = np.array([
            sim_req_del,
            sim_crit_del,
            req_char,
            del_char,
            req_words,
            del_words,
            ratio_words,
            float(num_crit),
            is_code
        ], dtype=np.float64).reshape(1, -1)
        
        return features

    def save(self, filepath: str):
        """Save feature extractor vectorizer to disk."""
        joblib.dump(self.tfidf_vectorizer, filepath)
        
    @classmethod
    def load(cls, filepath: str) -> "FeatureExtractor":
        """Load feature extractor from disk."""
        tfidf = joblib.load(filepath)
        return cls(tfidf_vectorizer=tfidf)
