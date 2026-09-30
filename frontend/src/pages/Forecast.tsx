import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Card, Empty, Notice } from "../components/UI";
import { api } from "../lib/api";
type ForecastData = {
  domain: string;
  skill: string;
  historical: Array<{
    month: string;
    demand_rate: number;
    job_count: number;
    total_jobs: number;
  }>;
  forecast: Array<{
    month: string;
    predicted_rate: number;
    lower_bound?: number;
    upper_bound?: number;
    trend: string;
    model: string;
  }>;
  notice: string;
  available: boolean;
  scope?: string;
};
export function Forecast() {
  const [params, setParams] = useSearchParams();
  const [domain, setDomain] = useState(params.get("domain") || "Data Analytics");
  const [skill, setSkill] = useState(params.get("skill") || "sql");
  const [catalog, setCatalog] = useState<Record<string, string[]>>({});
  const [data, setData] = useState<ForecastData>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(nextDomain = domain, nextSkill = skill) {
    setError("");
    setBusy(true);
    setData(undefined);
    try {
      setData(
        await api(
          `/forecasts?domain=${encodeURIComponent(nextDomain)}&skill=${encodeURIComponent(nextSkill.trim())}`,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load market data");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void api<Record<string, string[]>>("/forecasts/catalog").then((result) => {
      setCatalog(result);
      const chosenDomain = result[domain] ? domain : Object.keys(result)[0] || domain;
      const chosenSkill = result[chosenDomain]?.includes(skill) ? skill : result[chosenDomain]?.[0] || skill;
      setDomain(chosenDomain);
      setSkill(chosenSkill);
      if (params.get("skill")) void submit(chosenDomain, chosenSkill);
    }).catch((e) => setError(e instanceof Error ? e.message : "Could not load the published market catalog"));
  }, []);
  const chart = [
    ...(data?.historical.map((x) => ({
      month: x.month,
      historical: x.demand_rate,
    })) || []),
    ...(data?.forecast.map((x) => ({
      month: x.month,
      forecast: x.predicted_rate,
    })) || []),
  ];
  return (
    <>
      <Card>
        <h2>Explore demand for a skill</h2>
        <p>
          Historical observations and model forecasts are shown separately. A
          forecast is not a guarantee.
        </p>
        <form
          className="forecast-controls section-gap"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ domain, skill });
            void submit();
          }}
        >
          <label>
            Area of interest
            <select value={domain} onChange={(e) => { const next = e.target.value; setDomain(next); setSkill(catalog[next]?.[0] || ""); }}>
              {Object.keys(catalog).map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Skill
            <select required value={skill} onChange={(e) => setSkill(e.target.value)}>
              {(catalog[domain] || []).map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <button className="primary" disabled={busy || !skill.trim()}>
            {busy ? "Loading..." : "Explore demand"}
          </button>
        </form>
      </Card>
      {error && <Notice kind="error">{error}</Notice>}
      {!data && !busy && !error && (
        <Empty
          title="See how demand is changing"
          description="Choose an area and enter a skill to explore published market data."
        />
      )}
      {data && (
        <>
          <Notice>{data.notice}</Notice>
          {!data.available ? (
            <Empty
              title="No published forecast"
              description="There is not enough published data for this skill yet. Try another skill. Your career profile is unaffected."
            />
          ) : (
            <div className="forecast-grid">
              <Card>
                <div className="card-head">
                  <h2>
                    {data.skill} · {data.domain}
                  </h2>
                  <span className="model-chip">{data.scope === "historical_experiment" ? `Historical · ${data.forecast[0]?.model || "model"}` : data.forecast[0]?.model || "Forecast"}</span>
                </div>
                <div className="chart">
                  <ResponsiveContainer>
                    <LineChart data={chart}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis
                        tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                      />
                      <Tooltip
                        formatter={(v: number) => `${(v * 100).toFixed(2)}%`}
                      />
                      <Legend />
                      <Line
                        name="Observed demand"
                        dataKey="historical"
                        stroke="#315bdd"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        name="Forecast (estimate)"
                        dataKey="forecast"
                        stroke="#9a6d25"
                        strokeDasharray="6 4"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <small>
                  Share of job postings mentioning this skill. Missing values
                  are not filled in.
                </small>
              </Card>
              <Card>
                <p className="eyebrow">Forecast outlook</p>
                <h2>{data.forecast.at(-1)?.trend || "No forecast values"}</h2>
                {data.forecast.length > 0 && (
                  <>
                    <strong className="forecast-value">
                      {(data.forecast.at(-1)!.predicted_rate * 100).toFixed(1)}%
                    </strong>
                    <p>Predicted share for {data.forecast.at(-1)!.month}.</p>
                  </>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );
}
