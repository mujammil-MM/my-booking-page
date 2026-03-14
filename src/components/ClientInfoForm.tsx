'use client';

interface Props {
  data: {
    clientName: string;
    email: string;
    phone: string;
    company: string;
    discussionTopic: string;
  };
  onChange: (data: Props['data']) => void;
}

export default function ClientInfoForm({ data, onChange }: Props) {
  function update(field: keyof Props['data'], value: string) {
    onChange({ ...data, [field]: value });
  }

  return (
    <div className="form-grid">
      <div className="form-group">
        <label htmlFor="clientName">Full Name *</label>
        <input
          id="clientName"
          type="text"
          placeholder="John Doe"
          value={data.clientName}
          onChange={e => update('clientName', e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="email">Email Address *</label>
        <input
          id="email"
          type="email"
          placeholder="john@company.com"
          value={data.email}
          onChange={e => update('email', e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="phone">Phone / WhatsApp *</label>
        <input
          id="phone"
          type="tel"
          placeholder="+91 8149163691"
          value={data.phone}
          onChange={e => update('phone', e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="company">Company / Project</label>
        <input
          id="company"
          type="text"
          placeholder="Acme Inc."
          value={data.company}
          onChange={e => update('company', e.target.value)}
        />
      </div>

      <div className="form-group full-width">
        <label htmlFor="discussionTopic">What do you want to discuss? *</label>
        <textarea
          id="discussionTopic"
          placeholder="Tell us briefly about your project or what you'd like to discuss..."
          value={data.discussionTopic}
          onChange={e => update('discussionTopic', e.target.value)}
          rows={3}
          required
        />
      </div>
    </div>
  );
}
