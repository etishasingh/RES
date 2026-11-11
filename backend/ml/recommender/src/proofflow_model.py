# PROOFFLOW RECOMMENDATION ENGINE - STANDALONE MODULE
# Auto-generated from ProofFlow_Recommendation_Model.ipynb
import os
import re
import json
from collections import Counter, defaultdict
from difflib import SequenceMatcher
import pandas as pd
import numpy as np
import joblib
from sklearn.metrics.pairwise import cosine_similarity

class ProofFlowRecommender:
    """
    Production-ready Freelancer Opportunity and Course Recommendation Engine.
    Provides multi-factor transparent scoring, skill-gap analysis, and paced roadmaps.
    """
    def __init__(self, model_bundle, opportunities_df, courses_df, config):
        self.tfidf = model_bundle['tfidf_vectorizer']
        self.op_tfidf = model_bundle['opportunity_tfidf_matrix']
        self.weights = model_bundle['weights']
        self.canonical_skills = set(model_bundle['canonical_skills'])
        self.skill_lookup = model_bundle['skill_lookup']
        self.skill_hierarchy = model_bundle['skill_hierarchy']
        self.op_df = opportunities_df.copy()
        self.cr_df = courses_df.copy()
        self.config = config

        self.exp_map = config.get('experience_mapping', {
            'beginner': 1, 'junior': 2, 'intermediate': 3, 'senior': 4, 'expert': 5
        })
        self.prof_weights = config.get('proficiency_weights', {
            'basic': 0.60, 'beginner': 0.60, 'intermediate': 0.85, 'advanced': 1.00, 'expert': 1.00
        })

    @classmethod
    def load(cls, package_root=None):
        if package_root is None:
            package_root = os.getcwd()
        if os.path.basename(package_root) == 'model':
            model_dir = package_root
            package_root = os.path.dirname(package_root)
        else:
            model_dir = os.path.join(package_root, 'model')

        data_dir = os.path.join(package_root, 'data')
        model_bundle_path = os.path.join(model_dir, 'recommendation_model.joblib')
        config_path = os.path.join(model_dir, 'model_config.json')
        op_path = os.path.join(data_dir, 'opportunities.csv')
        cr_path = os.path.join(data_dir, 'courses.csv')

        if not os.path.exists(model_bundle_path):
            raise FileNotFoundError(f"Model file not found at {model_bundle_path}")

        model_bundle = joblib.load(model_bundle_path)
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)

        op_df = pd.read_csv(op_path)
        cr_df = pd.read_csv(cr_path)

        def parse_list(val):
            if isinstance(val, str) and val.startswith('['):
                try:
                    import ast
                    return ast.literal_eval(val)
                except Exception:
                    pass
            if pd.isnull(val):
                return []
            return [x.strip() for x in str(val).split('|') if x.strip()]

        op_df['canonical_skills'] = op_df['canonical_skills'].apply(parse_list)
        cr_df['canonical_skills'] = cr_df['canonical_skills'].apply(parse_list)

        return cls(model_bundle, op_df, cr_df, config)

    def canonicalize(self, skill):
        if not skill or pd.isnull(skill):
            return None
        s = str(skill).strip()
        if not s:
            return None
        s_low = s.lower()
        if s_low in self.skill_lookup:
            return self.skill_lookup[s_low]
        clean = re.sub(r'[^a-zA-Z0-9\s]', '', s_low).strip()
        if clean in self.skill_lookup:
            return self.skill_lookup[clean]
        for c in self.canonical_skills:
            if SequenceMatcher(None, s_low, c.lower()).ratio() > 0.85:
                return c
        return s

    def _map_exp(self, val):
        if pd.isnull(val):
            return 2
        return self.exp_map.get(str(val).lower().strip(), 2)

    def _calc_exp_score(self, user_exp, req_exp):
        u = self._map_exp(user_exp)
        r = self._map_exp(req_exp)
        if u == r:
            return 100.0
        elif u > r:
            return 90.0
        else:
            diff = r - u
            if diff == 1:
                return 60.0
            elif diff == 2:
                return 30.0
            else:
                return 10.0

    def recommend(self, freelancer_profile, top_k=10, filters=None):
        if filters is None:
            filters = {}

        raw_skills = freelancer_profile.get('skills', [])
        user_skills = [self.canonicalize(s) for s in raw_skills if self.canonicalize(s)]
        user_skills_set = set(user_skills)

        user_exp = freelancer_profile.get('experience_level', 'intermediate')
        user_roles = [str(freelancer_profile.get('primary_role', '')), str(freelancer_profile.get('desired_role', ''))]
        career_goals = freelancer_profile.get('career_goals', freelancer_profile.get('career_goal', []))
        if isinstance(career_goals, str):
            career_goals = [career_goals]

        user_prof = freelancer_profile.get('skill_proficiency', {})
        if isinstance(user_prof, str):
            p_dict = {}
            for item in user_prof.split('|'):
                if ':' in item:
                    sk, pr = item.split(':', 1)
                    p_dict[self.canonicalize(sk)] = pr.strip().lower()
            user_prof = p_dict

        profile_text = f"{' '.join(user_roles)} {' '.join(career_goals)} {' '.join(user_skills)}"
        user_vec = self.tfidf.transform([profile_text])
        text_sims = cosine_similarity(user_vec, self.op_tfidf).flatten()

        opp_results = []
        for idx, row in self.op_df.iterrows():
            if filters.get('remote_only', False) and not bool(row.get('is_remote', False)):
                continue
            if 'opportunity_types' in filters and filters['opportunity_types']:
                if row.get('opportunity_type') not in filters['opportunity_types']:
                    continue
            if filters.get('active_only', False) and row.get('availability_status') == 'EXPIRED':
                continue
            if filters.get('min_compensation', 0) > 0:
                if row.get('monthly_max_comp_inr', 0) < filters['min_compensation']:
                    continue

            opp_skills = row['canonical_skills']
            opp_skills_set = set(opp_skills)
            matched = sorted(list(user_skills_set.intersection(opp_skills_set)))
            missing = sorted(list(opp_skills_set - user_skills_set))

            if len(opp_skills_set) > 0:
                weighted_matched = sum(self.prof_weights.get(user_prof.get(m, 'intermediate').lower(), 0.85) for m in matched)
                skill_score = min(100.0, (weighted_matched / len(opp_skills_set)) * 100.0)
            else:
                skill_score = text_sims[idx] * 100.0

            text_score = min(100.0, max(0.0, text_sims[idx] * 100.0))
            exp_score = self._calc_exp_score(user_exp, row.get('experience_level', 'intermediate'))

            remote_pref = str(freelancer_profile.get('remote_preference', 'Remote-first')).lower()
            is_remote_job = bool(row.get('is_remote', False))
            if is_remote_job:
                work_score = 100.0 if ('remote' in remote_pref or 'hybrid' in remote_pref) else 70.0
            else:
                work_score = 100.0 if 'on-site' in remote_pref else (65.0 if 'hybrid' in remote_pref else 25.0)

            opp_text = f"{row.get('title', '')} {row.get('opportunity_type', '')}".lower()
            goal_score = 50.0
            for r in user_roles:
                if r and r.lower() in opp_text:
                    goal_score = 100.0
                    break
            for g in career_goals:
                if g and any(w.lower() in opp_text for w in str(g).split()):
                    goal_score = max(goal_score, 85.0)

            overall_score = (
                self.weights['skill_match'] * skill_score +
                self.weights['text_similarity'] * text_score +
                self.weights['experience'] * exp_score +
                self.weights['work_remote'] * work_score +
                self.weights['career_goal'] * goal_score
            )
            overall_score = round(min(100.0, max(0.0, overall_score)), 1)

            u_num = self._map_exp(user_exp)
            r_num = self._map_exp(row.get('experience_level', 'intermediate'))
            if u_num == r_num:
                exp_compat = f"Direct Match ({row.get('experience_level')})"
            elif u_num > r_num:
                exp_compat = f"Profile Senior ({user_exp} vs {row.get('experience_level')})"
            else:
                exp_compat = f"Growth Role ({user_exp} vs {row.get('experience_level')})"

            matched_text = ", ".join(matched) if matched else "None directly listed"
            missing_text = ", ".join(missing) if missing else "None"
            explanation = (
                f"Overall match score {overall_score}/100. "
                f"Matched skills ({len(matched)}): {matched_text}. "
                f"Experience: {exp_compat}. "
                f"Arrangement: {'Fully Remote' if is_remote_job else f'On-site ({row.get("location")})'}."
            )
            suggestions = (
                f"Acquiring {missing_text} would satisfy the primary technical requirements for this role."
                if missing else "Your skill profile fully satisfies all listed requirements."
            )

            min_c = row.get('monthly_min_comp_inr', 0)
            max_c = row.get('monthly_max_comp_inr', 0)
            if min_c == max_c:
                comp_str = f"INR {min_c:,.0f} / month" if min_c > 0 else "Unpaid / Prize / Unspecified"
            else:
                comp_str = f"INR {min_c:,.0f} - {max_c:,.0f} / month"

            opp_results.append({
                'opportunity_id': row.get('opportunity_id'),
                'title': row.get('title'),
                'organization_name': row.get('organization_name'),
                'opportunity_type': row.get('opportunity_type'),
                'overall_match_score': overall_score,
                'skills_matched': matched,
                'skills_missing': missing,
                'experience_compatibility': exp_compat,
                'work_arrangement': 'Remote' if is_remote_job else f"On-site ({row.get('location')})",
                'listed_compensation': comp_str,
                'deadline': row.get('deadline'),
                'availability_status': row.get('availability_status', 'UNVERIFIED_STATUS'),
                'availability_details': row.get('availability_details', ''),
                'application_url': row.get('application_url'),
                'explanation': explanation,
                'improvement_suggestions': suggestions,
                'disclaimer': "Match score indicates qualification alignment, not an employment guarantee."
            })

        opp_results.sort(key=lambda x: x['overall_match_score'], reverse=True)
        top_opps = opp_results[:top_k]

        missing_skill_counter = Counter()
        skill_opp_map = defaultdict(list)
        for opp in top_opps:
            for s in opp['skills_missing']:
                missing_skill_counter[s] += 1
                skill_opp_map[s].append(opp['title'])

        user_budget = float(freelancer_profile.get('budget', freelancer_profile.get('max_learning_budget_inr', 10000.0)))
        user_hours = float(freelancer_profile.get('available_hours_per_week', freelancer_profile.get('learning_hours_per_week', 10.0)))

        valid_courses = self.cr_df[self.cr_df.get('is_valid_course', True)].copy()
        course_results = []
        for _, row in valid_courses.iterrows():
            taught = set(row['canonical_skills'])
            addressed = sorted(list(taught.intersection(set(missing_skill_counter.keys()))))
            demand_weight = sum(missing_skill_counter[s] for s in addressed)
            coverage_score = min(60.0, (len(addressed) * 25.0) + (demand_weight * 8.0))
            if len(missing_skill_counter) == 0:
                coverage_score = 30.0

            rating_val = float(row.get('rating', 4.5))
            rating_score = (rating_val / 5.0) * 20.0
            hours_req = float(row.get('workload_hours', 10.0))
            workload_fit = 10.0 if hours_req <= (user_hours * 1.5) else 0.0
            price = float(row.get('price_inr', 0.0))
            budget_fit = 10.0 if price <= user_budget else -40.0

            relevance = round(min(100.0, max(15.0, coverage_score + rating_score + workload_fit + budget_fit)), 1)
            if addressed or len(missing_skill_counter) == 0:
                explanation = (
                    f"Addresses missing skill(s): {', '.join(addressed) if addressed else 'Domain Core'}. "
                    f"Directly applies to {demand_weight} of your top opportunities. "
                    f"Weekly workload (~{hours_req:.0f} hrs) fits within your {user_hours:.0f} hrs/wk budget."
                )
                course_results.append({
                    'course_id': row.get('course_id'),
                    'title': row.get('title'),
                    'platform': row.get('platform'),
                    'provider_institution': row.get('provider_institution'),
                    'skills_taught': row['canonical_skills'],
                    'missing_skills_addressed': addressed,
                    'relevance_score': relevance,
                    'difficulty_level': row.get('difficulty_level'),
                    'workload_hours': hours_req,
                    'duration_weeks': float(row.get('duration_weeks', 2.0)),
                    'price_inr': price,
                    'rating': rating_val,
                    'credential_type': row.get('credential_type'),
                    'course_url': row.get('course_url'),
                    'explanation': explanation
                })

        course_results.sort(key=lambda x: (len(x['missing_skills_addressed']) > 0, x['relevance_score']), reverse=True)
        top_courses = course_results[:5]

        ordered_skills = [s for s, _ in missing_skill_counter.most_common()]
        milestones = []
        cum_hours = 0.0
        phase_num = 1
        for skill in ordered_skills[:4]:
            demand = missing_skill_counter[skill]
            best_c = None
            for c in top_courses:
                if skill in c['missing_skills_addressed']:
                    best_c = c
                    break
            if not best_c:
                for _, r in valid_courses.iterrows():
                    if skill in r['canonical_skills']:
                        best_c = {
                            'title': r['title'],
                            'platform': r['platform'],
                            'course_url': r['course_url'],
                            'workload_hours': float(r.get('workload_hours', 12.0))
                        }
                        break

            c_title = best_c['title'] if best_c else f"Self-Guided Tutorial & Project: {skill}"
            c_plat = best_c['platform'] if best_c else "Open Documentation"
            c_url = best_c.get('course_url', '') if best_c else ""
            c_hours = float(best_c.get('workload_hours', 12.0)) if best_c else 12.0

            cum_hours += c_hours
            weeks_needed = max(1.0, round(c_hours / max(1.0, user_hours), 1))

            milestones.append({
                'phase': f"Phase {phase_num}: Master {skill}",
                'target_skill': skill,
                'opportunity_demand': f"Required by {demand} top opportunities (e.g. {', '.join(skill_opp_map[skill][:2])})",
                'recommended_course': c_title,
                'platform': c_plat,
                'course_url': c_url,
                'workload_hours': c_hours,
                'estimated_weeks_at_pace': weeks_needed,
                'cumulative_study_hours': cum_hours,
                'projected_impact': f"Directly elevates qualification match across {demand} high-value opportunities."
            })
            phase_num += 1

        total_weeks = max(1.0, round(cum_hours / max(1.0, user_hours), 1))
        roadmap = {
            'freelancer_weekly_pace_hours': user_hours,
            'total_study_hours': cum_hours,
            'total_estimated_weeks': total_weeks,
            'milestones': milestones,
            'career_disclaimer': "Roadmap optimizes skill alignment. Employment outcomes depend on client hiring decisions and interview performance."
        }

        return {
            'opportunities': top_opps,
            'courses': top_courses,
            'skill_gaps': dict(missing_skill_counter),
            'learning_roadmap': roadmap
        }
