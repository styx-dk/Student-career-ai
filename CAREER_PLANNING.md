# Career Planning

The planner uses a greedy weighted set-cover strategy. For every remaining action it simulates the readiness gain, adds a small configured forecast signal, divides benefit by effort, selects the most efficient useful action and repeats. It stops at the target, action limit or when no action produces direct benefit.

The output shows action order, covered skills, effort, projected readiness and remaining gaps. Forecasts adjust priority but cannot override direct JD requirements. The method is explainable and practical for the MVP; it does not claim a global optimum.

