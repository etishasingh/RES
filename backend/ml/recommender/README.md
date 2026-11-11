# ProofFlow Hybrid Recommendation Engine Package

Production-grade freelancer opportunity matcher, course recommender, and learning roadmap generator.

## Quickstart Usage

```python
import sys
sys.path.append('src')
from proofflow_model import ProofFlowRecommender

# 1. Load model package
recommender = ProofFlowRecommender.load('.')

# 2. Define freelancer profile
profile = {
    'skills': ['Python', 'SQL', 'Pandas'],
    'experience_level': 'intermediate',
    'career_goals': ['Data Analyst'],
    'preferred_work_type': ['remote'],
    'budget': 0,
    'available_hours_per_week': 8
}

# 3. Generate recommendations
results = recommender.recommend(profile, top_k=5)

# Inspect outputs
print('Top Opportunity:', results['opportunities'][0]['title'])
print('Top Course:', results['courses'][0]['title'])
print('Skill Gaps:', results['skill_gaps'])
print('Roadmap Milestones:', len(results['learning_roadmap']['milestones']))
```