import React, { useEffect, useState, useCallback } from "react";
import api from "../../api/axios";
import { usePageMeta } from "../../context/PageMetaContext";
import { Button, Card, FlightPanel, PageHeader } from "../ui";
import {
  FaEnvelope,
  FaPaperPlane,
  FaEye,
  FaEyeSlash,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";

const TEMPLATE_META = {
  verification: {
    label: "Email verification (signup)",
    description: "Sent to students when they register, with the 6-digit code.",
    placeholders: ["{name}", "{code}", "{url}"],
  },
  passwordReset: {
    label: "Password reset",
    description: "Sent from the \"Forgot Password?\" screen with a 6-digit code.",
    placeholders: ["{name}", "{code}", "{url}"],
  },
  notification: {
    label: "Notification emails",
    description: "Event going live, marked late/absent, excuses, and other notifications.",
    placeholders: ["{title}", "{message}", "{eventTitle}", "{eventDate}", "{eventTime}", "{eventLocation}", "{url}"],
  },
};

const SAMPLE_VARS = {
  name: "Juan Dela Cruz",
  code: "483920",
  url: "https://track-ed.vispo.me",
  title: "Marked Late",
  message: "You were marked as late for event \"Founders Day\" by the organizer.",
  eventTitle: "Founders Day",
  eventDate: "Fri, Oct 16, 2026",
  eventTime: "1:00 PM – 5:00 PM",
  eventLocation: "Main Gymnasium",
};

function fillSample(text) {
  return String(text ?? "").replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(SAMPLE_VARS, key) ? SAMPLE_VARS[key] : match
  );
}

const EnvHint = ({ show }) =>
  show ? (
    <span className="ml-2 rounded-full bg-warn/10 px-2 py-0.5 text-[10px] font-medium text-warn">
      using environment value
    </span>
  ) : null;

const TemplateCard = ({ kind, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const meta = TEMPLATE_META[kind];

  return (
    <div className="panel-surface overflow-hidden rounded-[var(--panel-radius)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-card-alt/60"
      >
        <div>
          <p className="text-sm font-semibold text-on">{meta.label}</p>
          <p className="mt-0.5 text-xs text-on-dim">{meta.description}</p>
        </div>
        {open ? (
          <FaChevronUp className="shrink-0 text-xs text-on-muted" />
        ) : (
          <FaChevronDown className="shrink-0 text-xs text-on-muted" />
        )}
      </button>

      {open && (
        <div className="space-y-4 border-t border-line px-4 pb-4 pt-4">
          <div>
            <label className="field-label">Subject</label>
            <input
              type="text"
              value={value.subject}
              placeholder="Leave blank for the default"
              className="field"
              onChange={(e) => onChange(kind, "subject", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Heading</label>
            <input
              type="text"
              value={value.title}
              placeholder="Leave blank for the default"
              className="field"
              onChange={(e) => onChange(kind, "title", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Body text</label>
            <textarea
              rows={3}
              value={value.body}
              placeholder="Leave blank for the default"
              className="field"
              onChange={(e) => onChange(kind, "body", e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {meta.placeholders.map((p) => (
              <code
                key={p}
                className="rounded-md border border-line bg-card-alt px-1.5 py-0.5 text-[11px] text-on-dim"
              >
                {p}
              </code>
            ))}
          </div>

          <div className="rounded-xl border border-line bg-card-alt/50 p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-on-muted">
              Preview · sample values
            </p>
            <p className="text-sm font-semibold text-on">
              {fillSample(value.subject) || "(default subject)"}
            </p>
            <p className="mt-1 text-sm font-bold text-on">
              {fillSample(value.title) || "(default heading)"}
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-on-dim">
              {fillSample(value.body) || "(default body)"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const EmailSettings = ({ embedded = false }) => {
  usePageMeta("Email Settings", "Configure SMTP and edit the emails TrackED sends.");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [hasSmtpPassword, setHasSmtpPassword] = useState(false);
  const [clearSmtpPassword, setClearSmtpPassword] = useState(false);
  const [envFallback, setEnvFallback] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const [smtp, setSmtp] = useState({
    host: "",
    port: "",
    secure: "",
    user: "",
    password: "",
    from: "",
    appUrl: "",
  });

  const [templates, setTemplates] = useState({
    verification: { subject: "", title: "", body: "" },
    passwordReset: { subject: "", title: "", body: "" },
    notification: { subject: "", title: "", body: "" },
  });

  const [testEmail, setTestEmail] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/settings/email");
      setSmtp({
        host: data.smtp?.host || "",
        port: data.smtp?.port ?? "",
        secure:
          data.smtp?.secure === null || data.smtp?.secure === undefined
            ? ""
            : String(data.smtp.secure),
        user: data.smtp?.user || "",
        password: "",
        from: data.smtp?.from || "",
        appUrl: data.smtp?.appUrl || "",
      });
      setHasSmtpPassword(Boolean(data.hasSmtpPassword));
      setEnvFallback(data.envFallback || {});
      setTemplates({
        verification: {
          subject: data.templates?.verification?.subject || "",
          title: data.templates?.verification?.title || "",
          body: data.templates?.verification?.body || "",
        },
        passwordReset: {
          subject: data.templates?.passwordReset?.subject || "",
          title: data.templates?.passwordReset?.title || "",
          body: data.templates?.passwordReset?.body || "",
        },
        notification: {
          subject: data.templates?.notification?.subject || "",
          title: data.templates?.notification?.title || "",
          body: data.templates?.notification?.body || "",
        },
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to load email settings",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setSmtpField = (field, value) => {
    setSmtp((prev) => ({ ...prev, [field]: value }));
    setMessage(null);
  };

  const changeTemplate = (kind, field, value) => {
    setTemplates((prev) => ({ ...prev, [kind]: { ...prev[kind], [field]: value } }));
    setMessage(null);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setTestResult(null);

    try {
      const payload = {
        smtp: {
          host: smtp.host.trim(),
          user: smtp.user.trim(),
          from: smtp.from.trim(),
          appUrl: smtp.appUrl.trim(),
          port: smtp.port === "" ? null : Number(smtp.port),
          secure: smtp.secure === "" ? null : smtp.secure === "true",
        },
        templates,
      };
      if (clearSmtpPassword) {
        payload.clearSmtpPassword = true;
      } else if (smtp.password.trim()) {
        payload.smtp.password = smtp.password.trim();
      }

      const { data } = await api.patch("/admin/settings/email", payload);
      setHasSmtpPassword(Boolean(data.hasSmtpPassword));
      setEnvFallback(data.envFallback || {});
      setSmtp((prev) => ({ ...prev, password: "" }));
      setClearSmtpPassword(false);
      setMessage({ type: "success", text: "Email settings saved." });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const { data } = await api.post("/admin/settings/email/test", { email: testEmail.trim() });
      setTestResult({ type: "success", text: data.message });
    } catch (err) {
      setTestResult({ type: "error", text: err.response?.data?.message || "Failed to send test email" });
    } finally {
      setTestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        {!embedded && <PageHeader
          eyebrow="Settings"
          title="Email settings"
          subtitle="Loading the current SMTP configuration and templates…"
        />}
        <Card>
          <div className="space-y-3" role="status" aria-label="Loading email settings">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-card-alt" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {!embedded && <PageHeader
        eyebrow="Settings"
        title="Email settings"
        subtitle="Choose where outgoing mail is sent from and edit the wording of each message."
      />}

      {message && (
        <div
          className={`alert ${message.type === "success" ? "alert-ok" : "alert-danger"}`}
          role="status"
        >
          <span aria-hidden="true">{message.type === "success" ? "✓" : "!"}</span>
          <p>{message.text}</p>
        </div>
      )}

      <form onSubmit={save} className="space-y-5">
        <FlightPanel
          level="ledger"
          glass
          flush
          eyebrow="Outgoing mail"
          title="SMTP connection"
          subtitle="Where outgoing emails are sent from."
          icon={<FaEnvelope />}
        >
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="smtp-host" className="field-label">
                  SMTP host
                  <EnvHint show={envFallback.host} />
                </label>
                <input
                  id="smtp-host"
                  type="text"
                  value={smtp.host}
                  placeholder="smtp.gmail.com"
                  className="field"
                  onChange={(e) => setSmtpField("host", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="smtp-port" className="field-label">
                  Port
                </label>
                <input
                  id="smtp-port"
                  type="number"
                  value={smtp.port}
                  placeholder="465"
                  className="field"
                  onChange={(e) => setSmtpField("port", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="smtp-security" className="field-label">
                Security
              </label>
              <select
                id="smtp-security"
                value={smtp.secure}
                className="field-select"
                onChange={(e) => setSmtpField("secure", e.target.value)}
              >
                <option value="">Auto (SSL when port is 465)</option>
                <option value="true">SSL/TLS (port 465)</option>
                <option value="false">STARTTLS (port 587)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="smtp-user" className="field-label">
                  Username
                  <EnvHint show={envFallback.user} />
                </label>
                <input
                  id="smtp-user"
                  type="text"
                  value={smtp.user}
                  placeholder="your-sending-address@gmail.com"
                  className="field"
                  onChange={(e) => setSmtpField("user", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="smtp-password" className="field-label">
                  Password
                  <EnvHint show={envFallback.password && !hasSmtpPassword} />
                </label>
                <div className="relative">
                  <input
                    id="smtp-password"
                    type={showPassword ? "text" : "password"}
                    value={smtp.password}
                    placeholder={
                      hasSmtpPassword && !clearSmtpPassword
                        ? "•••••••• (leave blank to keep current)"
                        : "App password"
                    }
                    disabled={clearSmtpPassword}
                    className="field pr-10"
                    onChange={(e) => setSmtpField("password", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-on-muted transition-colors hover:text-on-dim"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                {hasSmtpPassword && (
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-on-dim">
                    <input
                      type="checkbox"
                      checked={clearSmtpPassword}
                      onChange={(e) => {
                        setClearSmtpPassword(e.target.checked);
                        if (e.target.checked) setSmtpField("password", "");
                      }}
                      className="accent-[var(--brand-solid)]"
                    />
                    Remove saved password (fall back to environment)
                  </label>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="smtp-from" className="field-label">
                  From address
                  <EnvHint show={envFallback.from} />
                </label>
                <input
                  id="smtp-from"
                  type="text"
                  value={smtp.from}
                  placeholder="TrackED <your-sending-address@gmail.com>"
                  className="field"
                  onChange={(e) => setSmtpField("from", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="smtp-app-url" className="field-label">
                  App URL
                  <EnvHint show={envFallback.appUrl} />
                </label>
                <input
                  id="smtp-app-url"
                  type="text"
                  value={smtp.appUrl}
                  placeholder="https://track-ed.vispo.me"
                  className="field"
                  onChange={(e) => setSmtpField("appUrl", e.target.value)}
                />
              </div>
            </div>
          </div>
        </FlightPanel>

        <FlightPanel
          level="instrument"
          glass
          eyebrow="Diagnostics"
          title="Send a test email"
          subtitle="Uses the saved settings — save first to test new values."
          icon={<FaPaperPlane />}
          tone="info"
        >
          {testResult && (
            <div
              className={`alert alert-sm mt-4 ${
                testResult.type === "success" ? "alert-ok" : "alert-danger"
              }`}
              role="status"
            >
              <span aria-hidden="true">{testResult.type === "success" ? "✓" : "!"}</span>
              <p>{testResult.text}</p>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={testEmail}
              placeholder="Where to send the test email"
              aria-label="Test email recipient"
              className="field flex-1"
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={sendTest}
              loading={testLoading}
              disabled={!testEmail.trim()}
            >
              <FaPaperPlane className="text-xs" />
              {testLoading ? "Sending…" : "Send test"}
            </Button>
          </div>
        </FlightPanel>

        <FlightPanel
          level="ledger"
          glass
          eyebrow="Templates"
          title="Email content"
          subtitle="Leave any field blank to keep the built-in wording. Placeholders are replaced when the email is sent."
        >
          <div className="space-y-2.5">
            <TemplateCard kind="verification" value={templates.verification} onChange={changeTemplate} />
            <TemplateCard kind="passwordReset" value={templates.passwordReset} onChange={changeTemplate} />
            <TemplateCard kind="notification" value={templates.notification} onChange={changeTemplate} />
          </div>
        </FlightPanel>

        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EmailSettings;
