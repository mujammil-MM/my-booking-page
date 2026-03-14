'use client';

interface Props {
  data: {
    problem: string;
    budgetRange: string;
    timeline: string;
    workedWithAgencyBefore: string;
  };
  onChange: (data: Props['data']) => void;
}

export default function QualificationForm({ data, onChange }: Props) {
  function update(field: keyof Props['data'], value: string) {
    onChange({ ...data, [field]: value });
  }

  return (
    <div className="form-grid">
      <div className="form-group full-width">
        <label htmlFor="problem">What problem are you trying to solve? *</label>
        <textarea
          id="problem"
          placeholder="Describe the main challenge or goal you're facing..."
          value={data.problem}
          onChange={e => update('problem', e.target.value)}
          rows={3}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="budgetRange">Budget Range</label>
        <select
          id="budgetRange"
          value={data.budgetRange}
          onChange={e => update('budgetRange', e.target.value)}
        >
          <option value="">Select a range</option>
          <option value="Under $1K">Under $1,000</option>
          <option value="$1K - $5K">$1,000 – $5,000</option>
          <option value="$5K - $15K">$5,000 – $15,000</option>
          <option value="$15K - $50K">$15,000 – $50,000</option>
          <option value="$50K+">$50,000+</option>
          <option value="Not sure">Not sure yet</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="timeline">Timeline</label>
        <select
          id="timeline"
          value={data.timeline}
          onChange={e => update('timeline', e.target.value)}
        >
          <option value="">Select timeline</option>
          <option value="ASAP">ASAP</option>
          <option value="1-2 weeks">1–2 weeks</option>
          <option value="1 month">1 month</option>
          <option value="2-3 months">2–3 months</option>
          <option value="Flexible">Flexible</option>
        </select>
      </div>

      <div className="form-group full-width">
        <label htmlFor="workedWithAgency">Have you worked with an agency/freelancer before?</label>
        <select
          id="workedWithAgency"
          value={data.workedWithAgencyBefore}
          onChange={e => update('workedWithAgencyBefore', e.target.value)}
        >
          <option value="">Select</option>
          <option value="Yes, great experience">Yes, great experience</option>
          <option value="Yes, mixed experience">Yes, mixed experience</option>
          <option value="Yes, bad experience">Yes, bad experience</option>
          <option value="No, first time">No, this is my first time</option>
        </select>
      </div>
    </div>
  );
}
