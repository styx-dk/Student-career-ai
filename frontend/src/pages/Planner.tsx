import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Search } from "lucide-react";
import { api } from "../lib/api";
import type { Action, JD } from "../types";
import {
  Card,
  Empty,
  Notice,
  Pager,
  SkillChips,
  Spinner,
} from "../components/UI";
type Sim = {
  current_readiness: number;
  simulated_readiness: number;
  improvement: number;
  newly_covered: string[];
  remaining_gaps: string[];
};
type Plan = {
  id: string;
  job_description_id?: string;
  target_role?: string;
  current_readiness: number;
  projected_readiness?: number;
  target_readiness: number;
  target_reached?: boolean;
  actions: Array<{
    id: string;
    name: string;
    type: string;
    skills_covered: string[];
    effort_cost: number;
    reason: string;
  }>;
  remaining_gaps: string[];
  created_at?: string;
};
export function Planner() {
  const [jds, setJds] = useState<JD[]>();
  const [actions, setActions] = useState<Action[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [jd, setJd] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sim, setSim] = useState<Sim>();
  const [plan, setPlan] = useState<Plan>();
  const [target, setTarget] = useState(80);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [planPage, setPlanPage] = useState(1);
  async function load() {
    setError("");
    try {
      const [j, a, p] = await Promise.all([
        api<JD[]>("/job-descriptions"),
        api<Action[]>("/career/actions"),
        api<Plan[]>("/career/plans"),
      ]);
      setJds(j);
      setActions(a);
      setPlans(p);
      const chosen =
        j.find((x) => x.id === sessionStorage.getItem("career-target-role")) ||
        j[0];
      if (chosen) setJd(chosen.id);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load planning workspace",
      );
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function run(kind: "simulate" | "plans") {
    setError("");
    setBusy(true);
    try {
      if (kind === "simulate")
        setSim(
          await api("/career/simulate", {
            method: "POST",
            body: JSON.stringify({
              job_description_id: jd,
              action_ids: selected,
            }),
          }),
        );
      else {
        const result = await api<Plan>("/career/plans", {
          method: "POST",
          body: JSON.stringify({
            job_description_id: jd,
            target_readiness: target,
            max_actions: 5,
          }),
        });
        setPlan(result);
        setPlans(await api("/career/plans"));
        setPlanPage(1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not calculate result");
    } finally {
      setBusy(false);
    }
  }
  const role = jds?.find((j) => j.id === jd);
  const relevant = actions.filter(
    (a) =>
      (!role?.domain ||
        !a.related_domain ||
        a.related_domain === role.domain) &&
      `${a.action_name} ${a.skills_gained.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const saved = plans.filter((p) => p.job_description_id === jd);
  return (
    <>
      {error && (
        <Notice kind="error">
          {error}{" "}
          {!jds && (
            <button className="text-button" onClick={() => void load()}>
              Retry
            </button>
          )}
        </Notice>
      )}
      {!jds ? (
        !error && <Spinner />
      ) : !jds.length ? (
        <Empty
          title="Choose a target role first"
          description="Add and analyze a job description before exploring a learning plan."
          action={
            <Link className="primary" to="/planning/roles">
              Add target role
            </Link>
          }
        />
      ) : (
        <>
          <Notice>
            These are hypothetical outcomes, not completed achievements or a
            prediction of hiring success. Your actual profile is unchanged.
          </Notice>
          <Card>
            <div className="planner-controls">
              <label>
                Target role
                <select
                  value={jd}
                  disabled={busy}
                  onChange={(e) => {
                    setJd(e.target.value);
                    sessionStorage.setItem(
                      "career-target-role",
                      e.target.value,
                    );
                    setSim(undefined);
                    setPlan(undefined);
                    setSelected([]);
                    setPage(1);
                    setPlanPage(1);
                  }}
                >
                  {jds.map((j) => (
                    <option value={j.id} key={j.id}>
                      {j.job_title || j.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Readiness goal (%)
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                />
              </label>
              <button
                className="primary"
                disabled={
                  busy ||
                  !role?.requirements.length ||
                  !actions.length ||
                  target < 1 ||
                  target > 100
                }
                onClick={() => void run("plans")}
              >
                {busy ? "Calculating..." : "Create suggested plan"}
              </button>
            </div>
          </Card>
          {!role?.requirements.length ? (
            <Empty
              title="Analyze this role first"
              description="We need its skill requirements before comparing learning activities."
              action={
                <Link className="secondary" to="/planning/roles">
                  Analyze target role
                </Link>
              }
            />
          ) : (
            <div className="planner-grid">
              <Card>
                <div className="card-head">
                  <div>
                    <h2>Explore learning activities</h2>
                    <p className="helper">
                      {selected.length} selected · Effort is relative, not a
                      time estimate.
                    </p>
                  </div>
                </div>
                <div className="search">
                  <Search />
                  <input
                    aria-label="Search learning activities"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search activities or skills"
                  />
                </div>
                {relevant.length ? (
                  <>
                    <div className="action-list">
                      {relevant.slice((page - 1) * 8, page * 8).map((a) => (
                        <button
                          type="button"
                          disabled={busy}
                          aria-pressed={selected.includes(a.id)}
                          className={selected.includes(a.id) ? "selected" : ""}
                          key={a.id}
                          onClick={() =>
                            setSelected((s) =>
                              s.includes(a.id)
                                ? s.filter((id) => id !== a.id)
                                : [...s, a.id],
                            )
                          }
                        >
                          <span className="checkbox">
                            {selected.includes(a.id) && <Check />}
                          </span>
                          <div>
                            <b>{a.action_name}</b>
                            <p className="clamp">{a.description}</p>
                            <SkillChips skills={a.skills_gained} />
                          </div>
                          <em>Effort {a.effort_cost}</em>
                        </button>
                      ))}
                    </div>
                    <Pager
                      page={page}
                      total={relevant.length}
                      size={8}
                      onChange={setPage}
                    />
                    <button
                      className="primary wide"
                      disabled={busy || !selected.length}
                      onClick={() => void run("simulate")}
                    >
                      Compare possible impact
                    </button>
                  </>
                ) : (
                  <Empty
                    title="No matching activities"
                    description={
                      actions.length
                        ? "Try another search or target role."
                        : "The learning activity catalog has not been populated yet. You can still review your role’s skill gaps."
                    }
                    action={
                      <Link className="secondary" to="/planning/roles">
                        View skill gaps
                      </Link>
                    }
                  />
                )}
              </Card>
              <div>
                {sim && (
                  <Card>
                    <p className="eyebrow">What-if result</p>
                    <h2>Estimated readiness</h2>
                    <div className="comparison">
                      <div>
                        <span>Current</span>
                        <strong>{sim.current_readiness}%</strong>
                      </div>
                      <span>→</span>
                      <div>
                        <span>With activities</span>
                        <strong>{sim.simulated_readiness}%</strong>
                      </div>
                    </div>
                    <h3>Newly covered skills</h3>
                    <SkillChips skills={sim.newly_covered} limit={8} />
                    <details>
                      <summary>
                        Remaining gaps ({sim.remaining_gaps.length})
                      </summary>
                      <SkillChips
                        skills={sim.remaining_gaps}
                        limit={sim.remaining_gaps.length}
                      />
                    </details>
                  </Card>
                )}
                {plan ? (
                  <Card>
                    <p className="eyebrow">Saved suggested plan</p>
                    <h2>
                      {plan.target_reached
                        ? "Target reached in this simulation"
                        : "Best available next steps"}
                    </h2>
                    <p>
                      Current {plan.current_readiness}%
                      {plan.projected_readiness !== undefined &&
                        ` → projected ${plan.projected_readiness}%`}{" "}
                      · Goal {plan.target_readiness}%
                    </p>
                    <ol className="plan-list">
                      {plan.actions.map((a) => (
                        <li key={a.id}>
                          <b>{a.name}</b>
                          <p>{a.reason}</p>
                          <SkillChips skills={a.skills_covered} />
                          <small>Relative effort: {a.effort_cost}</small>
                        </li>
                      ))}
                    </ol>
                    {!plan.actions.length && (
                      <p>
                        No additional catalog activities could improve this
                        estimate.
                      </p>
                    )}
                    <details>
                      <summary>
                        Remaining gaps ({plan.remaining_gaps.length})
                      </summary>
                      <SkillChips
                        skills={plan.remaining_gaps}
                        limit={plan.remaining_gaps.length}
                      />
                    </details>
                  </Card>
                ) : (
                  !sim && (
                    <Empty
                      title="Explore before committing"
                      description="Select activities to compare their potential impact, or create a suggested plan for this role."
                    />
                  )
                )}
              </div>
            </div>
          )}
          {!!saved.length && (
            <Card className="section-gap">
              <h2>Saved plans for this role</h2>
              {saved.slice((planPage - 1) * 5, planPage * 5).map((p) => (
                <button
                  key={p.id}
                  className="record-link"
                  onClick={() => setPlan(p)}
                >
                  <span>
                    <b>{p.target_role}</b>
                    <small>
                      {p.actions.length} activities · Goal {p.target_readiness}%
                      ·{" "}
                      {p.created_at
                        ? new Date(p.created_at).toLocaleDateString()
                        : ""}
                    </small>
                  </span>
                  <span>View plan →</span>
                </button>
              ))}
              <Pager
                page={planPage}
                total={saved.length}
                size={5}
                onChange={setPlanPage}
              />
            </Card>
          )}
        </>
      )}
    </>
  );
}
