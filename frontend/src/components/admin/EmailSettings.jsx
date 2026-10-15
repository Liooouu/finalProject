import React, { useEffect, useState, useCallback } from "react";
import api from "../../api/axios";
import { usePageMeta } from "../../context/PageMetaContext";
import Button from "../ui/Button";
import {
  FaEnvelope,
  FaPaperPlane,
  FaEye,
  FaEyeSlash,
  FaTimes,
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

const inputCls = (hasError) =>
  `w-full px-4 py-2.5 bg-card dark:bg-black rounded-lg border ${
    hasError ? "border-red-500" : "border-line"
  } text-on placeholder-on-muted focus:outline-none focus:ring-2 ${
    hasError ? "focus:ring-red-500/40" : "focus:ring-indigo-500/40"
  } focus:border-transparent transition-colors`;

const EnvHint = ({ show }) =>
  show ? (
    <span className="ml-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">
      using environment value
    </span>
  ) : null;

const TemplateCard = ({ kind, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const meta = TEMPLATE_META[kind];

  return (
    <div className="border border-line rounded-xl overflow-hidden bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-card-alt transition-colors"
      >
        <div>
          <p className="font-semibold text-on text-sm">{meta.label}</p>
          <p className="text-xs text-on-dim mt-0.5">{meta.description}</p>
        </div>
        {open ? (
          <FaChevronUp className="w-4 h-4 text-on-muted shrink-0" />
        ) : (
          <FaChevronDown className="w-4 h-4 text-on-muted shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-line pt-4">
          <div>
            <label className="block text-xs font-medium text-on-dim mb-1.5">Subject</label>
            <input
              type="text"
              value={value.subject}
              placeholder={meta.subjectPlaceholder || "Leave blank for the default"}
              className={inputCls(false)}
              onChange={(e) => onChange(kind, "subject", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-dim mb-1.5">Heading</label>
            <input
              type="text"
              value={value.title}
              placeholder="Leave blank for the default"
              className={inputCls(false)}
              onChange={(e) => onChange(kind, "title", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-dim mb-1.5">Body text</label>
            <textarea
              rows={3}
              value={value.body}
              placeholder="Leave blank for the default"
              className={`${inputCls(false)} resize-y`}
              onChange={(e) => onChange(kind, "body", e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {meta.placeholders.map((p) => (
              <code
                key={p}
                className="px-2 py-0.5 rounded bg-card-alt border border-line text-[11px] text-on-dim"
              >
                {p}
              </code>
            ))}
          </div>

          <div className="rounded-lg bg-card-alt border border-line p-4">
            <p className="text-[11px] uppercase tracking-wide text-on-muted font-semibold mb-2">
              Preview (sample values)
            </p>
            <p className="text-sm font-semibold text-on">{fillSample(value.subject) || "(default subject)"}</p>
            <p className="text-sm font-bold text-on mt-1">{fillSample(value.title) || "(default heading)"}</p>
            <p className="text-sm text-on-dim mt-1 whitespace-pre-line">
              {fillSample(value.body) || "(default body)"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const EmailSettings = () => {
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
    return <div className="p-8 text-center text-on-dim">Loading email settings…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <form onSubmit={save} className="space-y-6">
        {/* SMTP connection */}
        <div className="bg-card rounded-xl border border-line overflow-hidden">
          <div className="p-6 border-b border-line flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-500/15 flex items-center justify-center ring-1 ring-indigo-500/25">
              <FaEnvelope className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on">SMTP Connection</h2>
              <p className="text-sm text-on-dim">Where outgoing emails are sent from</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {message && (
              <div
                className={`p-4 rounded-lg text-sm ${
                  message.type === "success"
                    ? "dark:bg-green-900/30 bg-green-50 dark:border-green-800 border-green-300 dark:text-green-400 text-green-600"
                    : "dark:bg-red-900/30 bg-red-50 dark:border-red-800 border-red-300 dark:text-red-400 text-red-600"
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-on-dim mb-2">
                  SMTP Host<EnvHint show={envFallback.host} />
                </label>
                <input
                  type="text"
                  value={smtp.host}
                  placeholder="smtp.gmail.com"
                  className={inputCls(false)}
                  onChange={(e) => setSmtpField("host", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-dim mb-2">Port</label>
                <input
                  type="number"
                  value={smtp.port}
                  placeholder="465"
                  className={inputCls(false)}
                  onChange={(e) => setSmtpField("port", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-on-dim mb-2">Security</label>
              <select
                value={smtp.secure}
                className={inputCls(false)}
                onChange={(e) => setSmtpField("secure", e.target.value)}
              >
                <option value="">Auto (SSL when port is 465)</option>
                <option value="true">SSL/TLS (port 465)</option>
                <option value="false">STARTTLS (port 587)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-on-dim mb-2">
                  Username<EnvHint show={envFallback.user} />
                </label>
                <input
                  type="text"
                  value={smtp.user}
                  placeholder="your-sending-address@gmail.com"
                  className={inputCls(false)}
                  onChange={(e) => setSmtpField("user", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-dim mb-2">
                  Password
                  <EnvHint show={envFallback.password && !hasSmtpPassword} />
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={smtp.password}
                    placeholder={
                      hasSmtpPassword && !clearSmtpPassword
                        ? "•••••••• (leave blank to keep current)"
                        : "App password"
                    }
                    disabled={clearSmtpPassword}
                    className={`${inputCls(false)} pr-10`}
                    onChange={(e) => setSmtpField("password", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-muted hover:text-on-dim"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                  </button>
                </div>
                {hasSmtpPassword && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-on-dim cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clearSmtpPassword}
                      onChange={(e) => {
                        setClearSmtpPassword(e.target.checked);
                        if (e.target.checked) setSmtpField("password", "");
                      }}
                      className="rounded border-line"
                    />
                    Remove saved password (fall back to environment)
                  </label>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-on-dim mb-2">
                  From address<EnvHint show={envFallback.from} />
                </label>
                <input
                  type="text"
                  value={smtp.from}
                  placeholder="TrackED <your-sending-address@gmail.com>"
                  className={inputCls(false)}
                  onChange={(e) => setSmtpField("from", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-dim mb-2">
                  App URL<EnvHint show={envFallback.appUrl} />
                </label>
                <input
                  type="text"
                  value={smtp.appUrl}
                  placeholder="https://track-ed.vispo.me"
                  className={inputCls(false)}
                  onChange={(e) => setSmtpField("appUrl", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Test email */}
        <div className="bg-card rounded-xl border border-line p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-on">Send a Test Email</h2>
            <p className="text-sm text-on-dim">
              Sends a short message using the settings above (save first to test new values).
            </p>
          </div>
          {testResult && (
            <div
              className={`p-4 rounded-lg text-sm ${
                testResult.type === "success"
                  ? "dark:bg-green-900/30 bg-green-50 dark:border-green-800 border-green-300 dark:text-green-400 text-green-600"
                  : "dark:bg-red-900/30 bg-red-50 dark:border-red-800 border-red-300 dark:text-red-400 text-red-600"
              }`}
            >
              {testResult.text}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={testEmail}
              placeholder="Where to send the test email"
              className={`${inputCls(false)} flex-1`}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={sendTest}
              disabled={testLoading || !testEmail.trim()}
            >
              <FaPaperPlane className="w-4 h-4" />
              {testLoading ? "Sending…" : "Send Test"}
            </Button>
          </div>
        </div>

        {/* Templates */}
        <div className="bg-card rounded-xl border border-line p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-on">Email Content</h2>
            <p className="text-sm text-on-dim">
              Edit the subject, heading, and body of each email. Leave any field blank to keep the
              built-in wording. Placeholders are replaced when the email is sent.
            </p>
          </div>
          <TemplateCard kind="verification" value={templates.verification} onChange={changeTemplate} />
          <TemplateCard kind="passwordReset" value={templates.passwordReset} onChange={changeTemplate} />
          <TemplateCard kind="notification" value={templates.notification} onChange={changeTemplate} />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EmailSettings;
