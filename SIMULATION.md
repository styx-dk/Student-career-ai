# Simulation

The what-if service receives an analyzed JD and selected catalog actions. It copies the current skill list and evidence map, adds hypothetical evidence marked `hypothetical: true`, reruns the same deterministic matcher, and returns baseline, simulated score, newly covered requirements and remaining gaps.

The copied state is discarded. `student_skills` and `career_records` are never updated. A stored simulation result is an audit of the hypothetical calculation, not career evidence.

